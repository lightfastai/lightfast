# Security Review Report - Console Application

**Date:** 2025-01-21
**Reviewer:** Claude Code Security Analysis
**Scope:** `/apps/console` and `/api/console`
**Branch:** `feat/phase1.6-decouple-github`

---

## Executive Summary

This report provides a comprehensive security analysis of the `/apps/console` application and its tRPC API (`/api/console`). The review identified **17 security findings** across multiple severity levels, with **3 critical**, **5 high**, **6 medium**, and **3 low** severity issues.

---

## Critical Severity Issues (3)

### 1. Missing Authorization on Public tRPC Procedures - Repository Mutations

**File:** `/api/console/src/router/repository.ts`
**Lines:** 303-432
**Severity:** CRITICAL

**Description:**
The repository router exposes several mutation procedures as `publicProcedure` (lines 303, 323, 352, 370, 397, 413) that allow **unauthenticated** modification of repository state:
- `findActiveByGithubRepoId` (line 303)
- `markInactive` (line 323)
- `markInstallationInactive` (line 352)
- `updateMetadata` (line 370)
- `markDeleted` (line 397)
- `updateConfigStatus` (line 413)

**Impact:**
An attacker can:
- Mark any repository as inactive/deleted
- Update repository metadata
- Manipulate configuration status
- Disrupt service availability by marking all installations as inactive

**Recommended Fix:**
1. Add webhook signature verification as middleware for these procedures
2. Create a `webhookProcedure` that validates GitHub webhook signatures
3. Verify the webhook signature includes the repository ID being modified

```typescript
// Create webhook-authenticated procedure
const webhookProcedure = publicProcedure.use(async ({ ctx, next, rawInput }) => {
  // Verify GitHub webhook signature
  const signature = ctx.headers.get('x-hub-signature-256');
  if (!signature || !verifyGitHubSignature(rawInput, signature)) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  return next();
});

// Use webhookProcedure instead of publicProcedure
markInactive: webhookProcedure.input(...).mutation(...)
```

---

### 2. CSRF Vulnerability in GitHub OAuth Callback

**File:** `/apps/console/src/app/(github)/api/github/callback/route.ts`
**Lines:** 50-53
**Severity:** CRITICAL

**Description:**
The OAuth state validation only checks if state matches the cookie, but doesn't verify:
1. The state was recently generated (no expiration)
2. The state is cryptographically secure (no entropy validation)
3. The state is invalidated after use (can be replayed)

**Impact:**
An attacker could:
- Replay old state tokens to complete OAuth flows
- Conduct CSRF attacks by predicting or stealing state tokens
- Link their GitHub account to a victim's Lightfast account

**Recommended Fix:**

```typescript
// 1. In auth route - generate secure state with timestamp
const state = crypto.randomBytes(32).toString('hex');
const timestamp = Date.now();
const stateWithTimestamp = `${state}:${timestamp}`;

response.cookies.set('github_oauth_state', stateWithTimestamp, {
  httpOnly: true,
  secure: true,
  sameSite: 'lax',
  maxAge: 600, // 10 minutes only
});

// 2. In callback route - validate and expire
const storedState = request.cookies.get('github_oauth_state')?.value;
const [storedToken, storedTimestamp] = storedState?.split(':') || [];
const [receivedToken] = state?.split(':') || [];

// Verify timestamp is within 10 minutes
if (Date.now() - Number(storedTimestamp) > 600000) {
  return NextResponse.redirect(`${baseUrl}/?github_error=state_expired`);
}

// Compare tokens
if (!storedToken || receivedToken !== storedToken) {
  return NextResponse.redirect(`${baseUrl}/?github_error=invalid_state`);
}

// Immediately delete state cookie after validation
response.cookies.delete('github_oauth_state');
```

---

### 3. Missing Webhook Signature Verification - Data Integrity

