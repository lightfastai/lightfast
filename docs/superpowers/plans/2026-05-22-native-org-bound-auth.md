# Native Org-Bound Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert Lightfast native authentication so both `core/cli` and `apps/desktop` are either logged out or signed in as one Clerk user bound to one Lightfast organization selected in `apps/app`.

**Architecture:** Clerk remains the OAuth authorization server. Native clients own PKCE, loopback callback handling, Clerk token exchange, token refresh, and local token storage. `apps/app` owns the user-facing native auth browser flow and org selection UI, while `api/app` owns native OAuth config, auth-attempt storage, Clerk token validation, organization membership checks, and org-scoped identity construction through tRPC.

**Tech Stack:** pnpm workspace, TypeScript, Node.js 22, Next.js App Router, Electron, Commander, Clerk OAuth Applications, Clerk `auth({ acceptsToken: "oauth_token" })`, tRPC, Upstash Redis via `@vendor/upstash`, Zod, Vitest, Playwright/agent-browser for end-to-end checks.

---

## References

- Design spec: `docs/superpowers/specs/2026-05-22-native-org-bound-auth-design.md`
- Current CLI OAuth plan: `docs/superpowers/plans/2026-05-22-cli-oauth-pkce.md`
- OAuth native app baseline: https://www.rfc-editor.org/rfc/rfc8252.html
- PKCE: https://www.rfc-editor.org/rfc/rfc7636.html
- Clerk OAuth implementation: https://clerk.com/docs/guides/configure/auth-strategies/oauth/how-clerk-implements-oauth
- Clerk OAuth token verification: https://clerk.com/docs/guides/configure/auth-strategies/oauth/verify-oauth-tokens

## Architecture Decisions

- **Native sessions are org-bound:** stored CLI and desktop sessions must contain `user`, `organization`, and `tokens`. A user-only native session is invalid.
- **Org selection happens in `apps/app`:** CLI and desktop pass PKCE and loopback parameters to `/native-auth/[client]/start`. The browser route requires Clerk sign-in and renders the organization chooser.
- **Native clients never choose org locally:** remove CLI `--org` selection and do not add an Electron org picker in this migration.
- **Auth attempts bind web selection to native OAuth:** `api/app` creates a short-lived Redis-backed attempt after the user chooses an organization. Finalization consumes that attempt after the native client has exchanged the Clerk OAuth code.
- **Clerk authenticates the user, Lightfast binds the org:** Clerk OAuth access tokens prove user identity. `x-lightfast-organization-id` selects native org context, accepted only after membership validation.
- **Native clients call the app facade only:** CLI and desktop do not import `@api/app`, tRPC clients, or app router types.
- **`apps/app` route handlers are adapters:** route handlers and browser pages call `api/app` through server-side tRPC callers. They do not call Clerk, Redis, or the database directly.
- **Shared runtime code is isolated:** pure Node OAuth mechanics live outside `core/cli` so desktop and CLI do not duplicate PKCE, loopback, token exchange, or refresh behavior.
- **Desktop renderer does not own refresh tokens:** Electron main process owns refresh and encrypted storage. Renderer asks main for request headers.
- **Legacy paths are removed only after both clients migrate:** keep old desktop JWT bearer handling until the desktop flow is switched, then delete `/desktop/auth`, `/api/auth/code`, `/api/auth/token`, and JWT-template verification.

## Provider Configuration Checkpoint

Before implementation, verify Clerk supports the desired loopback redirect shape for both native OAuth apps.

Required Clerk OAuth Applications per Clerk instance:

- `Lightfast CLI`
- `Lightfast Desktop`

Both applications:

- public client
- Authorization Code + PKCE
- PKCE method `S256`
- access token format JWT
- consent enabled
- scopes `openid profile email offline_access`
- loopback redirect URI pattern supporting `http://127.0.0.1:<ephemeral>/callback`

If Clerk rejects dynamic loopback redirect URIs, pause this plan and replace the loopback contract with Clerk's supported native redirect model before changing client code.

## File Structure

Create:

- `packages/native-auth-node/package.json`
- `packages/native-auth-node/tsconfig.json`
- `packages/native-auth-node/vitest.config.ts`
- `packages/native-auth-node/src/index.ts`
- `packages/native-auth-node/src/loopback.ts`
- `packages/native-auth-node/src/oauth-state.ts`
- `packages/native-auth-node/src/pkce.ts`
- `packages/native-auth-node/src/token-client.ts`
- `packages/native-auth-node/src/__tests__/loopback.test.ts`
- `packages/native-auth-node/src/__tests__/oauth-state.test.ts`
- `packages/native-auth-node/src/__tests__/pkce.test.ts`
- `packages/native-auth-node/src/__tests__/token-client.test.ts`
- `api/app/src/auth/native-auth-attempts.ts`
- `api/app/src/auth/native-oauth.ts`
- `api/app/src/router/(pending-allowed)/native-auth.ts`
- `api/app/src/__tests__/native-auth-attempts.test.ts`
- `api/app/src/__tests__/native-auth-router.test.ts`
- `api/app/src/__tests__/native-oauth-identity.test.ts`
- `apps/app/src/app/api/native-auth/_server/native-auth-caller.ts`
- `apps/app/src/app/api/native-auth/[client]/oauth-config/route.ts`
- `apps/app/src/app/api/native-auth/finalize/route.ts`
- `apps/app/src/app/api/native-auth/cli/oauth-config/route.ts`
- `apps/app/src/app/(client-handshake)/native-auth/[client]/start/_components/native-auth-org-select.tsx`
- `apps/app/src/app/(client-handshake)/native-auth/[client]/start/actions.ts`
- `apps/app/src/app/(client-handshake)/native-auth/[client]/start/page.tsx`
- `apps/app/src/__tests__/app/api/native-auth/native-auth-routes.test.ts`
- `apps/app/src/__tests__/app/(client-handshake)/native-auth/start-page.test.tsx`
- `apps/desktop/src/main/native-auth/app-client.ts`
- `apps/desktop/src/main/native-auth/flow.ts`
- `apps/desktop/src/main/native-auth/session.ts`
- `apps/desktop/src/main/native-auth/store.ts`
- `apps/desktop/src/main/native-auth/__tests__/flow.test.ts`
- `apps/desktop/src/main/native-auth/__tests__/session.test.ts`
- `apps/desktop/src/main/native-auth/__tests__/store.test.ts`

Modify:

