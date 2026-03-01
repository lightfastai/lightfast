---
date: 2026-03-01T05:13:24+0000
researcher: jeevan
git_commit: 61476a1b96dc2127236873ca63a85561a97a491d
branch: feat/connections-provider-account-info
repository: lightfast
topic: "GitHub & Vercel Provider Correctness — Types, API conformance, and testing gaps"
tags: [research, codebase, connections, github, vercel, providers, testing, types]
status: complete
last_updated: 2026-03-01
last_updated_by: jeevan
---

# Research: GitHub & Vercel Provider Correctness

**Date**: 2026-03-01T05:13:24+0000
**Researcher**: jeevan
**Git Commit**: 61476a1b96dc2127236873ca63a85561a97a491d
**Branch**: feat/connections-provider-account-info
**Repository**: lightfast

## Research Question

Investigate the correctness of `apps/connections/src/providers/impl/github.ts` and `apps/connections/src/providers/impl/vercel.ts`:
1. Ensure types are being re-used upstream (type sharing between providers and `@db/console` gw tables)
2. Verify logic correctness against GitHub and Vercel official documentation
3. Identify missing test coverage and edge cases

---

## Summary

The type system is well-structured but **has one layering concern**: `GwInstallation["providerAccountInfo"]` is defined inline in `db/console` as a raw JSONB discriminated union — the provider implementations re-use this type via TypeScript inference, but there is no shared Zod schema or canonical type package that enforces the shape at runtime across services. The GitHub provider has **one critical API conformance issue**: when `setup_action=request`, GitHub does NOT send `installation_id`, but the current code hard-fails if `installation_id` is missing. The Vercel provider uses three fields (`organization_id`, `installation`, `team_slug`) that **do not exist** in the Vercel OAuth response. The test suite has **12 documented gaps**, with the Vercel callback path being entirely untested.

---

## Detailed Findings

### 1. Type Sharing Architecture

#### Type Chain

```
@repo/gateway-types              ← canonical shared types (OAuthTokens, ProviderName, etc.)
    ↓
apps/connections/src/providers/types.ts  ← re-exports @repo/gateway-types + adds ConnectionProvider, CallbackResult
    ↓
apps/connections/src/providers/impl/github.ts   ← imports from types.ts
apps/connections/src/providers/impl/vercel.ts   ← imports from types.ts
    ↓
db/console/src/schema/tables/gw-installations.ts  ← defines GwInstallation["providerAccountInfo"] inline as JSONB $type
```

#### `@repo/gateway-types` — Key Definitions

File: `packages/gateway-types/src/interfaces.ts`

```typescript
export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;      // seconds — optional
  scope?: string;
  tokenType?: string;
  raw: Record<string, unknown>;  // always required
}
```

File: `packages/gateway-types/src/providers.ts`

```typescript
export const PROVIDER_NAMES = ["github", "vercel", "linear", "sentry"] as const;
export type ProviderName = (typeof PROVIDER_NAMES)[number];
export const INSTALLATION_STATUSES = ["pending", "active", "error", "revoked"] as const;
```

#### `providerAccountInfo` Type — Defined in `db/console`

File: `db/console/src/schema/tables/gw-installations.ts:30-66`

The discriminated union is defined inline as a JSONB `$type<>` annotation:

```typescript
providerAccountInfo: jsonb("provider_account_info").$type<
  | { version: 1; sourceType: "github"; installations: { id: string; accountId: string; accountLogin: string; accountType: "User" | "Organization"; avatarUrl: string; permissions: Record<string, string>; events: string[]; installedAt: string; lastValidatedAt: string; }[] }
  | { version: 1; sourceType: "vercel"; userId: string; configurationId: string; scope: string; teamId?: string; teamSlug?: string; }
  | { version: 1; sourceType: "sentry"; installationId: string; organizationSlug: string; }
  | { version: 1; sourceType: "linear"; scope: string; }
>()
```