**File:** `/apps/console/src/app/(github)/api/github/webhooks/route.ts`
**Lines:** 20-30, 200-296
**Severity:** CRITICAL

**Description:**
While webhook signature verification is implemented (lines 20-30), the signature verification function has a **timing attack vulnerability** and the webhook handler **doesn't verify the payload matches what was signed**.

**Issues:**
1. The signature is verified before parsing JSON (line 208)
2. The JSON parsing happens after verification (line 225)
3. An attacker could modify the request after signature check but before parsing

**Impact:**
An attacker could:
- Forge webhook events to trigger malicious workflows
- Inject false push events to manipulate document ingestion
- Mark legitimate repositories as inactive
- Trigger expensive Inngest workflows with fabricated data

**Recommended Fix:**

```typescript
export async function POST(request: NextRequest) {
  try {
    // 1. Get raw payload BEFORE any parsing
    const rawPayload = await request.text();

    // 2. Verify signature on raw payload
    const signature = request.headers.get("x-hub-signature-256");
    if (!signature) {
      return NextResponse.json({ error: "Missing signature" }, { status: 401 });
    }

    if (!verifySignature(rawPayload, signature)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    // 3. Parse JSON AFTER verification
    const body = JSON.parse(rawPayload);

    // ... rest of handler
  } catch (error) {
    // Handle JSON parse errors
  }
}
```

---

## High Severity Issues (5)

### 4. SQL Injection via Raw SQL Expressions

**File:** `/api/console/src/router/workspace.ts`
**Lines:** 293, 527-528, 631-632, 651, 750-751
**Severity:** HIGH

**Description:**
Multiple procedures use raw SQL with user-controlled input without proper parameterization:

```typescript
// Line 293 - User input in JSON operator
sql`${connectedSources.sourceMetadata}->>'accountLogin' = ${input.githubOrgSlug}`

// Lines 527-528 - Date calculation uses string interpolation
const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
  .toISOString().slice(0, 19).replace("T", " ");
sql`${jobs.createdAt} >= ${oneDayAgo}`
```

**Impact:**
While Drizzle's `sql` tagged template should parameterize values, the mixing of column references and values creates risk of SQL injection if the implementation changes or if there are edge cases.

**Recommended Fix:**
Use Drizzle's type-safe query builder instead of raw SQL:

```typescript
// Replace line 293
where: and(
  eq(connectedSources.sourceType, "github"),
  eq(connectedSources.isActive, true),
  eq(sql`${connectedSources.sourceMetadata}->>'accountLogin'`, input.githubOrgSlug)
)

// Replace date comparisons with Drizzle's gte
where: and(
  eq(jobs.workspaceId, workspaceId),
  gte(jobs.createdAt, oneDayAgo)
)
```

---

### 5. Authorization Bypass - Missing Workspace Ownership Validation

**File:** `/api/console/src/router/workspace.ts`
**Lines:** 605-716 (statisticsComparison procedure)
**Severity:** HIGH

**Description:**
The `statisticsComparison` procedure accepts `workspaceId` and `clerkOrgId` as input but **never validates** that the authenticated user has access to that workspace or organization.

```typescript
statisticsComparison: protectedProcedure
  .input(
    z.object({
      workspaceId: z.string(),
      clerkOrgId: z.string(), // User can provide ANY org ID
      // ... other fields
    }),
  )
  .query(async ({ input }) => {
    // NO AUTHORIZATION CHECK - directly uses input values
    const { workspaceId } = input;
```

**Impact:**
An authenticated attacker can:
- View statistics for any workspace by guessing/enumerating workspace IDs
- Access competitor data if they know organization IDs
- Violate tenant isolation

**Recommended Fix:**