- `packages/native-auth-contract/package.json`
- `packages/native-auth-contract/src/cli.ts`
- `packages/native-auth-contract/src/index.ts`
- `packages/native-auth-contract/src/__tests__/cli.test.ts`
- `api/app/package.json`
- `api/app/src/env.ts`
- `api/app/src/auth/identity.ts`
- `api/app/src/root.ts`
- `api/app/src/trpc.ts`
- `apps/app/package.json`
- `apps/app/src/proxy.ts`
- `apps/app/src/__tests__/proxy.test.ts`
- `core/cli/package.json`
- `core/cli/tsup.config.ts`
- `core/cli/src/auth/app-client.ts`
- `core/cli/src/auth/login-flow.ts`
- `core/cli/src/auth/oauth.ts`
- `core/cli/src/auth/session.ts`
- `core/cli/src/auth/store.ts`
- `core/cli/src/auth/token-client.ts`
- `core/cli/src/program.ts`
- `apps/desktop/package.json`
- `apps/desktop/src/main/auth-flow.ts`
- `apps/desktop/src/main/auth-store.ts`
- `apps/desktop/src/main/index.ts`
- `apps/desktop/src/main/protocol.ts`
- `apps/desktop/src/shared/ipc.ts`
- `packages/app-trpc/src/desktop.tsx`
- `core/cli/README.md`
- `apps/desktop/README.md`
- `apps/www/src/content/docs/get-started/quickstart.mdx`
- `pnpm-lock.yaml`
- `pnpm-workspace.yaml` if the package list is not already covered by `packages/*`

Delete after both clients migrate:

- `api/app/src/auth/cli-oauth.ts`
- `api/app/src/router/(pending-allowed)/cli-auth.ts`
- `apps/app/src/app/api/native-auth/_server/cli-auth-caller.ts`
- `apps/app/src/app/api/native-auth/cli/session/route.ts`
- `core/cli/src/auth/selection.ts`
- `apps/app/src/app/(client-handshake)/desktop/auth/page.tsx`
- `apps/app/src/app/(client-handshake)/desktop/auth/_components/desktop-auth-client.tsx`
- `apps/app/src/app/(auth-api)/_server/code-store.ts`
- `apps/app/src/app/(auth-api)/_server/verify-bearer-jwt.ts`
- `apps/app/src/app/(auth-api)/api/auth/code/route.ts`
- `apps/app/src/app/(auth-api)/api/auth/token/route.ts`
- tests that only cover deleted legacy routes

---

### Task 1: Generalize Native Auth Contracts and Shared Node Runtime

**Files:**
- Modify: `packages/native-auth-contract/src/cli.ts`
- Modify: `packages/native-auth-contract/src/index.ts`
- Modify: `packages/native-auth-contract/src/__tests__/cli.test.ts`
- Create: `packages/native-auth-node/*`
- Modify: `pnpm-lock.yaml`

- [ ] **Step 1: Write contract tests for org-bound native sessions**

Add tests that prove:

- `client` accepts only `cli` and `desktop`.
- native OAuth config accepts both clients.
- stored native sessions require `user`, `organization`, and `tokens`.
- legacy CLI sessions with `org: null` fail validation.
- native request header constants are exported once.

Core expected shape:

```ts
expect(
  nativeSessionSchema.parse({
    schemaVersion: 2,
    appUrl: "https://app.lightfast.localhost",
    client: "cli",
    oauth: {
      issuer: "https://clerk.lightfast.test",
      clientId: "cli_client_test",
    },
    tokens: {
      accessToken: "access",
      refreshToken: "refresh",
      tokenType: "Bearer",
      expiresAt: 4_102_444_800_000,
    },
    user: {
      id: "user_123",
      email: "user@example.com",
    },
    organization: {
      id: "org_123",
      name: "Acme",
      slug: "acme",
    },
  })
).toMatchObject({
  client: "cli",
  organization: { id: "org_123" },
});
```

- [ ] **Step 2: Replace CLI-only contract names with native names**

Add these exports while keeping temporary CLI aliases for incremental migration:

```ts
export const NATIVE_AUTH_SCHEMA_VERSION = 2;
export const NATIVE_OAUTH_CALLBACK_PATH = "/callback";
export const NATIVE_OAUTH_SCOPES = [
  "openid",
  "profile",
  "email",
  "offline_access",
] as const;
export const NATIVE_OAUTH_REQUIRED_ACCESS_SCOPES = [
  "openid",
  "profile",
  "email",
] as const;

export const nativeClientSchema = z.enum(["cli", "desktop"]);
export type NativeClient = z.infer<typeof nativeClientSchema>;

export const NATIVE_AUTH_HEADERS = {
  client: "x-lightfast-native-client",
  organizationId: "x-lightfast-organization-id",
} as const;
```

Native schemas to add:

```ts
export const nativeOAuthConfigSchema = z.object({
  authorizationEndpoint: z.string().url(),
  client: nativeClientSchema,
  clientId: z.string().min(1),
  issuer: z.string().url(),
  scopes: z.array(z.string().min(1)).min(1),
  supportsDynamicLoopbackPort: z.literal(true),
  tokenEndpoint: z.string().url(),
});

export const nativeOrganizationSchema = z.object({
  bindingStatus: z.enum(["bound", "unbound"]),
  id: z.string().min(1),
  name: z.string().min(1),
  role: z.string().min(1),
  slug: z.string().min(1).nullable(),
});

export const nativeUserSchema = z.object({
  email: z.string().email().nullable(),
  id: z.string().min(1),
});

export const nativeSessionMetadataSchema = z.object({
  client: nativeClientSchema,
  organization: nativeOrganizationSchema.pick({
    id: true,
    name: true,
    slug: true,
  }),
  user: nativeUserSchema,
});

export const nativeFinalizeRequestSchema = z.object({
  attemptId: z.string().min(16),
  client: nativeClientSchema,
  state: z.string().min(16).max(2048),
});

export const nativeCreateAttemptInputSchema = z.object({
  client: nativeClientSchema,
  codeChallenge: z.string().min(43).max(128),
  codeChallengeMethod: z.literal("S256"),
  organizationId: z.string().min(1),
  redirectUri: z.string().url(),
  stateNonce: z.string().min(16).max(256),
});

export const nativeSessionSchema = z.object({
  appUrl: z.string().url(),
  client: nativeClientSchema,
  oauth: z.object({
    clientId: z.string().min(1),
    issuer: z.string().url(),
  }),
  organization: nativeSessionMetadataSchema.shape.organization,
  schemaVersion: z.literal(NATIVE_AUTH_SCHEMA_VERSION),
  tokens: tokenSetSchema,
  user: nativeUserSchema,
});
```

Export inferred types for `NativeClient`, `NativeOAuthConfig`,
`NativeOrganization`, `NativeSessionMetadata`, `NativeSession`, `TokenSet`,
and `NativeCreateAttemptInput`.

- [ ] **Step 3: Create `@repo/native-auth-node` package**

Create a package for runtime code shared by CLI and Electron main:

```json
{
  "name": "@repo/native-auth-node",
  "version": "0.1.0",
  "private": true,
  "license": "Apache-2.0",
  "type": "module",
  "sideEffects": false,
  "exports": {
    ".": {
      "types": "./src/index.ts",
      "default": "./src/index.ts"
    }
  },
  "scripts": {
    "clean": "git clean -xdf .cache .turbo node_modules",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@repo/native-auth-contract": "workspace:*",
    "zod": "catalog:"
  },
  "devDependencies": {
    "@repo/typescript-config": "workspace:*",
    "@repo/vitest-config": "workspace:*",
    "@types/node": "catalog:",
    "typescript": "catalog:",
    "vitest": "catalog:"
  }
}
```