**The `GwInstallation` type is imported by both provider implementations** via `import type { GwInstallation } from "@db/console/schema"` and used as the return type of `buildAccountInfo()`. TypeScript enforces structural compatibility at compile time. There is no runtime Zod validation of the JSONB shape when reading from the DB.

#### `buildAccountInfo` — Not on the Interface

`buildAccountInfo` is explicitly excluded from the `ConnectionProvider` interface (`apps/connections/src/providers/types.ts:105-108`) because each provider has a different signature:
- **GitHub**: `buildAccountInfo(installationId: string, apiData: GitHubInstallationDetails)`
- **Vercel**: `buildAccountInfo(stateData: Record<string, string>, oauthTokens?: OAuthTokens)`

This is correct design — the method is an implementation detail and never called polymorphically.

---

### 2. GitHub Provider Correctness

File: `apps/connections/src/providers/impl/github.ts`

#### 2a. Critical API Issue: `setup_action=request` Has No `installation_id`

**Current code** (`github.ts:123-128`):
```typescript
const installationId = c.req.query("installation_id");
if (!installationId) {
  throw new Error("missing installation_id");
}
```

**Official GitHub behavior (confirmed from docs)**:
- `setup_action=install` → `installation_id` is present ✅
- `setup_action=update` → `installation_id` is present ✅
- `setup_action=request` → **`installation_id` is absent** ❌

When a user installs the app on an org that requires admin approval, GitHub redirects with `?setup_action=request` and **no `installation_id`**. The installation only gets an ID when an org admin approves it (delivered via webhook, not callback). The current code throws `"missing installation_id"` in this case, which is then caught and stored as `status: "failed"` in Redis — a false failure.

The existing code at `github.ts:144-145` correctly handles this conceptually:
```typescript
const isPendingRequest = setupAction === "request";
const status = isPendingRequest ? "pending" : "active";
```

But the code never reaches that line because it fails earlier at the `!installationId` check. The `isPendingRequest` path requires `installationId` to be present, but per GitHub docs it won't be. The pending installation should either be stored without an `installation_id` (using a surrogate key) or the callback should return a "pending" response without a DB write.

#### 2b. `getInstallationDetails` Defensive Parsing

File: `apps/connections/src/lib/github-jwt.ts:138-154`

```typescript
const account = data.account as Record<string, unknown> | null;
if (!account || typeof account.login !== "string") {
  throw new Error("GitHub installation response missing account data");
}
```

**GitHub OpenAPI spec**: `account` is typed as nullable (`account | null`). The current code handles this correctly — it guards against `null` account.

**Gap**: `account.type` is parsed with a fallback: `account.type === "User" ? "User" : "Organization"`. This means any type value that isn't `"User"` (including a hypothetical `"Enterprise"` or unknown future type) maps to `"Organization"`. This is a safe default but silently maps unknown types.

**Gap**: `avatar_url` uses `?? ""` fallback — this is correct per docs (the field is required in the `simple-user` schema but treating it as optional is safe).

#### 2c. Installation ID Format Validation

File: `apps/connections/src/lib/github-jwt.ts:42-44`

```typescript
if (!/^\d+$/.test(installationId)) {
  throw new Error("Invalid GitHub installation ID: must be numeric");
}
```

This is **correct** — GitHub installation IDs are always `int64` integers. The validation is appropriate.

#### 2d. `exchangeCode` in GitHub — Never Called in Production

The GitHub App flow uses direct App installation (not OAuth code exchange). The `exchangeCode` method exists on the interface but is **never called in production for GitHub** — `handleCallback` derives the token via `getInstallationToken` (JWT-based). The `exchangeCode` method would only be used if GitHub App with user-level OAuth is required (which it currently is not). This is architecturally correct.

#### 2e. `getInstallationToken` Response Validation

File: `apps/connections/src/lib/github-jwt.ts:76-80`