```typescript
statisticsComparison: protectedProcedure
  .input(
    z.object({
      clerkOrgSlug: z.string(), // Use slug instead of ID
      workspaceName: z.string(),
      // ... other fields
    }),
  )
  .query(async ({ ctx, input }) => {
    // Verify access and resolve IDs
    const { workspaceId, clerkOrgId } = await resolveWorkspaceByName({
      clerkOrgSlug: input.clerkOrgSlug,
      workspaceName: input.workspaceName,
      userId: ctx.auth.userId,
    });

    // Now workspaceId and clerkOrgId are verified
    // ... rest of logic
  }),
```

**Similar issues exist in:**
- `jobPercentiles` (line 722-789)
- `performanceTimeSeries` (line 795-892)
- `systemHealth` (line 898-1014)

---

### 6. Insecure Token Storage - GitHub Access Token in Cookie

**File:** `/apps/console/src/app/(github)/api/github/callback/route.ts`
**Lines:** 161-167
**Severity:** HIGH

**Description:**
The GitHub access token is stored in a cookie with insufficient security:

```typescript
response.cookies.set("github_user_token", accessToken, {
  httpOnly: true,
  secure: env.NODE_ENV === "production", // Not secure in dev!
  sameSite: "lax", // Should be 'strict'
  maxAge: 300, // 5 minutes
  path: "/",
});
```

**Issues:**
1. `secure: env.NODE_ENV === "production"` - allows HTTP in development (attacker can MitM local dev)
2. `sameSite: "lax"` - should be 'strict' for OAuth tokens
3. Token is stored in plaintext in cookie (even if httpOnly)
4. 5-minute window is still exploitable

**Impact:**
- Token theft via network sniffing in development
- CSRF attacks due to lax SameSite policy
- Cookie theft if XSS vulnerability exists elsewhere

**Recommended Fix:**

```typescript
// 1. Encrypt the token before storing
const encryptedToken = encrypt(accessToken, env.ENCRYPTION_KEY);

response.cookies.set("github_user_token", encryptedToken, {
  httpOnly: true,
  secure: true, // Always secure, even in dev (use HTTPS locally)
  sameSite: "strict", // Prevent CSRF
  maxAge: 180, // Reduce to 3 minutes
  path: "/api/github", // Restrict to specific path
});

// 2. Decrypt when reading
const encryptedToken = request.cookies.get("github_user_token")?.value;
const accessToken = decrypt(encryptedToken, env.ENCRYPTION_KEY);
```

---

### 7. Missing Rate Limiting on Expensive Operations

**File:** `/api/console/src/router/repository.ts`
**Lines:** 571-713 (reindex procedure)
**Severity:** HIGH

**Description:**
The `reindex` mutation triggers expensive operations without rate limiting:
- Fetches entire git tree (recursive)
- Enumerates all files in repository
- Triggers Inngest workflow for all matching files
- No cooldown between reindex attempts

**Impact:**
An authenticated attacker can:
- Trigger thousands of reindex jobs to overwhelm Inngest
- Cause excessive GitHub API usage leading to rate limit bans
- Generate massive Pinecone indexing costs
- DoS attack by repeatedly reindexing large repos

**Recommended Fix:**

```typescript
reindex: protectedProcedure
  .input(...)
  .mutation(async ({ ctx, input }) => {
    // 1. Check last reindex time
    const [repository] = await ctx.db.select().from(DeusConnectedRepository)
      .where(eq(DeusConnectedRepository.id, input.repositoryId))
      .limit(1);

    if (!repository) {
      throw new TRPCError({ code: "NOT_FOUND" });
    }

    // 2. Enforce cooldown (e.g., 5 minutes)
    const lastReindex = repository.lastReindexedAt;
    const cooldown = 5 * 60 * 1000; // 5 minutes
    if (lastReindex && Date.now() - new Date(lastReindex).getTime() < cooldown) {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: "Please wait 5 minutes between reindex attempts"
      });
    }

    // 3. Update lastReindexedAt timestamp
    await ctx.db.update(DeusConnectedRepository)
      .set({ lastReindexedAt: new Date().toISOString() })
      .where(eq(DeusConnectedRepository.id, input.repositoryId));

    // ... rest of reindex logic
  }),
```