- [ ] **Step 4: Move PKCE and loopback primitives into `@repo/native-auth-node`**

Implement the shared API:

```ts
export function createCodeVerifier(): string;
export function createStateNonce(): string;
export function buildCodeChallenge(verifier: string): string;
export function buildLoopbackRedirectUri(port: number): string;

export interface LoopbackCallback {
  code: string;
  state: string;
}

export interface LoopbackServer {
  close: () => Promise<void>;
  port: number;
  waitForCallback: () => Promise<LoopbackCallback>;
}

export function startLoopbackServer(input: {
  expectedStateNonce: string;
  successHtmlTitle: string;
  timeoutMs?: number;
}): Promise<LoopbackServer>;
```

The loopback server must listen on `127.0.0.1` and port `0`, validate
`/callback`, reject OAuth errors, return both `code` and `state`, and close
cleanly after timeout or completion.

- [ ] **Step 5: Move token exchange and refresh into `@repo/native-auth-node`**

Shared token client API:

```ts
export async function exchangeAuthorizationCode(input: {
  code: string;
  codeVerifier: string;
  config: NativeOAuthConfig;
  fetchImpl?: typeof fetch;
  now?: () => number;
  redirectUri: string;
}): Promise<TokenSet>;

export async function refreshAccessToken(input: {
  config: NativeOAuthConfig;
  fetchImpl?: typeof fetch;
  now?: () => number;
  refreshToken: string;
}): Promise<TokenSet>;
```

- [ ] **Step 6: Add OAuth state envelope parsing**

Native clients need to recover the attempt id from Clerk's returned `state` and
also verify the original nonce.

```ts
export const nativeOAuthStateEnvelopeSchema = z.object({
  attemptId: z.string().min(16),
  nonce: z.string().min(16),
});

export function decodeNativeOAuthState(state: string): NativeOAuthStateEnvelope {
  const json = Buffer.from(state, "base64url").toString("utf8");
  return nativeOAuthStateEnvelopeSchema.parse(JSON.parse(json));
}

export function assertNativeOAuthState(input: {
  expectedNonce: string;
  state: string;
}): NativeOAuthStateEnvelope {
  const envelope = decodeNativeOAuthState(input.state);
  if (envelope.nonce !== input.expectedNonce) {
    throw new NativeAuthError("OAUTH_STATE_MISMATCH", "OAuth state mismatch.");
  }
  return envelope;
}
```

Also export a small shared error class:

```ts
export class NativeAuthError extends Error {
  constructor(
    readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "NativeAuthError";
  }
}
```

- [ ] **Step 7: Run shared package tests**

Run:

```bash
pnpm --filter @repo/native-auth-contract test
pnpm --filter @repo/native-auth-node test
pnpm --filter @repo/native-auth-contract typecheck
pnpm --filter @repo/native-auth-node typecheck
```

Expected: all tests and typechecks pass.

- [ ] **Step 8: Commit**

```bash
git add packages/native-auth-contract packages/native-auth-node pnpm-lock.yaml
git commit -m "feat: add shared native auth primitives"
```

---

### Task 2: Add `api/app` Native Auth Authority

**Files:**
- Modify: `api/app/package.json`
- Modify: `api/app/src/env.ts`
- Create: `api/app/src/auth/native-oauth.ts`
- Create: `api/app/src/auth/native-auth-attempts.ts`
- Modify: `api/app/src/auth/identity.ts`
- Create: `api/app/src/router/(pending-allowed)/native-auth.ts`
- Modify: `api/app/src/root.ts`
- Modify: `api/app/src/trpc.ts`
- Test: `api/app/src/__tests__/native-auth-attempts.test.ts`
- Test: `api/app/src/__tests__/native-auth-router.test.ts`
- Test: `api/app/src/__tests__/native-oauth-identity.test.ts`

- [ ] **Step 1: Add failing API tests**

Cover:

- `native.auth.oauthConfig({ client: "cli" })` returns CLI config.
- `native.auth.oauthConfig({ client: "desktop" })` returns desktop config.
- missing client id throws `INTERNAL_SERVER_ERROR`.
- `native.auth.createAttempt` rejects an org the signed-in user does not belong to.
- `native.auth.createAttempt` returns an authorization URL containing PKCE, loopback redirect, scopes, and encoded state.
- `native.auth.finalize` consumes a valid attempt and returns user/org metadata.
- `native.auth.finalize` rejects mismatched client, mismatched token user, expired attempt, reused attempt, and invalid state hash.
- native OAuth request identity becomes active only with a valid org header and membership.

- [ ] **Step 2: Add desktop OAuth env**

Update `api/app/src/env.ts`:

```ts
server: {
  CLERK_CLI_OAUTH_CLIENT_ID: z.string().min(1).optional(),
  CLERK_DESKTOP_OAUTH_CLIENT_ID: z.string().min(1).optional(),
  VERCEL_ENV: z.enum(["development", "preview", "production"]).default("development"),
},
experimental__runtimeEnv: {
  CLERK_CLI_OAUTH_CLIENT_ID: process.env.CLERK_CLI_OAUTH_CLIENT_ID,
  CLERK_DESKTOP_OAUTH_CLIENT_ID: process.env.CLERK_DESKTOP_OAUTH_CLIENT_ID,
  VERCEL_ENV: process.env.VERCEL_ENV ?? "development",
},
```

- [ ] **Step 3: Replace CLI-only OAuth helper with native helper**

Create `api/app/src/auth/native-oauth.ts`:

```ts
export function getNativeOAuthClientId(client: NativeClient): string | null {
  switch (client) {
    case "cli":
      return env.CLERK_CLI_OAUTH_CLIENT_ID ?? null;
    case "desktop":
      return env.CLERK_DESKTOP_OAUTH_CLIENT_ID ?? null;
  }
}

export function getNativeOAuthConfig(
  client: NativeClient
): NativeOAuthConfig | null {
  const issuer = getClerkFrontendApi().replace(/\/$/, "");
  const clientId = getNativeOAuthClientId(client);
  if (!(issuer && clientId)) {
    return null;
  }
  return nativeOAuthConfigSchema.parse({
    authorizationEndpoint: `${issuer}/oauth/authorize`,
    client,
    clientId,
    issuer,
    scopes: NATIVE_OAUTH_SCOPES,
    supportsDynamicLoopbackPort: true,
    tokenEndpoint: `${issuer}/oauth/token`,
  });
}

export function buildClerkAuthorizeUrl(input: {
  codeChallenge: string;
  config: NativeOAuthConfig;
  redirectUri: string;
  state: string;
}): string {
  const url = new URL(input.config.authorizationEndpoint);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", input.config.clientId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("scope", input.config.scopes.join(" "));
  url.searchParams.set("state", input.state);
  url.searchParams.set("code_challenge", input.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

export function isExpectedNativeOAuthAccess(input: {
  client: NativeClient;
  clientId: string;
  scopes: readonly string[];
}): boolean {
  return (
    input.clientId === getNativeOAuthClientId(input.client) &&
    hasRequiredNativeOAuthScopes(input.scopes)
  );
}
```