```typescript
const data = (await response.json()) as Record<string, unknown>;
if (typeof data.token !== "string" || data.token.length === 0) {
  throw new Error("GitHub installation token response missing valid token");
}
return data.token;
```

**Correct** — the `token` field is always present in a successful 201 response per GitHub docs. The empty-string check is defensive and appropriate.

---

### 3. Vercel Provider Correctness

File: `apps/connections/src/providers/impl/vercel.ts`

#### 3a. `deriveExternalId` — Two Fields That Don't Exist in Vercel's Response

```typescript
private deriveExternalId(raw: Record<string, unknown>): string | undefined {
  return (
    (raw.team_id as string | undefined)?.toString() ??
    (raw.organization_id as string | undefined)?.toString() ??     // ❌ DOES NOT EXIST
    (raw.installation as string | undefined)?.toString()            // ❌ DOES NOT EXIST
  );
}
```

**Vercel `/v2/oauth/access_token` actual response fields** (per official docs):
- `access_token` — always present
- `team_id` — present for team installations; **`null` (not absent) for personal accounts**
- `token_type` — optional
- `user_id` — present (confirmed from community sources)

**`organization_id` does not exist** in the Vercel OAuth token response. **`installation` does not exist** in the Vercel OAuth token response. These are dead fallbacks that will never be hit. The actual fallback for personal accounts is `nanoid()` at `vercel.ts:109` — which means personal account installations get a random `externalId` every time, making the `onConflictDoUpdate` upsert effectively an always-insert.

**The real behavior for personal accounts**: `team_id` is `null` in the response — not absent. So `(raw.team_id as string | undefined)?.toString()` returns `"null"` (the string) for personal accounts, not `undefined`. This means personal accounts get `externalId = "null"`, which is a collision across all personal Vercel accounts.

#### 3b. `buildAccountInfo` — `team_slug` Field

```typescript
teamSlug: (raw.team_slug as string | undefined) ?? undefined,
```

**`team_slug` does not exist in the Vercel OAuth token response**. Vercel only returns `team_id` in the token exchange. The slug would require a separate API call to `GET /v2/teams/:teamId`. This field will always be `undefined` in practice.

#### 3c. `vercelOAuthResponseSchema` — Incomplete

File: `apps/connections/src/providers/schemas.ts:22-26`

```typescript
export const vercelOAuthResponseSchema = z.object({
  access_token: z.string(),
  token_type: z.string().optional(),
  scope: z.string().optional(),
});
```

**Missing from schema**: `team_id`, `user_id`. These fields are in the raw response and used directly via `oauthTokens.raw` in `deriveExternalId` and `buildAccountInfo`. They are parsed from `raw` (unvalidated) rather than from the Zod-validated schema. The `raw` field in `OAuthTokens` bypasses the Zod schema.

#### 3d. Vercel `expiresIn` — Tokens Don't Expire

Vercel OAuth tokens for integrations are **long-lived** — they do not have an expiration. The `vercelOAuthResponseSchema` correctly omits `expires_in`. The `resolveToken` method returns `expiresIn: null` via `tokenRow.expiresAt === null`, which is correct.

#### 3e. Vercel Token Encryption

The Vercel provider correctly calls `writeTokenRecord(installation.id, oauthTokens)` which encrypts the access token with AES-256-GCM before storage. ✅

---

### 4. Shared Type Correctness

#### `OAuthTokens.expiresIn` Usage Across Providers

| Provider | `expiresIn` in `OAuthTokens` | Notes |
|---|---|---|
| GitHub | Not set | Uses JWT resolution (`getInstallationToken`), `resolveToken` returns hardcoded `3600` |
| Vercel | Not set | Tokens don't expire, `resolveToken` returns `null` |
| Linear | Set from `data.expires_in` | Schema includes `expires_in: z.number().optional()` |
| Sentry | Set from computed `expiresAt` | Computed from `data.expiresAt` string |

