# GitHub Integration Architecture V2: Using source-connections.ts

**Date:** 2025-11-19
**Purpose:** Correct architecture using existing `source-connections.ts` tables instead of creating new tables

---

## The Existing Architecture (source-connections.ts)

The `source-connections.ts` file already defines a Vercel-like multi-provider integration system:

### Table Structure

```
integrations (Personal OAuth)
    ↓
organizationIntegrations (Org Authorization)
    ↓
integrationResources (Specific Resources)
    ↓
workspaceIntegrations (Workspace Connection)
```

**Design Philosophy:**
1. User connects to provider personally (OAuth)
2. User authorizes that connection for use in organization
3. System discovers resources from that connection (repos, teams, etc.)
4. User connects specific resources to workspaces

This is **exactly the Vercel pattern**!

---

## The Missing Piece: GitHub App Installations

### The Problem

GitHub has a **two-level hierarchy** that the current schema doesn't capture:

```
User OAuth Token
    ↓
GitHub App Installations (one per org/account)
    ↓
Repositories (many per installation)
```

**Current Schema:**
```
integrations (OAuth token)
    ↓
integrationResources (repositories)  ❌ MISSING: Installations!
```

The schema jumps directly from OAuth token to repositories, but it doesn't store **installations** (the GitHub App installed on orgs).

### Why This Matters

- User can have **multiple GitHub App installations** (personal + orgs)
- Each installation has its own set of repositories
- Installation ID is needed to create installation tokens
- Installation data (org name, avatar, permissions) is useful for UX

---

## Solution: Extend providerData to Include Installations

### Option 1: Store Installations in providerData (RECOMMENDED)

**Extend the `integrations` table's `providerData` field:**

```typescript
// Current GitHub integration providerData
{
  provider: "github",
  // OAuth returns NO repo/org data - just the token
}

// NEW: Include installations
{
  provider: "github",
  installations: [
    {
      id: string,                    // GitHub installation ID
      accountId: string,             // GitHub account/org ID
      accountLogin: string,          // "acme-corp"
      accountType: "User" | "Organization",
      avatarUrl: string,
      permissions: Record<string, string>,
      installedAt: string,           // ISO timestamp
      lastValidatedAt: string        // ISO timestamp
    }
  ]
}
```

**Benefits:**
- ✅ No new tables needed
- ✅ Installations stored with OAuth token (they belong together)
- ✅ Easy to query all installations for a user
- ✅ JSONB allows flexible schema evolution

**Drawbacks:**
- ⚠️ Can't query installations separately
- ⚠️ Must load entire integration to get installations
- ⚠️ No referential integrity on installation ID

### Option 2: Create New githubInstallations Table

**Add a new table linked to integrations:**

```typescript
export const githubInstallations = pgTable(
  "lightfast_github_installations",
  {
    id: varchar("id", { length: 191 }).notNull().primaryKey().$defaultFn(() => nanoid()),

    // FK to personal integration
    integrationId: varchar("integration_id", { length: 191 })
      .notNull()
      .references(() => integrations.id, { onDelete: "cascade" }),

    // GitHub installation data
    githubInstallationId: varchar("github_installation_id", { length: 191 }).notNull(),
    githubAccountId: varchar("github_account_id", { length: 191 }).notNull(),
    accountLogin: varchar("account_login", { length: 191 }).notNull(),
    accountType: varchar("account_type", { length: 20 }).notNull(), // "User" | "Organization"
    avatarUrl: varchar("avatar_url", { length: 500 }),
    permissions: jsonb("permissions"),

    // Status
    isActive: boolean("is_active").notNull().default(true),

    // Timestamps
    installedAt: timestamp("installed_at").notNull(),
    lastValidatedAt: timestamp("last_validated_at").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    integrationIdIdx: index("gh_install_integration_id_idx").on(table.integrationId),
    githubInstallationIdIdx: index("gh_install_github_id_idx").on(table.githubInstallationId),
    // Unique: one installation per integration
    uniqueInstallationIdx: index("gh_install_unique_idx").on(
      table.integrationId,
      table.githubInstallationId
    ),
  })
);
```