- [ ] **Step 4: Add Redis-backed native auth attempts**

Create `api/app/src/auth/native-auth-attempts.ts` using `@vendor/upstash`:

```ts
const PREFIX = "native-auth-attempt:";
const TTL_SECONDS = 10 * 60;

export async function issueNativeAuthAttempt(
  input: IssueNativeAuthAttemptInput
): Promise<IssuedNativeAuthAttempt> {
  const attemptId = nanoid(32);
  const state = encodeState({ attemptId, nonce: input.stateNonce });
  const record = {
    client: input.client,
    codeChallenge: input.codeChallenge,
    codeChallengeMethod: "S256",
    organizationId: input.organizationId,
    redirectUri: input.redirectUri,
    stateHash: hashState(state),
    userId: input.userId,
  };
  await redis.set(`${PREFIX}${attemptId}`, record, { ex: TTL_SECONDS });
  return { attemptId, state };
}

export async function consumeNativeAuthAttempt(input: {
  attemptId: string;
  state: string;
}): Promise<NativeAuthAttemptRecord | null> {
  const record = await redis.getdel<NativeAuthAttemptRecord>(
    `${PREFIX}${input.attemptId}`
  );
  if (!record || record.stateHash !== hashState(input.state)) {
    return null;
  }
  return record;
}
```

- [ ] **Step 5: Add native auth tRPC router**

Create `api/app/src/router/(pending-allowed)/native-auth.ts` with:

Private helpers in this file should have explicit names:

```ts
async function listNativeOrganizationsForUser(input: {
  db: Database;
  userId: string;
}): Promise<NativeOrganization[]> {
  // Use Clerk membership list, then annotate each organization with isOrgBound(input.db, org.id).
}

async function assertNativeOrgMembership(input: {
  organizationId: string;
  userId: string;
}): Promise<void> {
  // Throw FORBIDDEN unless Clerk membership contains input.organizationId.
}

async function createNativeSessionMetadata(input: {
  client: NativeClient;
  db: Database;
  organizationId: string;
  userId: string;
}): Promise<NativeSessionMetadata> {
  // Load user and membership, verify membership again, return user plus chosen organization.
}
```

```ts
export const nativeAuthRouter = {
  oauthConfig: publicProcedure
    .input(z.object({ client: nativeClientSchema }))
    .query(({ input }) => {
      const config = getNativeOAuthConfig(input.client);
      if (!config) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `${input.client} OAuth is not configured`,
        });
      }
      return config;
    }),

  listOrganizations: viewerProcedure.query(async ({ ctx }) => {
    return listNativeOrganizationsForUser({
      db: ctx.db,
      userId: ctx.auth.identity.userId,
    });
  }),

  createAttempt: viewerProcedure
    .input(nativeCreateAttemptInputSchema)
    .mutation(async ({ ctx, input }) => {
      await assertNativeOrgMembership({
        organizationId: input.organizationId,
        userId: ctx.auth.identity.userId,
      });
      const config = requireNativeOAuthConfig(input.client);
      const issued = await issueNativeAuthAttempt({
        ...input,
        userId: ctx.auth.identity.userId,
      });
      return {
        authorizationUrl: buildClerkAuthorizeUrl({
          codeChallenge: input.codeChallenge,
          config,
          redirectUri: input.redirectUri,
          state: issued.state,
        }),
        attemptId: issued.attemptId,
      };
    }),

  finalize: nativeOAuthProcedure
    .input(nativeFinalizeRequestSchema)
    .mutation(async ({ ctx, input }) => {
      const attempt = await consumeNativeAuthAttempt({
        attemptId: input.attemptId,
        state: input.state,
      });
      if (!attempt || attempt.client !== input.client) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid native auth attempt" });
      }
      if (ctx.auth.access.userId !== attempt.userId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Native auth user mismatch" });
      }
      return createNativeSessionMetadata({
        db: ctx.db,
        client: input.client,
        organizationId: attempt.organizationId,
        userId: attempt.userId,
      });
    }),
} satisfies TRPCRouterRecord;
```

- [ ] **Step 6: Generalize tRPC auth procedure**

Replace `cliOAuthProcedure` with `nativeOAuthProcedure` in `api/app/src/trpc.ts`.

The middleware should require:

```ts
ctx.auth.access?.kind === "clerk-oauth"
```

It should not require an active org because finalization runs before the native
client has persisted the org-bound session.

- [ ] **Step 7: Make identity resolution accept org-bound native OAuth**

Update `api/app/src/auth/identity.ts`:

- read `x-lightfast-native-client`,
- read `x-lightfast-organization-id`,
- verify Clerk OAuth bearer token,
- verify client id and scopes match the declared native client,
- if no org header exists, return pending identity for finalization,
- if org header exists, validate membership and return active identity,
- keep legacy desktop JWT fallback until Task 6.

Target access shape:

```ts
export type AuthAccess =
  | { has: ClerkHas; kind: "clerk-session"; orgId: string | null; userId: string }
  | {
      client: NativeClient;
      clientId: string;
      kind: "clerk-oauth";
      scopes: string[];
      userId: string;
    };
```

- [ ] **Step 8: Mount the router**

Update `api/app/src/root.ts`:

```ts
export const appRouter = createTRPCRouter({
  native: createTRPCRouter({
    auth: nativeAuthRouter,
  }),
  // keep cli.auth only as a temporary compatibility alias if tests still depend on it
});
```

- [ ] **Step 9: Run API tests**

Run:

```bash
pnpm --filter @api/app test -- native-auth
pnpm --filter @api/app test -- native-oauth
pnpm --filter @api/app typecheck
```

Expected: native auth tests pass and API typecheck passes.

- [ ] **Step 10: Commit**

```bash
git add api/app packages/native-auth-contract pnpm-lock.yaml
git commit -m "feat: add native org-bound auth authority"
```

---

### Task 3: Add `apps/app` Native Auth Facade and Org Selection Flow

**Files:**
- Modify: `apps/app/package.json`
- Create: `apps/app/src/app/api/native-auth/_server/native-auth-caller.ts`
- Create: `apps/app/src/app/api/native-auth/[client]/oauth-config/route.ts`
- Create: `apps/app/src/app/api/native-auth/finalize/route.ts`
- Modify: `apps/app/src/app/api/native-auth/cli/oauth-config/route.ts`
- Create: `apps/app/src/app/(client-handshake)/native-auth/[client]/start/page.tsx`
- Create: `apps/app/src/app/(client-handshake)/native-auth/[client]/start/actions.ts`
- Create: `apps/app/src/app/(client-handshake)/native-auth/[client]/start/_components/native-auth-org-select.tsx`
- Modify: `apps/app/src/proxy.ts`
- Modify: `apps/app/src/__tests__/proxy.test.ts`
- Test: `apps/app/src/__tests__/app/api/native-auth/native-auth-routes.test.ts`
- Test: `apps/app/src/__tests__/app/(client-handshake)/native-auth/start-page.test.tsx`