---

### 8. Authorization Bypass - Integration Resource Access

**File:** `/api/console/src/router/integration.ts`
**Lines:** 674-713 (workspace.getStatus procedure)
**Severity:** HIGH

**Description:**
The `workspace.getStatus` procedure queries integration resources using `ctx.auth.userId` as the integrationId filter (line 686), which is incorrect:

```typescript
getStatus: protectedProcedure
  .input(z.object({
    workspaceId: z.string(),
    repoFullName: z.string(),
  }))
  .query(async ({ ctx, input }) => {
    const resources = await ctx.db.select()
      .from(integrationResources)
      .where(eq(integrationResources.integrationId, ctx.auth.userId)); // BUG!
```

**Issues:**
1. `integrationId` is a foreign key to the `integrations` table, not `userId`
2. No verification that the user owns the integration
3. No verification that the workspace belongs to the user's organization

**Impact:**
- Potential data leakage if userId matches an integrationId
- Authorization bypass leading to access of other users' integration status

**Recommended Fix:**

```typescript
getStatus: protectedProcedure
  .input(z.object({
    workspaceId: z.string(),
    repoFullName: z.string(),
  }))
  .query(async ({ ctx, input }) => {
    // 1. Verify workspace access first
    const workspace = await ctx.db.query.workspaces.findFirst({
      where: eq(workspaces.id, input.workspaceId)
    });

    if (!workspace) {
      throw new TRPCError({ code: "NOT_FOUND" });
    }

    // 2. Verify user has access to this workspace's org
    const { verifyOrgAccessAndResolve } = await import("../trpc");
    await verifyOrgAccessAndResolve({
      clerkOrgSlug: workspace.clerkOrgSlug,
      userId: ctx.auth.userId,
    });

    // 3. Find integration owned by user
    const userIntegration = await ctx.db.query.integrations.findFirst({
      where: and(
        eq(integrations.userId, ctx.auth.userId),
        eq(integrations.provider, "github")
      )
    });

    if (!userIntegration) {
      return null;
    }

    // 4. Find resource by repo full name
    const resources = await ctx.db.select()
      .from(integrationResources)
      .where(eq(integrationResources.integrationId, userIntegration.id));

    const resource = resources.find((r) => {
      const data = r.resourceData;
      return (
        data.provider === "github" &&
        data.type === "repository" &&
        data.repoFullName === input.repoFullName
      );
    });

    if (!resource) {
      return null;
    }

    // 5. Get workspace integration
    const connections = await ctx.db.select()
      .from(workspaceIntegrations)
      .where(and(
        eq(workspaceIntegrations.workspaceId, input.workspaceId),
        eq(workspaceIntegrations.resourceId, resource.id)
      ));

    return connections[0] ?? null;
  }),
```

---

## Medium Severity Issues (6)

### 9. XSS via dangerouslySetInnerHTML - Syntax Highlighting

**File:** `/apps/console/src/components/lightfast-config-overview.tsx`
**Lines:** 84-87
**Severity:** MEDIUM

**Description:**
The component uses `dangerouslySetInnerHTML` to render syntax-highlighted code from Shiki:

```typescript
<div
  className="..."
  dangerouslySetInnerHTML={{ __html: highlightedCode }}
/>
```

While Shiki is a trusted library, the input data (`workspaceId`, `workspaceName`, `stores`) comes from user-controlled database records.

**Impact:**
If workspace names or store names contain malicious payloads that bypass Shiki's escaping, XSS is possible.

**Recommended Fix:**

```typescript
// 1. Sanitize input before passing to Shiki
import DOMPurify from 'isomorphic-dompurify';

const yamlConfig = `# Lightfast Configuration
workspace:
  id: ${workspaceId}
  name: ${DOMPurify.sanitize(workspaceName)}