**Benefits:**
- ✅ Queryable installations independently
- ✅ Referential integrity
- ✅ Easier to index and search
- ✅ Clear separation of concerns

**Drawbacks:**
- ⚠️ Additional table complexity
- ⚠️ GitHub-specific table (not provider-agnostic)

### Option 3: Store Installation ID in integrationResources

**Add `installationId` field to each repository resource:**

```typescript
{
  provider: "github",
  type: "repository",
  installationId: string,        // NEW: Which installation this repo belongs to
  repoId: string,
  repoName: string,
  repoFullName: string,
  // ...
}
```

**Benefits:**
- ✅ No new tables
- ✅ Installation ID available when querying repos

**Drawbacks:**
- ❌ Duplication (installation ID stored in every repo)
- ❌ No way to get list of installations without loading repos
- ❌ Can't manage installations separately from repos

---

## Recommended Architecture: Hybrid Approach

**Combine Option 1 (providerData) + Option 3 (resources)**

### 1. Store Installations in integrations.providerData

```typescript
// integrations table
{
  id: "int_abc123",
  userId: "user_xyz",
  provider: "github",
  accessToken: "gho_...",           // Encrypted
  refreshToken: "ghr_...",          // Encrypted
  tokenExpiresAt: "2025-12-01",
  providerData: {
    provider: "github",
    installations: [
      {
        id: "12345678",
        accountId: "98765",
        accountLogin: "acme-corp",
        accountType: "Organization",
        avatarUrl: "https://...",
        permissions: { metadata: "read", contents: "read" },
        installedAt: "2025-01-15T10:00:00Z",
        lastValidatedAt: "2025-11-19T15:30:00Z"
      }
    ]
  },
  isActive: true,
  connectedAt: "2025-01-15T10:00:00Z"
}
```

### 2. Store Installation ID in integrationResources

```typescript
// integrationResources table
{
  id: "res_def456",
  integrationId: "int_abc123",     // FK to integrations
  resourceData: {
    provider: "github",
    type: "repository",
    installationId: "12345678",    // Which installation this repo belongs to
    repoId: "234567890",
    repoName: "frontend",
    repoFullName: "acme-corp/frontend",
    defaultBranch: "main",
    isPrivate: true,
    isArchived: false
  },
  lastSyncedAt: "2025-11-19T15:00:00Z"
}
```

### 3. Link to Workspaces via workspaceIntegrations

```typescript
// workspaceIntegrations table (unchanged)
{
  id: "wi_ghi789",
  workspaceId: "ws_jkl012",        // FK to workspaces
  resourceId: "res_def456",        // FK to integrationResources
  connectedByUserId: "user_xyz",
  syncConfig: {
    branches: ["main", "develop"],
    paths: ["**/*.ts", "**/*.tsx"],
    autoSync: true
  },
  isActive: true,
  lastSyncedAt: "2025-11-19T15:00:00Z"
}
```

---

## Complete Flow: Vercel-Like UX

### Step 1: User Connects GitHub (OAuth)

**Endpoint:** `/api/github/auth` + `/api/github/callback`

**Actions:**
1. User clicks "Connect GitHub"
2. OAuth flow completes → receive `access_token`
3. **Call GitHub API:** `GET /user/installations` using OAuth token
4. **Create or update** `integrations` record:
   ```typescript
   {
     userId: clerkUserId,
     provider: "github",
     accessToken: encryptToken(token),  // Encrypted!
     providerData: {
       provider: "github",
       installations: githubInstallations.map(i => ({
         id: String(i.id),
         accountId: String(i.account.id),
         accountLogin: i.account.login,
         accountType: i.account.type,
         avatarUrl: i.account.avatar_url,
         permissions: i.permissions,
         installedAt: new Date().toISOString(),
         lastValidatedAt: new Date().toISOString()
       }))
     },
     connectedAt: new Date()
   }
   ```

**Result:** User's GitHub connection + all installations stored in one row!

### Step 2: User Authorizes for Organization

**Endpoint:** `/api/integrations/authorize` (tRPC)