- [ ] **Step 1: Write app facade and page tests**

Cover:

- `GET /api/native-auth/cli/oauth-config` delegates to `caller.native.auth.oauthConfig({ client: "cli" })`.
- `GET /api/native-auth/desktop/oauth-config` delegates to desktop config.
- `POST /api/native-auth/finalize` forwards Authorization and body to `caller.native.auth.finalize`.
- `/native-auth/cli/start` rejects invalid client, redirect URI, missing state nonce, missing code challenge, and non-`S256` method.
- start page renders organizations returned by `caller.native.auth.listOrganizations`.
- choosing an organization calls `caller.native.auth.createAttempt` and redirects to the returned Clerk authorization URL.
- proxy allows `/native-auth/(.*)` during pending sessions.

- [ ] **Step 2: Replace CLI-specific caller with native caller**

Create `native-auth-caller.ts`:

```ts
import "server-only";

import { appRouter, createCallerFactory, createTRPCContext } from "@api/app";

const createCaller = createCallerFactory(appRouter);

export async function createNativeAuthCaller(input: {
  headers: Headers;
  source: string;
}) {
  const headers = new Headers(input.headers);
  headers.set("x-trpc-source", input.source);
  return createCaller(await createTRPCContext({ headers }));
}
```

- [ ] **Step 3: Add OAuth config route**

Create `apps/app/src/app/api/native-auth/[client]/oauth-config/route.ts` and
update the existing static CLI route to delegate to the same native tRPC
procedure. The static CLI route can stay temporarily so current URL tests keep
working; it must return the new native config schema.

```ts
export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ client: string }> }
) {
  try {
    const parsedClient = nativeClientSchema.parse((await params).client);
    const caller = await createNativeAuthCaller({
      headers: req.headers,
      source: parsedClient,
    });
    const config = await caller.native.auth.oauthConfig({
      client: parsedClient,
    });
    return jsonResponse(nativeOAuthConfigSchema.parse(config));
  } catch (error) {
    return errorResponse(error);
  }
}
```

- [ ] **Step 4: Add finalize route**

Create `apps/app/src/app/api/native-auth/finalize/route.ts`:

```ts
export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = nativeFinalizeRequestSchema.parse(
      await req.json().catch(() => null)
    );
    const caller = await createNativeAuthCaller({
      headers: req.headers,
      source: body.client,
    });
    const session = await caller.native.auth.finalize(body);
    return jsonResponse(nativeSessionMetadataSchema.parse(session));
  } catch (error) {
    return errorResponse(error);
  }
}
```

- [ ] **Step 5: Add browser start page and server action**

Create `/native-auth/[client]/start` as a Server Component. It validates search
params and loads organizations through tRPC.

Search params:

```ts
const nativeAuthStartSearchSchema = z.object({
  code_challenge: z.string().min(43).max(128),
  code_challenge_method: z.literal("S256"),
  redirect_uri: z.string().url().refine(isLoopbackRedirectUri),
  state: z.string().min(16).max(256),
});

function isLoopbackRedirectUri(value: string): boolean {
  try {
    const url = new URL(value);
    const port = Number.parseInt(url.port, 10);
    return (
      url.protocol === "http:" &&
      url.hostname === "127.0.0.1" &&
      url.pathname === "/callback" &&
      Number.isInteger(port) &&
      port > 0
    );
  } catch {
    return false;
  }
}

const nativeCreateAttemptFormSchema = nativeAuthStartSearchSchema.extend({
  client: nativeClientSchema,
  organization_id: z.string().min(1),
});
```

The page renders a compact chooser:

```tsx
<main className="mx-auto flex min-h-svh w-full max-w-lg flex-col justify-center px-6">
  <h1 className="font-semibold text-2xl">Choose a Lightfast organization</h1>
  <form action={continueNativeAuth}>
    <input name="client" type="hidden" value={client} />
    <input name="redirect_uri" type="hidden" value={redirectUri} />
    <input name="state" type="hidden" value={state} />
    <input name="code_challenge" type="hidden" value={codeChallenge} />
    <input name="code_challenge_method" type="hidden" value="S256" />
    {organizations.map((org) => (
      <button name="organization_id" type="submit" value={org.id}>
        <span>{org.name}</span>
        {org.slug ? <span>{org.slug}</span> : null}
      </button>
    ))}
  </form>
</main>
```

The server action:

```ts
"use server";

export async function continueNativeAuth(formData: FormData) {
  const input = nativeCreateAttemptFormSchema.parse(
    Object.fromEntries(formData)
  );
  const caller = await createNativeAuthCaller({
    headers: await headers(),
    source: input.client,
  });
  const result = await caller.native.auth.createAttempt({
    client: input.client,
    codeChallenge: input.code_challenge,
    codeChallengeMethod: "S256",
    organizationId: input.organization_id,
    redirectUri: input.redirect_uri,
    stateNonce: input.state,
  });
  redirect(result.authorizationUrl);
}
```

- [ ] **Step 6: Update proxy route gates**

Update `apps/app/src/proxy.ts`:

- add `/native-auth(.*)` to pending-session allowed routes,
- add `native-auth` to reserved org route segments,
- keep `/desktop/auth(.*)` until Task 6 cleanup,
- keep `/api/native-auth/(.*)` in API route matcher.

- [ ] **Step 7: Run app tests**

Run:

```bash
pnpm --filter @lightfast/app test -- native-auth
pnpm --filter @lightfast/app test -- proxy
pnpm --filter @lightfast/app typecheck
```

Expected: native auth route/page tests and proxy tests pass.

- [ ] **Step 8: Commit**

```bash
git add apps/app pnpm-lock.yaml
git commit -m "feat: add native auth org selection flow"
```

---

### Task 4: Convert CLI to App-Layer Org Selection

**Files:**
- Modify: `core/cli/package.json`
- Modify: `core/cli/tsup.config.ts`
- Modify: `core/cli/src/auth/app-client.ts`
- Modify: `core/cli/src/auth/login-flow.ts`
- Modify: `core/cli/src/auth/oauth.ts`
- Modify: `core/cli/src/auth/session.ts`
- Modify: `core/cli/src/auth/store.ts`
- Modify: `core/cli/src/auth/token-client.ts`
- Modify: `core/cli/src/program.ts`
- Delete: `core/cli/src/auth/selection.ts`
- Test: `core/cli/src/auth/__tests__/app-client.test.ts`
- Test: `core/cli/src/auth/__tests__/login-flow.test.ts`
- Test: `core/cli/src/auth/__tests__/program.test.ts`
- Test: `core/cli/src/auth/__tests__/session.test.ts`
- Test: `core/cli/src/auth/__tests__/store.test.ts`

- [ ] **Step 1: Write failing CLI tests**

Cover:

- `lightfast login` opens `/native-auth/cli/start`, not Clerk authorize directly.
- login URL includes `redirect_uri`, `state`, `code_challenge`, and `code_challenge_method=S256`.
- CLI does not accept `--org`.
- loopback callback state envelope must contain the original nonce.
- finalize is called after token exchange with Authorization Bearer access token.
- stored session has `organization`, never `org: null`.
- `whoami` prints selected organization.
- refresh preserves organization metadata.

- [ ] **Step 2: Update CLI app client**

Replace `getSession` with `finalizeNativeAuth`:

```ts
export function createLightfastAppClient(input: {
  appUrl: string;
  fetchImpl?: typeof fetch;
}) {
  const baseUrl = input.appUrl.replace(/\/$/, "");
  const fetchImpl = input.fetchImpl ?? fetch;

  return {
    async getOAuthConfig(): Promise<NativeOAuthConfig> {
      const response = await fetchImpl(
        `${baseUrl}/api/native-auth/cli/oauth-config`,
        { headers: { accept: "application/json" } }
      );
      return readJson(response, nativeOAuthConfigSchema);
    },

    async finalizeNativeAuth(input: {
      accessToken: string;
      attemptId: string;
      state: string;
    }): Promise<NativeSessionMetadata> {
      const response = await fetchImpl(`${baseUrl}/api/native-auth/finalize`, {
        method: "POST",
        headers: {
          accept: "application/json",
          authorization: `Bearer ${input.accessToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          attemptId: input.attemptId,
          client: "cli",
          state: input.state,
        }),
      });
      return readJson(response, nativeSessionMetadataSchema);
    },
  };
}
```

- [ ] **Step 3: Update login flow**

Target flow:

```ts
const config = await client.getOAuthConfig();
const codeVerifier = createCodeVerifier();
const codeChallenge = buildCodeChallenge(codeVerifier);
const stateNonce = createStateNonce();
const loopback = await startLoopbackServer({
  expectedStateNonce: stateNonce,
  successHtmlTitle: "Lightfast CLI",
});
const redirectUri = buildLoopbackRedirectUri(loopback.port);
const startUrl = buildNativeAuthStartUrl({
  appUrl,
  client: "cli",
  codeChallenge,
  redirectUri,
  stateNonce,
});
await openBrowser(startUrl);
const callback = await loopback.waitForCallback();
const state = assertNativeOAuthState({
  expectedNonce: stateNonce,
  state: callback.state,
});
const tokens = await exchangeAuthorizationCode({
  code: callback.code,
  codeVerifier,
  config,
  redirectUri,
});
const metadata = await client.finalizeNativeAuth({
  accessToken: tokens.accessToken,
  attemptId: state.attemptId,
  state: callback.state,
});
await store.set({
  appUrl,
  client: "cli",
  oauth: { clientId: config.clientId, issuer: config.issuer },
  organization: metadata.organization,
  schemaVersion: NATIVE_AUTH_SCHEMA_VERSION,
  tokens,
  user: metadata.user,
});
```

- [ ] **Step 4: Remove CLI local org selection**

Remove:

- `--org <org>` option,
- `selectCliOrganization`,
- errors that ask the user to rerun login with `--org`.

`lightfast login` output becomes:

```text
Logged in as user@example.com for Acme (acme).
```

- [ ] **Step 5: Add native request header helper**

Add a helper for future CLI API calls:

```ts
export function buildNativeAuthHeaders(session: NativeSession): HeadersInit {
  return {
    Authorization: `Bearer ${session.tokens.accessToken}`,
    [NATIVE_AUTH_HEADERS.client]: "cli",
    [NATIVE_AUTH_HEADERS.organizationId]: session.organization.id,
  };
}
```

- [ ] **Step 6: Run CLI tests**

Run:

```bash
pnpm --filter @lightfastai/cli test
pnpm --filter @lightfastai/cli typecheck
pnpm --filter @lightfastai/cli build
```

Expected: CLI tests, typecheck, and bundle build pass.

- [ ] **Step 7: Commit**

```bash
git add core/cli packages/native-auth-contract packages/native-auth-node pnpm-lock.yaml
git commit -m "feat: bind cli login to app-selected org"
```

---

### Task 5: Convert Desktop to Native Org-Bound OAuth

**Files:**
- Modify: `apps/desktop/package.json`
- Create: `apps/desktop/src/main/native-auth/app-client.ts`
- Create: `apps/desktop/src/main/native-auth/flow.ts`
- Create: `apps/desktop/src/main/native-auth/session.ts`
- Create: `apps/desktop/src/main/native-auth/store.ts`
- Modify: `apps/desktop/src/main/auth-flow.ts`
- Modify: `apps/desktop/src/main/auth-store.ts`
- Modify: `apps/desktop/src/main/index.ts`
- Modify: `apps/desktop/src/shared/ipc.ts`
- Modify: `packages/app-trpc/src/desktop.tsx`
- Test: `apps/desktop/src/main/native-auth/__tests__/flow.test.ts`
- Test: `apps/desktop/src/main/native-auth/__tests__/session.test.ts`
- Test: `apps/desktop/src/main/native-auth/__tests__/store.test.ts`
- Test: `apps/desktop/src/main/__tests__/auth-flow.test.ts`

- [ ] **Step 1: Write failing desktop tests**

Cover:

- sign-in opens `/native-auth/desktop/start`, not `/desktop/auth`.
- sign-in uses loopback `http://127.0.0.1:<port>/callback`, not custom protocol.
- desktop exchanges Clerk code with Clerk token endpoint.
- desktop finalizes through `/api/native-auth/finalize`.
- `safeStorage` stores full native session including organization.
- legacy `{ token, savedAt }` payload is purged.
- `getRequestHeaders` refreshes access tokens near expiry.
- refresh failure clears auth and emits signed-out snapshot.
- renderer tRPC headers include `Authorization`, `x-lightfast-native-client=desktop`, and `x-lightfast-organization-id`.

- [ ] **Step 2: Add desktop app client**

Create `apps/desktop/src/main/native-auth/app-client.ts` with the same facade
shape as CLI, using `createAppUrl`:

```ts
export function createDesktopNativeAuthClient(input: {
  fetchImpl?: typeof fetch;
}) {
  const fetchImpl = input.fetchImpl ?? fetch;
  return {
    async getOAuthConfig() {
      const response = await fetchImpl(
        createAppUrl("/api/native-auth/desktop/oauth-config").toString(),
        { headers: { accept: "application/json" } }
      );
      return readJson(response, nativeOAuthConfigSchema);
    },
    async finalize(input: {
      accessToken: string;
      attemptId: string;
      state: string;
    }) {
      const response = await fetchImpl(
        createAppUrl("/api/native-auth/finalize").toString(),
        {
          method: "POST",
          headers: {
            accept: "application/json",
            authorization: `Bearer ${input.accessToken}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            attemptId: input.attemptId,
            client: "desktop",
            state: input.state,
          }),
        }
      );
      return readJson(response, nativeSessionMetadataSchema);
    },
  };
}
```

- [ ] **Step 3: Replace desktop auth storage**

Replace the single-token schema with `nativeSessionSchema`:

```ts
const persistedSchema = nativeSessionSchema.extend({
  client: z.literal("desktop"),
});