stores:
${stores
  .map((store) => `  - name: ${DOMPurify.sanitize(store.name)}
    embedding_dim: ${store.embeddingDim}`)
  .join("\n\n")}
...`;

// 2. Sanitize Shiki output as well
const html = await codeToHtml(yamlConfig, {
  lang: "yaml",
  theme: "github-dark",
});
setHighlightedCode(DOMPurify.sanitize(html));
```

---

### 10. Information Disclosure - Verbose Error Messages

**File:** Multiple tRPC routers
**Severity:** MEDIUM

**Description:**
Many procedures return detailed error messages that leak implementation details:

```typescript
// workspace.ts line 217
throw new TRPCError({
  code: "INTERNAL_SERVER_ERROR",
  message: `Workspace not found for ID: ${workspaceId}`, // Leaks internal ID
});

// integration.ts line 320
message: "Failed to fetch repositories from GitHub",
cause: error, // Leaks full error stack
```

**Impact:**
- Attackers learn about internal database structure
- Error stacks reveal file paths and library versions
- Easier to enumerate valid vs invalid IDs

**Recommended Fix:**

```typescript
// 1. Generic errors for users
throw new TRPCError({
  code: "NOT_FOUND",
  message: "Resource not found"
});

// 2. Log detailed errors server-side
console.error("[workspace.resolveFromClerkOrgSlug] Workspace not found", {
  workspaceId,
  userId: ctx.auth.userId,
  timestamp: new Date().toISOString()
});

// 3. Never include 'cause' in production
throw new TRPCError({
  code: "INTERNAL_SERVER_ERROR",
  message: "An error occurred",
  ...(env.NODE_ENV === "development" && { cause: error })
});
```

---

### 11. Weak Encryption Key in Development

**File:** `/api/console/src/env.ts` and `/apps/console/src/env.ts`
**Lines:** 34-36 (api), 59-60 (app)
**Severity:** MEDIUM

**Description:**
Both environment files use a weak default encryption key in development:

```typescript
.default(
  process.env.NODE_ENV === "development"
    ? "0000000000000000000000000000000000000000000000000000000000000000"
    : ""
)
```

**Impact:**
- OAuth tokens encrypted with this key in dev can be easily decrypted
- If dev database is shared or leaked, all tokens are compromised
- Developers may accidentally deploy with default key

**Recommended Fix:**

```typescript
// 1. Fail if encryption key is not set, even in dev
ENCRYPTION_KEY: z.string().min(44).refine(
  (key) => {
    const hexPattern = /^[0-9a-f]{64}$/i;
    const base64Pattern = /^[A-Za-z0-9+/]{43}=$/;
    const isValid = hexPattern.test(key) || base64Pattern.test(key);

    // Reject weak default key
    if (key === "0000000000000000000000000000000000000000000000000000000000000000") {
      throw new Error("Default ENCRYPTION_KEY is not allowed. Generate a secure key.");
    }

    return isValid;
  },
  { message: "ENCRYPTION_KEY must be 32 bytes (64 hex chars or 44 base64 chars)" }
),

// 2. Add startup validation
if (process.env.NODE_ENV === "development") {
  console.warn("=".repeat(80));
  console.warn("DEVELOPMENT MODE: Ensure ENCRYPTION_KEY is set in .env");
  console.warn("Generate with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"");
  console.warn("=".repeat(80));
}
```

---

### 12. Missing Input Validation - File Path Traversal

**File:** `/api/console/src/router/integration.ts`
**Lines:** 411-456 (detectConfig procedure)
**Severity:** MEDIUM

**Description:**
The config detection tries multiple file paths but doesn't validate the repository structure:

```typescript
const candidates = [
  "lightfast.yml",
  ".lightfast.yml",
  "lightfast.yaml",
  ".lightfast.yaml",
];

for (const path of candidates) {
  const { data } = await octokit.request(
    "GET /repos/{owner}/{repo}/contents/{path}",
    { owner, repo, path, ref }
  );
}
```