**Actions:**
1. User navigates to `/settings/integrations` (or during onboarding)
2. Selects their GitHub connection
3. Chooses which Clerk organization to authorize it for
4. **Create** `organizationIntegrations` record:
   ```typescript
   {
     integrationId: "int_abc123",
     clerkOrgId: "org_xyz",
     authorizedBy: "user_xyz",
     isActive: true,
     authorizedAt: new Date()
   }
   ```

**Result:** Personal GitHub connection now authorized for use in organization!

### Step 3: User Selects Installation + Repositories

**Page:** `/new` (repository import)

**Actions:**
1. Load user's GitHub integration from database
2. Extract installations from `providerData.installations`
3. Show dropdown: "Select GitHub Organization"
4. When org selected, fetch repositories from GitHub API:
   ```typescript
   const integration = await db.query.integrations.findFirst({
     where: and(
       eq(integrations.userId, userId),
       eq(integrations.provider, "github"),
       eq(integrations.isActive, true)
     )
   });

   const selectedInstallation = integration.providerData.installations.find(
     i => i.id === selectedInstallationId
   );

   // Create GitHub App installation token
   const repos = await getInstallationRepositories(
     app,
     selectedInstallation.id
   );
   ```
5. Display repositories to user
6. User selects repository to import

### Step 4: Store Repository as Resource

**Endpoint:** `/api/integrations/resources/create` (tRPC)

**Actions:**
1. User clicks "Import" on a repository
2. **Create** `integrationResources` record:
   ```typescript
   {
     integrationId: integration.id,
     resourceData: {
       provider: "github",
       type: "repository",
       installationId: selectedInstallation.id,  // Important!
       repoId: String(repo.id),
       repoName: repo.name,
       repoFullName: repo.full_name,
       defaultBranch: repo.default_branch,
       isPrivate: repo.private,
       isArchived: repo.archived
     },
     lastSyncedAt: new Date()
   }
   ```

**Result:** Repository saved as a resource!

### Step 5: Connect Resource to Workspace

**Endpoint:** `/api/integrations/workspace/connect` (tRPC)

**Actions:**
1. User configures sync settings (branches, paths, etc.)
2. **Create** `workspaceIntegrations` record:
   ```typescript
   {
     workspaceId: defaultWorkspaceId,
     resourceId: resource.id,
     connectedByUserId: userId,
     syncConfig: {
       branches: ["main"],
       paths: ["**/*"],
       autoSync: true
     },
     isActive: true,
     connectedAt: new Date()
   }
   ```

**Result:** Repository now connected to workspace and will be ingested!

---

## Key Queries

### Get User's GitHub Installations

```typescript
const integration = await db.query.integrations.findFirst({
  where: and(
    eq(integrations.userId, userId),
    eq(integrations.provider, "github"),
    eq(integrations.isActive, true)
  )
});

const installations = integration?.providerData.installations ?? [];
```

### Get All Repositories for an Installation

```typescript
const resources = await db.query.integrationResources.findMany({
  where: and(
    eq(integrationResources.integrationId, integrationId),
    sql`${integrationResources.resourceData}->>'installationId' = ${installationId}`
  )
});
```

### Get All Connected Repositories in Workspace

```typescript
const connectedRepos = await db
  .select({
    resource: integrationResources,
    workspace: workspaceIntegrations
  })
  .from(workspaceIntegrations)
  .innerJoin(
    integrationResources,
    eq(workspaceIntegrations.resourceId, integrationResources.id)
  )
  .where(
    and(
      eq(workspaceIntegrations.workspaceId, workspaceId),
      eq(workspaceIntegrations.isActive, true)
    )
  );
```

### Validate Installation Ownership

```typescript
async function validateInstallationOwnership(
  userId: string,
  installationId: string
): Promise<boolean> {
  const integration = await db.query.integrations.findFirst({
    where: and(
      eq(integrations.userId, userId),
      eq(integrations.provider, "github"),
      eq(integrations.isActive, true)
    )
  });

  if (!integration) return false;

  const installation = integration.providerData.installations?.find(
    i => i.id === installationId
  );

  return !!installation;
}
```

---

## Migration from Current System

### Current System