let memory: DesktopNativeSession | null = null;

export function getAuthSnapshot(): AuthSnapshot {
  const session = getSession();
  return {
    isSignedIn: !!session,
    organizationName: session?.organization.name,
    organizationSlug: session?.organization.slug,
    userEmail: session?.user.email,
  };
}
```

Legacy payload behavior:

```ts
const parsed = persistedSchema.safeParse(JSON.parse(plain));
if (!parsed.success) {
  purgePersisted(path, "auth-store.load.schema.purge");
  return null;
}
```

- [ ] **Step 4: Replace custom-protocol sign-in with loopback sign-in**

Desktop sign-in flow mirrors CLI:

```ts
const config = await client.getOAuthConfig();
const codeVerifier = createCodeVerifier();
const codeChallenge = buildCodeChallenge(codeVerifier);
const stateNonce = createStateNonce();
const loopback = await startLoopbackServer({
  expectedStateNonce: stateNonce,
  successHtmlTitle: "Lightfast Desktop",
  timeoutMs: getSigninTimeoutMs(),
});
const redirectUri = buildLoopbackRedirectUri(loopback.port);
const signinUrl = buildNativeAuthStartUrl({
  appUrl: getRuntimeConfig().appOrigin,
  client: "desktop",
  codeChallenge,
  redirectUri,
  stateNonce,
});
setPendingSigninUrl(signinUrl);
await shell.openExternal(signinUrl);
const callback = await loopback.waitForCallback();
const envelope = assertNativeOAuthState({
  expectedNonce: stateNonce,
  state: callback.state,
});
const tokens = await exchangeAuthorizationCode({
  code: callback.code,
  codeVerifier,
  config,
  redirectUri,
});
const metadata = await client.finalize({
  accessToken: tokens.accessToken,
  attemptId: envelope.attemptId,
  state: callback.state,
});
setSession({
  appUrl: getRuntimeConfig().appOrigin,
  client: "desktop",
  oauth: { clientId: config.clientId, issuer: config.issuer },
  organization: metadata.organization,
  schemaVersion: NATIVE_AUTH_SCHEMA_VERSION,
  tokens,
  user: metadata.user,
});
```

- [ ] **Step 5: Add main-process request header IPC**

Update `apps/desktop/src/shared/ipc.ts`:

```ts
export interface AuthRequestHeaders {
  Authorization?: string;
  "x-lightfast-native-client"?: "desktop";
  "x-lightfast-organization-id"?: string;
}

export interface AuthSnapshot {
  isSignedIn: boolean;
  organizationName?: string;
  organizationSlug?: string | null;
  userEmail?: string | null;
}
```

Add channel:

```ts
authGetRequestHeaders: channel("auth-get-request-headers"),
```

Main process handler:

```ts
ipcMain.handle(IpcChannels.authGetRequestHeaders, () =>
  getValidAuthRequestHeaders()
);
```

- [ ] **Step 6: Update desktop tRPC provider**

Modify `packages/app-trpc/src/desktop.tsx`:

```ts
getAuthHeaders: async () => {
  const bridge = window.lightfastBridge;
  const nativeHeaders = await bridge?.auth?.getRequestHeaders?.();
  return {
    "x-trpc-source": "desktop",
    "x-lightfast-desktop": "1",
    ...nativeHeaders,
  };
}
```

- [ ] **Step 7: Stop registering auth custom protocol for sign-in**

Remove auth-flow dependence on:

- `getProtocolScheme`,
- `onProtocolUrl`,
- `matchesAuthCallback`,
- `lightfast://auth/callback`,
- `lightfast-dev://auth/callback`.

Keep custom protocol registration only if other desktop features still use it.

- [ ] **Step 8: Run desktop tests**

Run:

```bash
pnpm --filter @lightfast/desktop test -- auth
pnpm --filter @lightfast/desktop typecheck
pnpm --filter @repo/app-trpc typecheck
```

Expected: desktop auth tests and typechecks pass.

- [ ] **Step 9: Commit**

```bash
git add apps/desktop packages/app-trpc packages/native-auth-node pnpm-lock.yaml
git commit -m "feat: bind desktop auth to app-selected org"
```

---

### Task 6: Remove Legacy Native Auth Paths and Stale Docs

**Files:**
- Delete: `api/app/src/auth/cli-oauth.ts`
- Delete: `api/app/src/router/(pending-allowed)/cli-auth.ts`
- Delete: `apps/app/src/app/api/native-auth/_server/cli-auth-caller.ts`
- Delete: `apps/app/src/app/api/native-auth/cli/oauth-config/route.ts`
- Delete: `apps/app/src/app/api/native-auth/cli/session/route.ts`
- Delete: `core/cli/src/auth/selection.ts`
- Delete: `apps/app/src/app/(client-handshake)/desktop/auth/page.tsx`
- Delete: `apps/app/src/app/(client-handshake)/desktop/auth/_components/desktop-auth-client.tsx`
- Delete: `apps/app/src/app/(auth-api)/_server/code-store.ts`
- Delete: `apps/app/src/app/(auth-api)/_server/verify-bearer-jwt.ts`
- Delete: `apps/app/src/app/(auth-api)/api/auth/code/route.ts`
- Delete: `apps/app/src/app/(auth-api)/api/auth/token/route.ts`
- Modify: `apps/app/src/app/(client-handshake)/_components/client-auth-bridge.tsx`
- Modify: `apps/app/src/proxy.ts`
- Modify: `api/app/src/auth/identity.ts`
- Modify: `api/app/src/root.ts`
- Modify: `core/cli/README.md`
- Modify: `apps/desktop/README.md`
- Modify: `apps/www/src/content/docs/get-started/quickstart.mdx`

- [ ] **Step 1: Write cleanup tests**

Update tests to prove:

- `/desktop/auth` is no longer pending-session allowlisted.
- `/api/auth/code` and `/api/auth/token` are not in the API route matcher.
- `appRouter` no longer exposes `cli.auth`.
- Bearer JWT template fallback is gone from `api/app/src/auth/identity.ts`.
- docs no longer mention desktop JWT templates, CLI API-key setup, or `--org`.

- [ ] **Step 2: Remove legacy app routes**

Delete legacy route files and their route tests:

```bash
git rm 'apps/app/src/app/(client-handshake)/desktop/auth/page.tsx'
git rm 'apps/app/src/app/(client-handshake)/desktop/auth/_components/desktop-auth-client.tsx'
git rm 'apps/app/src/app/(auth-api)/_server/code-store.ts'
git rm 'apps/app/src/app/(auth-api)/_server/verify-bearer-jwt.ts'
git rm 'apps/app/src/app/(auth-api)/api/auth/code/route.ts'
git rm 'apps/app/src/app/(auth-api)/api/auth/token/route.ts'
```

- [ ] **Step 3: Remove legacy API identity fallback**