#### `CallbackResult` Fields Consumed Downstream

File: `apps/connections/src/routes/connections.ts:188-240`

Fields actually read from `CallbackResult` by the callback route:
- `result.reactivated` → written to Redis + appended as `?reactivated=true` on redirects
- `result.setupAction` → written to Redis + appended as `?setup_action=<value>` on redirects

Fields NOT read back from `result` (route uses its own values):
- `result.status` — route writes `"completed"` string to Redis directly
- `result.provider` — route uses `provider.name` directly
- `result.installationId` — not consumed by the route (logged only)

---

### 5. Testing Gaps

#### Comprehensive Gap Analysis (12 Missing Scenarios)

**GitHub Callback Gaps:**

| # | Gap | Scenario | Impact |
|---|---|---|---|
| 1 | `setup_action=request` with no `installation_id` | GitHub sends this when org admin approval required | Hard failure — current code throws before reaching `isPendingRequest` logic |
| 2 | Missing `installation_id` + no state fallback | Callback with invalid/absent `installation_id` and no matching DB row | Unhandled path |
| 3 | Duplicate active → active upsert | Callback arrives for `externalId` that is already `"active"` (not just `"revoked"`) | Currently only tested for `"revoked"` reactivation |
| 4 | `setup_action=update` | GitHub sends this when installation repos change | Path untested — currently treated same as `install` |
| 5 | `invalid_or_expired_state` redirect path | Callback arrives with expired or already-consumed state, no fallback `installation_id` | Error path in callback is never tested end-to-end |

**Vercel Callback Gaps:**

| # | Gap | Scenario | Impact |
|---|---|---|---|
| 6 | Vercel callback — personal account (no `team_id`) | `team_id` is `null` in response | `deriveExternalId` returns `"null"` string, causing cross-account collision |
| 7 | Vercel callback — team account (with `team_id`) | Normal team installation | Callback route itself (`GET /connections/vercel/callback`) never tested |
| 8 | Missing `code` in Vercel callback | OAuth callback arrives without `?code` | `throw new Error("missing code")` — never tested |
| 9 | Invalid/expired state in Vercel callback | State not in Redis when Vercel callback arrives | Never tested |
| 10 | Vercel `providerAccountInfo` written to DB | Full Vercel callback writing JSONB | Never exercised — shape only seeded statically |

**Shared Gaps:**

| # | Gap | Scenario | Impact |
|---|---|---|---|
| 11 | `github.validate` with removed installations | `removed > 0` count path | Only `removed: 0` tested |
| 12 | Backfill trigger partial body validation | Body with `installationId + provider` but no `orgId` | Field-level validation granularity untested |

---

## Code References

### Provider Implementations
- `apps/connections/src/providers/impl/github.ts:119-204` — `handleCallback` full implementation
- `apps/connections/src/providers/impl/github.ts:215-236` — `buildAccountInfo` implementation
- `apps/connections/src/providers/impl/vercel.ts:89-97` — `deriveExternalId` (contains non-existent fields)
- `apps/connections/src/providers/impl/vercel.ts:180-196` — `buildAccountInfo` (contains `team_slug` issue)
- `apps/connections/src/providers/impl/vercel.ts:99-154` — `handleCallback` full implementation

### Type Definitions
- `packages/gateway-types/src/interfaces.ts:19-26` — `OAuthTokens` definition
- `packages/gateway-types/src/providers.ts:3-24` — `ProviderName`, `InstallationStatus` et al
- `apps/connections/src/providers/types.ts:36-108` — `ProviderFor`, `CallbackResult`, `ConnectionProvider`
- `db/console/src/schema/tables/gw-installations.ts:30-66` — `providerAccountInfo` inline JSONB type
- `db/console/src/schema/tables/gw-tokens.ts:1-36` — `gwTokens` schema