```
DeusConnectedRepository
- githubRepoId
- githubInstallationId  ← Installation ID stored here
- clerkOrgId
- workspaceId
```

### New System

```
integrations (user's GitHub OAuth + installations)
    ↓
integrationResources (individual repos with installationId)
    ↓
workspaceIntegrations (repos connected to workspaces)
```

### Migration Steps

1. **For each unique user with connected repos:**
   - Create `integrations` record with GitHub OAuth
   - Fetch `/user/installations` and store in `providerData`

2. **For each connected repository:**
   - Create `integrationResources` record
   - Include `installationId` from `DeusConnectedRepository.githubInstallationId`

3. **For each repository-workspace connection:**
   - Create `workspaceIntegrations` record
   - Link resource to workspace

4. **Gradually migrate users:**
   - Keep `DeusConnectedRepository` for backwards compatibility
   - New connections use new system
   - Migrate existing users on next login

---

## Schema Updates Needed

### Update integrations providerData Type

```typescript
// db/console/src/schema/tables/source-connections.ts

providerData: jsonb("provider_data").$type<
  | {
      provider: "github";
      installations?: {                    // NEW
        id: string;
        accountId: string;
        accountLogin: string;
        accountType: "User" | "Organization";
        avatarUrl: string;
        permissions: Record<string, string>;
        installedAt: string;
        lastValidatedAt: string;
      }[];
    }
  | {
      provider: "notion";
      workspaceId: string;
      workspaceName: string;
      // ...
    }
  // ...
>().notNull(),
```

### Update integrationResources resourceData Type

```typescript
resourceData: jsonb("resource_data").$type<
  | {
      provider: "github";
      type: "repository";
      installationId: string;              // NEW
      repoId: string;
      repoName: string;
      repoFullName: string;
      defaultBranch: string;
      isPrivate: boolean;
      isArchived: boolean;
    }
  // ...
>().notNull(),
```

---

## Security Considerations

### Token Encryption

**CRITICAL:** The `integrations.accessToken` field MUST be encrypted at the application layer.

```typescript
import { encrypt, decrypt } from "@repo/lib/encryption";

// When storing
const encrypted = encrypt(token, process.env.ENCRYPTION_KEY);
await db.insert(integrations).values({
  accessToken: encrypted,
  // ...
});

// When retrieving
const integration = await db.query.integrations.findFirst(/* ... */);
const token = decrypt(integration.accessToken, process.env.ENCRYPTION_KEY);
```

**Environment Variable:**
```bash
ENCRYPTION_KEY=your-32-char-random-string  # Store in Vercel/secure vault
```

### Installation Validation

**Always validate** that the user owns the installation before using it:

```typescript
async function getInstallationToken(userId: string, installationId: string) {
  // 1. Verify ownership
  const hasAccess = await validateInstallationOwnership(userId, installationId);
  if (!hasAccess) {
    throw new Error("Unauthorized: User does not own this installation");
  }

  // 2. Create installation token
  const token = await app.getInstallationAccessToken({
    installationId: Number(installationId)
  });

  return token;
}
```

### Periodic Validation

**Re-validate installations** periodically (every 24 hours):

```typescript
async function validateAndUpdateInstallations(userId: string) {
  const integration = await db.query.integrations.findFirst({
    where: and(
      eq(integrations.userId, userId),
      eq(integrations.provider, "github")
    )
  });

  if (!integration) return;

  // Check if validation needed
  const lastValidated = integration.providerData.installations?.[0]?.lastValidatedAt;
  const needsValidation = !lastValidated ||
    Date.now() - new Date(lastValidated).getTime() > 24 * 60 * 60 * 1000;

  if (!needsValidation) return;

  // Fetch fresh data from GitHub
  const token = decrypt(integration.accessToken, process.env.ENCRYPTION_KEY);
  const { installations } = await getUserInstallations(token);

  // Update providerData
  await db
    .update(integrations)
    .set({
      providerData: {
        provider: "github",
        installations: installations.map(i => ({
          id: String(i.id),
          accountId: String(i.account.id),
          accountLogin: i.account.login,
          accountType: i.account.type,
          avatarUrl: i.account.avatar_url,
          permissions: i.permissions,
          installedAt: integration.providerData.installations?.find(
            existing => existing.id === String(i.id)
          )?.installedAt ?? new Date().toISOString(),
          lastValidatedAt: new Date().toISOString()
        }))
      }
    })
    .where(eq(integrations.id, integration.id));
}
```