Delete desktop JWT-template parsing from `api/app/src/auth/identity.ts`:

- remove `verifyToken` import,
- remove `CLERK_SECRET_KEY`,
- remove `ClerkJwtClaims`,
- remove `tryBearer`,
- make OAuth and cookie the only auth transports.

The resolver ends as:

```ts
export async function resolveAuthContextFromClerk({
  db,
  headers,
}: ResolveIdentityInput): Promise<ResolvedAuthContext> {
  const nativeOAuth = await tryNativeOAuthBearer({ db, headers });
  if (nativeOAuth) {
    return nativeOAuth;
  }
  return tryCookie(db);
}
```

- [ ] **Step 4: Remove CLI compatibility router**

Delete `cli-auth.ts`, remove `cli` from `appRouter`, and update imports/tests.

- [ ] **Step 5: Tighten proxy**

Update `apps/app/src/proxy.ts`:

- remove `/desktop/auth(.*)` from pending-session allowed routes,
- remove `/api/auth/(.*)` from API route matcher unless another route still uses it,
- keep `/native-auth(.*)` pending-session allowed,
- keep `native-auth` reserved.

- [ ] **Step 6: Update docs**

Docs should describe:

- native auth uses Clerk OAuth Authorization Code + PKCE,
- both CLI and desktop are org-bound,
- org selection happens in browser under `apps/app`,
- CLI command is `lightfast login` with no `--org`,
- desktop uses ephemeral loopback and `safeStorage`,
- no Lightfast API keys are created for native login.

- [ ] **Step 7: Run cleanup checks**

Run:

```bash
rg -n "lightfast-desktop|/desktop/auth|/api/auth/code|/api/auth/token|api-key setup|--org" api/app apps/app apps/desktop core/cli apps/www packages
pnpm --filter @api/app test
pnpm --filter @lightfast/app test
pnpm --filter @lightfast/desktop test -- auth
pnpm --filter @lightfastai/cli test
pnpm typecheck
```

Expected: search has no stale native-auth references outside changelog/spec/plan history, and all tests/typechecks pass.

- [ ] **Step 8: Commit**

```bash
git add api/app apps/app apps/desktop core/cli apps/www packages pnpm-lock.yaml
git commit -m "refactor: remove legacy native auth handoffs"
```

---

### Task 7: End-to-End Verification

**Files:**
- Modify or create e2e coverage under `e2e/` if the existing package has native auth helpers.
- Update runbooks in `core/cli/README.md` and `apps/desktop/README.md`.

- [ ] **Step 1: Run local service preflight**

Run:

```bash
pnpm dev:doctor
pnpm redis:ping
```

Expected: app database and Redis dependencies are available.

- [ ] **Step 2: Start the app dev server**

Run:

```bash
pnpm dev:app > /tmp/lightfast-native-auth-app.log 2>&1 &
```

Then verify:

```bash
tail -n 80 /tmp/lightfast-native-auth-app.log
```

Expected: app is available at the worktree `app.lightfast.localhost` URL.

- [ ] **Step 3: Verify CLI login end to end**

Run the CLI against the local app:

```bash
APP_URL="$(node -e 'const aggregate=new URL(process.argv[1]); const parts=aggregate.hostname.split("."); const host=parts[0]==="lightfast" ? `app.${aggregate.hostname}` : `${parts[0]}.app.${parts.slice(1).join(".")}`; console.log(`${aggregate.protocol}//${host}`)' "$(node scripts/with-desktop-env.mjs --print)")"
CLI_CONFIG_DIR="$(mktemp -d)"
LIGHTFAST_APP_URL="$APP_URL" \
LIGHTFAST_CLI_CONFIG_DIR="$CLI_CONFIG_DIR" \
pnpm --filter @lightfastai/cli dev -- login
```

Complete browser sign-in and choose an organization in `apps/app`.

Then run:

```bash
LIGHTFAST_APP_URL="$APP_URL" \
LIGHTFAST_CLI_CONFIG_DIR="$CLI_CONFIG_DIR" \
pnpm --filter @lightfastai/cli dev -- whoami
```

Expected output contains both `User:` and `Organization:`.

- [ ] **Step 4: Verify desktop login end to end**

Run:

```bash
LIGHTFAST_DESKTOP_AGENT_MODE=1 pnpm dev:desktop
```

Capture the emitted `auth_signin_url`, open it with agent-browser or a real
browser, sign in, choose an organization, and verify the desktop process emits:

```json
{"event":"auth_signed_in"}
```

Then verify authenticated tRPC calls from the renderer include:

- `Authorization: Bearer ...`
- `x-lightfast-native-client: desktop`
- `x-lightfast-organization-id: org_...`

- [ ] **Step 5: Verify negative cases**

Exercise these cases manually or with focused E2E helpers:

- finalization with reused attempt returns 401/403,
- finalization with token from another user returns 403,
- tRPC request without org header returns `ORG_REQUIRED`,
- tRPC request with org header for a non-member returns unauthorized/forbidden,
- refresh-token failure clears desktop auth,
- corrupt CLI auth file is rejected and does not produce a request.

- [ ] **Step 6: Run full quality gate**

Run:

```bash
pnpm check
pnpm typecheck
pnpm --filter @repo/native-auth-contract test
pnpm --filter @repo/native-auth-node test
pnpm --filter @api/app test
pnpm --filter @lightfast/app test
pnpm --filter @lightfastai/cli test
pnpm --filter @lightfast/desktop test -- auth
```

Expected: all checks pass.

- [ ] **Step 7: Commit final verification docs**

If E2E helpers or README runbooks changed:

```bash
git add e2e core/cli/README.md apps/desktop/README.md apps/www/src/content/docs/get-started/quickstart.mdx
git commit -m "test: verify native org-bound auth"
```

---

## Execution Notes

- Execute tasks in order. Task 2 can temporarily coexist with the current CLI OAuth implementation, but Tasks 4 and 5 depend on Tasks 1 through 3.
- Do not delete legacy desktop auth until desktop has passed Task 5 tests.
- Keep commits scoped to one task each.
- Do not include unrelated dirty work in native-auth commits.
- If Clerk dynamic loopback support fails provider verification, stop before Task 1 implementation and revise the spec/plan around the supported redirect model.

## Self-Review Checklist

- Spec requirement: one org-bound native auth model for CLI and desktop. Covered by Tasks 1, 4, and 5.
- Spec requirement: org selection in `apps/app`. Covered by Task 3.
- Spec requirement: `apps/app` delegates to `api/app` tRPC. Covered by Tasks 2 and 3.
- Spec requirement: no native API keys. Covered by Tasks 4, 5, and 6.
- Spec requirement: loopback + PKCE for both native clients. Covered by Tasks 1, 4, and 5.
- Spec requirement: desktop refresh tokens stay in main-process storage. Covered by Task 5.
- Spec requirement: cleanup legacy API-key and JWT handoffs. Covered by Task 6.
- Spec requirement: end-to-end testing. Covered by Task 7.