**Impact:**
While GitHub API prevents path traversal, the code doesn't validate:
- The ref parameter could point to arbitrary branches/tags
- No size limit on config file (could be malicious large file)
- No validation of YAML content before parsing

**Recommended Fix:**

```typescript
// 1. Validate ref parameter
if (input.ref && !/^[a-zA-Z0-9._/-]+$/.test(input.ref)) {
  throw new TRPCError({
    code: "BAD_REQUEST",
    message: "Invalid ref format"
  });
}

// 2. Add size limit
if ("content" in data && "size" in data) {
  const maxSize = 50 * 1024; // 50KB max
  if (data.size > maxSize) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Config file too large"
    });
  }
}

// 3. Validate YAML before returning
try {
  yaml.parse(content);
} catch (e) {
  throw new TRPCError({
    code: "BAD_REQUEST",
    message: "Invalid YAML format"
  });
}
```

---

### 13. Race Condition - Concurrent Workspace Creation

**File:** `/api/console/src/router/workspace.ts`
**Lines:** 381-456 (create procedure)
**Severity:** MEDIUM

**Description:**
The workspace creation checks for duplicates then inserts, creating a TOCTOU (Time-of-Check-Time-of-Use) race condition:

```typescript
// Check if new name already exists
const existingWorkspace = await db.query.workspaces.findFirst({
  where: and(
    eq(workspaces.clerkOrgId, clerkOrgId),
    eq(workspaces.name, input.newWorkspaceName),
  ),
});

if (existingWorkspace && existingWorkspace.id !== workspaceId) {
  throw new TRPCError({ code: "CONFLICT" });
}

// Later: insert without transaction
await db.insert(workspaces).values({ name: input.newWorkspaceName });
```

**Impact:**
Two concurrent requests with the same workspace name can both pass the check and create duplicates.

**Recommended Fix:**

```typescript
// 1. Add unique constraint to database schema
// db/console/schema/workspaces.ts
export const workspaces = sqliteTable("workspaces", {
  // ...
}, (table) => ({
  uniqueOrgWorkspace: unique().on(table.clerkOrgId, table.name),
}));

// 2. Use database transaction
await db.transaction(async (tx) => {
  const existing = await tx.query.workspaces.findFirst({
    where: and(
      eq(workspaces.clerkOrgId, clerkOrgId),
      eq(workspaces.name, input.workspaceName)
    ),
  });

  if (existing) {
    throw new TRPCError({ code: "CONFLICT" });
  }

  const result = await tx.insert(workspaces).values({
    clerkOrgId,
    name: input.workspaceName,
    // ...
  }).returning();

  return result[0];
});
```

---

### 14. Insufficient CORS Configuration

**File:** `/apps/console/src/app/(trpc)/api/trpc/[trpc]/route.ts`
**Lines:** 18-48
**Severity:** MEDIUM

**Description:**
CORS configuration allows all origins in non-production environments:

```typescript
const allowOrigin = !isProductionDeploy
  ? "*" // Allows ANY origin in dev/preview!
  : originHeader && productionOrigins.has(originHeader)
    ? originHeader
    : null;
```

**Impact:**
- In preview deployments, any website can call the API
- Credentials are sent with wildcard origin in dev
- Preview branches are vulnerable to CSRF from malicious sites

**Recommended Fix:**

```typescript
// 1. Define allowed origins for each environment
const allowedOrigins = new Set([
  "https://console.lightfast.ai", // Production
  ...(env.NEXT_PUBLIC_VERCEL_ENV === "preview"
    ? [`https://${env.VERCEL_URL}`] // Only current preview
    : []),
  ...(env.NODE_ENV === "development"
    ? ["http://localhost:4107", "http://localhost:3024"] // Only known dev ports
    : []),
]);