### Library Functions
- `apps/connections/src/lib/github-jwt.ts:84-155` — `GitHubInstallationDetails` interface + `getInstallationDetails`
- `apps/connections/src/lib/github-jwt.ts:39-81` — `getInstallationToken` + response validation
- `apps/connections/src/lib/token-store.ts:12-46` — `writeTokenRecord` + `expiresIn` computation
- `apps/connections/src/providers/schemas.ts:1-39` — All Zod validation schemas

### Test Files
- `packages/integration-tests/src/api-console-connections.integration.test.ts:169-188` — `makeGitHubAccountInfo` fixture helper
- `packages/integration-tests/src/connections-backfill-trigger.integration.test.ts:346-396` — GitHub callback upsert tests (Suite 2.4)
- `packages/integration-tests/src/connections-cli-oauth-flow.integration.test.ts:322-414` — Inline callback + CLI poll (Suite 7.3-7.4)

---

## Architecture Documentation

### Type Enforcement Model

The current model is:
1. **Compile-time**: TypeScript enforces `GwInstallation["providerAccountInfo"]` shape via `$type<>` in Drizzle. Provider `buildAccountInfo()` return types are checked against this at build time.
2. **Runtime**: No Zod validation of the JSONB shape on read. The discriminated union is trusted as stored.

There is no shared Zod schema that both validates input and informs the TypeScript types for `providerAccountInfo`. Each provider's `buildAccountInfo` constructs the shape ad-hoc. This works because the writes are controlled, but adds risk if JSONB is written via raw SQL or a migration.

### Callback Route State Machine

```
Redis state key (TTL 600s) → consumed atomically on callback → result key (TTL 300s)
GitHub fallback: if state missing but installation_id present → re-derive from DB
Error path: stores { status: "failed", error: message } → redirect with ?error=...
```

### Provider Registry Initialization

`github` and `vercel` are always registered. `linear` and `sentry` are conditional on env vars being present. `getProvider()` throws `HTTPException(400)` for unknown providers.

---

## Key Correctness Issues Summary

### Critical (behavior incorrect per API docs)

1. **GitHub `setup_action=request`**: Code throws before reaching pending state logic. `installation_id` is absent when `setup_action=request`, but the guard at `github.ts:126-128` hard-fails. This is the primary correctness bug.

2. **Vercel personal account `team_id=null`**: When `team_id` is `null` in the response, `(raw.team_id as string | undefined)?.toString()` returns `"null"` (not `undefined`), so `deriveExternalId` returns the string `"null"` as the `externalId` for all personal accounts. This causes all personal Vercel accounts to collide on the same `externalId = "null"`.

### Incorrect (fields don't exist in API)

3. **`organization_id` in `deriveExternalId`**: This field does not appear in Vercel's OAuth token response. Dead code.

4. **`installation` in `deriveExternalId`**: This field does not appear in Vercel's OAuth token response. Dead code.

5. **`team_slug` in `buildAccountInfo`**: Vercel does not return `team_slug` in the token exchange response. Will always be `undefined`.

### Minor / Defensive

6. **`account.type` fallback**: Any non-`"User"` type maps to `"Organization"`. Safe but silent.

7. **`vercelOAuthResponseSchema` missing `team_id` and `user_id`**: These fields are used from `raw` (bypassing Zod) rather than from the validated schema.

---

## Related Research

No prior research documents on this topic found in `thoughts/shared/research/`.

## Open Questions

1. Should `providerAccountInfo` types be extracted from `db/console` into `@repo/gateway-types` or a dedicated `@repo/provider-types` package to enforce sharing?
2. For GitHub `setup_action=request`: should the callback insert a DB row with a surrogate key and `status: "pending"`, or skip the DB write and return a pending response?
3. For Vercel personal accounts: should `externalId` use `user_id` from the response as the stable identifier?
4. Should the Vercel OAuth schema be expanded to include `team_id` and `user_id` in the Zod schema rather than reading them from unvalidated `raw`?