---

## Implementation Checklist

### Phase 1: Schema Updates

- [ ] Update `integrations.providerData` type to include `installations`
- [ ] Update `integrationResources.resourceData` type to include `installationId`
- [ ] Generate migration
- [ ] Run migration

### Phase 2: OAuth Flow

- [ ] Update `/api/github/callback` to fetch installations
- [ ] Store installations in `integrations.providerData`
- [ ] Encrypt access token before storing
- [ ] Create or update integration record

### Phase 3: tRPC Endpoints

- [ ] `integration.github.list` - List user's GitHub integration + installations
- [ ] `integration.github.validate` - Re-validate installations from GitHub
- [ ] `integration.github.repositories` - Fetch repos for installation
- [ ] `integration.resources.create` - Store repository as resource
- [ ] `integration.workspace.connect` - Connect resource to workspace

### Phase 4: Frontend

- [ ] Update `/new` to load installations from database
- [ ] Show installation dropdown (org selector)
- [ ] Fetch repositories for selected installation
- [ ] Import flow creates resource + workspace connection

### Phase 5: Migration

- [ ] Script to backfill existing `DeusConnectedRepository` → new tables
- [ ] Test migration on dev database
- [ ] Run migration on production with feature flag

---

## Comparison: Old vs New

### Old System (DeusConnectedRepository)

```typescript
{
  id: "repo_123",
  githubRepoId: "234567890",
  githubInstallationId: "12345678",
  clerkOrgId: "org_xyz",
  workspaceId: "ws_abc",
  // ...
}
```

**Limitations:**
- ❌ No user-level GitHub connection
- ❌ No installation management
- ❌ Can't see available installations without connecting repo
- ❌ Tied to Clerk org (not user)
- ❌ GitHub-specific table (not reusable for other providers)

### New System (source-connections)

```typescript
// User's personal GitHub connection
integrations: {
  userId: "user_xyz",
  provider: "github",
  accessToken: "encrypted...",
  providerData: {
    installations: [
      { id: "12345678", accountLogin: "acme-corp", ... },
      { id: "87654321", accountLogin: "personal", ... }
    ]
  }
}

// Repository as resource
integrationResources: {
  integrationId: "int_abc",
  resourceData: {
    provider: "github",
    installationId: "12345678",
    repoId: "234567890",
    repoFullName: "acme-corp/frontend"
  }
}

// Connection to workspace
workspaceIntegrations: {
  workspaceId: "ws_abc",
  resourceId: "res_def",
  connectedByUserId: "user_xyz"
}
```

**Benefits:**
- ✅ User-level connection (Vercel pattern)
- ✅ Installation management built-in
- ✅ Can see all installations before connecting repos
- ✅ Not tied to Clerk org (user can authorize for multiple orgs)
- ✅ Provider-agnostic (works for GitHub, Notion, Linear, Sentry)
- ✅ Flexible sync configuration per workspace

---

## Conclusion

**Use the existing `source-connections.ts` architecture!**

**Key Changes:**
1. Store installations in `integrations.providerData.installations` (JSONB array)
2. Store `installationId` in `integrationResources.resourceData`
3. Keep the rest of the flow as designed

**Result:**
- ✅ Vercel-like UX (one OAuth, persistent access)
- ✅ Multi-organization support
- ✅ Provider-agnostic architecture
- ✅ No new tables needed
- ✅ Leverages existing well-designed schema

**Next Steps:**
1. Update TypeScript types for `providerData` and `resourceData`
2. Implement OAuth callback to store installations
3. Build tRPC endpoints for integration management
4. Update frontend to use new flow
5. Migrate existing repositories to new system

---

**Document Status:** Ready for Implementation
**Last Updated:** 2025-11-19
**Author:** Claude Code
**Reviewers:** @jeevanpillay