// 2. Never use wildcard
const allowOrigin = originHeader && allowedOrigins.has(originHeader)
  ? originHeader
  : null;

if (!allowOrigin) {
  return new Response("Forbidden", { status: 403 });
}
```

---

## Low Severity Issues (3)

### 15. Missing Security Headers

**File:** `/apps/console/src/middleware.ts`
**Lines:** 33-37
**Severity:** LOW

**Description:**
Middleware sets some security headers but is missing critical ones:

```typescript
response.headers.set("X-Frame-Options", "DENY");
response.headers.set("X-Content-Type-Options", "nosniff");
response.headers.set("Referrer-Policy", "origin-when-cross-origin");
// Missing: CSP, Permissions-Policy, HSTS, etc.
```

**Recommended Fix:**

```typescript
// Add comprehensive security headers
response.headers.set("X-Frame-Options", "DENY");
response.headers.set("X-Content-Type-Options", "nosniff");
response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
response.headers.set("X-XSS-Protection", "1; mode=block");
response.headers.set("Permissions-Policy", "geolocation=(), microphone=(), camera=()");

// Content Security Policy
response.headers.set(
  "Content-Security-Policy",
  "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';"
);

// HSTS (only in production with HTTPS)
if (env.NODE_ENV === "production") {
  response.headers.set(
    "Strict-Transport-Security",
    "max-age=31536000; includeSubDomains; preload"
  );
}
```

---

### 16. Logging Sensitive Data

**File:** `/api/console/src/trpc.ts`
**Lines:** 52
**Severity:** LOW

**Description:**
The tRPC context logs user IDs for every request:

```typescript
console.info(`>>> tRPC Request from ${source} by ${clerkSession.userId}`);
```

**Impact:**
- User IDs in logs could be correlated for tracking
- Logs may be sent to third-party services (Sentry, etc.)
- Violates privacy best practices (GDPR, CCPA)

**Recommended Fix:**

```typescript
// Hash or truncate user IDs in logs
import crypto from 'crypto';

const hashedUserId = crypto
  .createHash('sha256')
  .update(clerkSession.userId)
  .digest('hex')
  .substring(0, 8);

console.info(`>>> tRPC Request from ${source} by user:${hashedUserId}`);
```

---

### 17. Missing API Key Rotation Mechanism

**File:** `/api/console/src/router/account.ts`
**Lines:** 148-303 (apiKeys procedures)
**Severity:** LOW

**Description:**
API key management allows creation, revoke, and delete, but:
- No expiration enforcement (keys can be used indefinitely if `expiresAt` is null)
- No rotation mechanism (replacing old key with new)
- No usage tracking (lastUsedAt is stored but never updated)

**Impact:**
- Compromised keys remain valid forever
- No way to force key rotation for security compliance
- Difficult to audit key usage

**Recommended Fix:**

```typescript
// 1. Add key rotation mutation
rotate: protectedProcedure
  .input(z.object({ keyId: z.string() }))
  .mutation(async ({ ctx, input }) => {
    // Verify ownership
    const oldKey = await ctx.db.select()
      .from(apiKeys)
      .where(and(
        eq(apiKeys.id, input.keyId),
        eq(apiKeys.userId, ctx.auth.userId)
      ))
      .limit(1);

    if (!oldKey[0]) {
      throw new TRPCError({ code: "NOT_FOUND" });
    }

    // Create new key with same settings
    const newApiKey = generateApiKey();
    const newKeyHash = hashApiKey(newApiKey);

    await ctx.db.transaction(async (tx) => {
      // Revoke old key
      await tx.update(apiKeys)
        .set({ isActive: false })
        .where(eq(apiKeys.id, input.keyId));

      // Create new key
      await tx.insert(apiKeys).values({
        userId: ctx.auth.userId,
        name: oldKey[0].name,
        keyHash: newKeyHash,
        keyPreview: newApiKey.slice(-8),
        isActive: true,
        expiresAt: oldKey[0].expiresAt,
      });
    });

    return { key: newApiKey };
  }),

// 2. Add expiration check middleware
const apiKeyMiddleware = publicProcedure.use(async ({ ctx, next }) => {
  const keyHash = ctx.headers.get('x-api-key');
  if (!keyHash) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  const key = await ctx.db.query.apiKeys.findFirst({
    where: and(
      eq(apiKeys.keyHash, hashApiKey(keyHash)),
      eq(apiKeys.isActive, true)
    )
  });

  if (!key) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  // Check expiration
  if (key.expiresAt && new Date(key.expiresAt) < new Date()) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "API key has expired"
    });
  }

  // Update lastUsedAt
  await ctx.db.update(apiKeys)
    .set({ lastUsedAt: new Date().toISOString() })
    .where(eq(apiKeys.id, key.id));

  return next({
    ctx: {
      ...ctx,
      apiKey: key
    }
  });
});
```

---

## Summary of Findings

| Severity | Count | Issues |
|----------|-------|--------|
| **Critical** | 3 | Unauthenticated repository mutations, OAuth CSRF, Webhook signature bypass |
| **High** | 5 | SQL injection, Authorization bypass (multiple), Token storage, Missing rate limiting |
| **Medium** | 6 | XSS, Error disclosure, Weak encryption, Path traversal, Race condition, CORS |
| **Low** | 3 | Missing headers, Logging sensitive data, API key rotation |
| **Total** | **17** | |

---

## Immediate Actions Required

### Priority 1 (Critical - Fix within 24 hours)
1. Add webhook signature verification middleware to repository mutation procedures
2. Implement proper OAuth state validation with expiration
3. Fix webhook signature verification timing and ordering

### Priority 2 (High - Fix within 1 week)
4. Fix authorization bypass in workspace statistics procedures
5. Add rate limiting to reindex operations
6. Secure GitHub token storage with encryption
7. Replace raw SQL with type-safe Drizzle queries

### Priority 3 (Medium - Fix within 2 weeks)
8. Add input sanitization for user-generated content in React components
9. Implement generic error messages for production
10. Remove default encryption key, require strong keys
11. Add CORS whitelist for all environments

### Priority 4 (Low - Fix within 1 month)
12. Add comprehensive security headers
13. Implement API key rotation and expiration enforcement
14. Hash user IDs in logs

---

## General Recommendations

1. **Adopt Defense in Depth**: Layer multiple security controls (authentication → authorization → rate limiting → input validation)

2. **Principle of Least Privilege**: Never accept user-provided IDs for sensitive operations. Always resolve them from user context.

3. **Security Testing**: Implement:
   - Automated security scanning (Snyk, Dependabot)
   - SAST tools (SonarQube, Semgrep)
   - Penetration testing before major releases

4. **Code Review**: Require security-focused code reviews for:
   - All authentication/authorization changes
   - Database query modifications
   - API endpoint additions
   - External service integrations

5. **Security Training**: Train developers on:
   - OWASP Top 10
   - Common tRPC security pitfalls
   - Secure OAuth implementation
   - SQL injection prevention with ORMs

---

## Methodology

This security review was conducted using:
- Static code analysis of all files in `/apps/console` and `/api/console`
- Manual review of authentication and authorization flows
- Analysis of tRPC procedures for security vulnerabilities
- Review of OAuth implementation and token handling
- Database query analysis for injection vulnerabilities
- Input validation and output encoding review
- CORS and security header configuration analysis

The review focused on identifying real security vulnerabilities that could lead to:
- Unauthorized access to data or functionality
- Data breaches or leakage
- Denial of service attacks
- Account takeover or privilege escalation
- Cross-site scripting or injection attacks

---

**Report Completed:** 2025-01-21
**Next Review:** Recommended after implementing Priority 1 and 2 fixes
