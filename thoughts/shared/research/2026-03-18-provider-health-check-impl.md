# Provider Health Check Implementation Research

**Date**: 2026-03-18
**Branch**: refactor/define-ts-provider-redesign
**Scope**: Everything needed to add `healthCheck.check()` to GitHub, Linear, Sentry, and Vercel providers

---

## 1. Interface and Type Definitions

### `HealthCheckDef<TConfig>` — `packages/console-providers/src/provider/api.ts`

```ts
export interface HealthCheckDef<TConfig> {
  readonly check: (
    config: TConfig,
    externalId: string,
    accessToken: string | null
  ) => Promise<ConnectionStatus>;
}

export type ConnectionStatus = z.infer<typeof connectionStatusSchema>;
// "healthy" | "revoked" | "suspended"
```

`healthCheck` is declared as `readonly healthCheck?: HealthCheckDef<TConfig>` in `BaseProviderFields` (`provider/shape.ts` line 55). It flows through `defineWebhookProvider` transparently — no changes needed to the factory, just add the field to the provider object literal.

---

## 2. Config Types Per Provider

### GitHub — `GitHubConfig`
```ts
{
  appSlug: string;
  appId: string;
  privateKey: string;    // PKCS#8 PEM, used to sign RS256 JWT
  clientId: string;
  clientSecret: string;
  webhookSecret: string;
}
```

### Linear — `LinearConfig`
```ts
{
  clientId: string;
  clientSecret: string;
  webhookSigningSecret: string;
  callbackBaseUrl: string;
}
```

### Sentry — `SentryConfig`
```ts
{
  appSlug: string;
  clientId: string;
  clientSecret: string;   // used as Bearer token for Sentry API calls (not the user accessToken)
}
```

### Vercel — `VercelConfig`
```ts
{
  integrationSlug: string;
  clientSecretId: string;
  clientIntegrationSecret: string;
  callbackBaseUrl: string;
}
```

---

## 3. Auth Patterns Per Provider

### GitHub — App-Token (not OAuth)
- `auth.kind = "app-token"`
- `usesStoredToken: false` — no per-connection access token stored
- `getActiveToken(config, externalId, _token)` → calls `getInstallationToken(config, installationId)` which:
  1. Creates a short-lived RS256 JWT signed with `config.privateKey` (`iss: config.appId`)
  2. `POST /app/installations/{id}/access_tokens` with `Authorization: Bearer <jwt>`
  3. Returns the installation token
- For health check: `accessToken` will be `null` — must use the App JWT directly
- Helper already in `index.ts`: `createGitHubAppJWT(config)` builds the JWT
- `externalId` = numeric installation ID (e.g. `"12345678"`)

### Linear — OAuth, stored token
- `auth.kind = "oauth"`, `usesStoredToken: true`
- `getActiveToken(_config, _externalId, storedAccessToken)` → returns `storedAccessToken` directly
- `accessToken` will be the user's stored Bearer token
- Auth header: `Authorization: Bearer ${accessToken}` (confirmed in `fetchLinearExternalId`)
- `externalId` = org ID or viewer ID (UUID)

### Sentry — OAuth, stored token, composite token format
- `auth.kind = "oauth"`, `usesStoredToken: true`
- `getActiveToken(_config, _externalId, storedAccessToken)` → returns `storedAccessToken` directly
- Stored token is a PLAIN access token (raw Sentry token, NOT the `installationId:token` composite)
- The composite format `installationId:token` is only used for the **refresh** token
- Auth header: `Authorization: Bearer ${accessToken}` (per `sentryApi.buildAuthHeader`)
- For health check: `accessToken` = the Sentry access token; `externalId` = Sentry installation UUID
- **IMPORTANT**: The health check endpoint `GET /api/0/sentry-app-installations/{externalId}/` uses `config.clientSecret` as auth (like `revokeToken` and `exchangeSentryCode`), NOT the user `accessToken`. Confirmed by `revokeToken`: `Authorization: Bearer ${config.clientSecret}`.

### Vercel — OAuth, stored token
- `auth.kind = "oauth"`, `usesStoredToken: true`
- `getActiveToken(_config, _externalId, storedAccessToken)` → returns `storedAccessToken` directly
- `accessToken` will be the user's stored Bearer token (long-lived, no refresh support)
- Auth header: `Authorization: Bearer ${accessToken}` (no `buildAuthHeader` override in vercelApi — falls back to default `Bearer`)
- `externalId` = team ID or user ID

---

## 4. Fetch Patterns in Existing Code

All providers use raw `fetch()` with:
- `AbortSignal.timeout(...)` for timeouts (10–15 seconds typical)
- Manual `!response.ok` checks throwing `new Error(...)`
- No shared fetch helper — each provider does its own fetching

### Error status handling patterns observed:
- GitHub `revokeAccess`: `!response.ok && response.status !== 404` → treats 404 as success (already uninstalled)
- Sentry `revokeToken`: `!response.ok` → throws
- Linear `revokeToken`: `!response.ok` → throws
- Vercel `revokeToken`: `!response.ok` → throws
- None currently return structured `ConnectionStatus` — all throw on failure

For health checks, the pattern inverts: instead of throwing, we must return a `ConnectionStatus`.

---

## 5. Health Check Implementation Plan Per Provider

### 5.1 GitHub

**Probe**: `GET /app/installations/{externalId}`
**Auth**: App JWT (RS256, built from `config.appId` + `config.privateKey`)
**accessToken param**: Will be `null` — GitHub App connections have `usesStoredToken: false`
**Status mapping**:
- `200` → `"healthy"`
- `404` → `"revoked"` (installation uninstalled by user)
- Other → throw (network error, etc.)

**Implementation note**: `createGitHubAppJWT` is already defined as a local function in `providers/github/index.ts`. The health check needs the same JWT. The endpoint `GET /app/installations/{installation_id}` already exists in `githubApi.endpoints["get-app-installation"]` but health check bypasses the API object and uses raw `fetch` (same pattern as `getInstallationToken` and `revokeAccess`).

```ts
healthCheck: {
  check: async (config, externalId, _accessToken) => {
    const jwt = await createGitHubAppJWT(config);
    const response = await fetch(
      `https://api.github.com/app/installations/${externalId}`,
      {
        method: "GET",
        signal: AbortSignal.timeout(10_000),
        headers: {
          Authorization: `Bearer ${jwt}`,
          Accept: "application/vnd.github+json",
          "User-Agent": "lightfast-gateway",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      }
    );
    if (response.status === 200) return "healthy";
    if (response.status === 404) return "revoked";
    throw new Error(`GitHub health check failed: ${response.status}`);
  },
},
```

**Where to add**: In `providers/github/index.ts`, inside `defineWebhookProvider({...})`, at the same level as `api`, `backfill`, `auth`. The `createGitHubAppJWT` helper is already in scope in that file.

---

### 5.2 Linear

**Probe**: `POST /graphql` with `{ viewer { id } }`
**Auth**: `Authorization: Bearer ${accessToken}` (stored user token)
**accessToken param**: Will be the stored OAuth token (non-null for healthy connections)
**Status mapping**:
- `200` + `data.viewer` present → `"healthy"`
- `200` + `errors[].extensions.type === "AUTHENTICATION_ERROR"` (or similar auth error) → `"revoked"`
- `401` → `"revoked"` (though Linear wraps errors in 200; explicit 401 means token truly invalid)
- `accessToken` is `null` → `"revoked"` (no token stored)

**Linear GraphQL error format**: Linear wraps auth errors in HTTP 200 with `errors` array. The error `extensions.type` field contains `"AUTHENTICATION_ERROR"` for revoked tokens. Need to inspect `result.errors` for authentication-related messages.

**Practical approach**: Check for presence of `data.viewer.id`. If absent and errors contain an auth-related error, return `"revoked"`. If `data.viewer.id` is present, return `"healthy"`.

```ts
healthCheck: {
  check: async (_config, _externalId, accessToken) => {
    if (!accessToken) return "revoked";
    const response = await fetch("https://api.linear.app/graphql", {
      method: "POST",
      signal: AbortSignal.timeout(10_000),
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ query: "{ viewer { id } }" }),
    });
    if (!response.ok) return "revoked";
    const result = (await response.json()) as {
      data?: { viewer?: { id?: string } };
      errors?: Array<{ message: string; extensions?: { type?: string } }>;
    };
    if (result.data?.viewer?.id) return "healthy";
    // GraphQL auth errors come back as HTTP 200 with errors array
    return "revoked";
  },
},
```

**Where to add**: In `providers/linear/index.ts`, inside `defineWebhookProvider({...})`.

---

### 5.3 Sentry

**Probe**: `GET /api/0/sentry-app-installations/{externalId}/`
**Auth**: `Authorization: Bearer ${config.clientSecret}` — uses the APP's client secret, NOT the user's access token. This is confirmed by `revokeToken` in `index.ts` which uses `config.clientSecret` for the same `DELETE /api/0/sentry-app-installations/{id}/` endpoint.
**accessToken param**: Not used for this probe
**Status mapping**:
- `200` → `"healthy"`
- `404` → `"revoked"` (installation removed)
- `403` → `"revoked"` (auth failure)
- Other → throw

**Note on accessToken**: The stored `accessToken` for Sentry is the user-level token (plain, not composite). However, the installation check endpoint requires the **app's** `clientSecret` as the bearer, not the user token. This is a Sentry-specific auth pattern for sentry-app-installation endpoints. The `_accessToken` param should be ignored.

```ts
healthCheck: {
  check: async (config, externalId, _accessToken) => {
    const response = await fetch(
      `https://sentry.io/api/0/sentry-app-installations/${externalId}/`,
      {
        method: "GET",
        signal: AbortSignal.timeout(10_000),
        headers: {
          Authorization: `Bearer ${config.clientSecret}`,
        },
      }
    );
    if (response.status === 200) return "healthy";
    if (response.status === 404 || response.status === 403) return "revoked";
    throw new Error(`Sentry health check failed: ${response.status}`);
  },
},
```

**Where to add**: In `providers/sentry/index.ts`, inside `defineWebhookProvider({...})`.

---

### 5.4 Vercel

**Probe**: `GET /v2/user`
**Auth**: `Authorization: Bearer ${accessToken}` (stored user OAuth token)
**accessToken param**: Will be the stored OAuth token (non-null for healthy connections)
**Status mapping**:
- `200` → `"healthy"`
- `403` → `"revoked"` (Vercel uses 403, not 401, for auth failures)
- `401` → `"revoked"` (defensive, in case)
- `accessToken` is `null` → `"revoked"`

**Note**: Vercel tokens are long-lived with no refresh (`refreshToken` throws). The `get-user` endpoint already exists in `vercelApi.endpoints["get-user"]` (`GET /v2/user`). Health check uses raw `fetch` for consistency with other providers.

```ts
healthCheck: {
  check: async (_config, _externalId, accessToken) => {
    if (!accessToken) return "revoked";
    const response = await fetch("https://api.vercel.com/v2/user", {
      method: "GET",
      signal: AbortSignal.timeout(10_000),
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    if (response.status === 200) return "healthy";
    if (response.status === 401 || response.status === 403) return "revoked";
    throw new Error(`Vercel health check failed: ${response.status}`);
  },
},
```

**Where to add**: In `providers/vercel/index.ts`, inside `defineWebhookProvider({...})`.

---

## 6. No Changes Required

- `provider/api.ts` — `HealthCheckDef` and `ConnectionStatus` already defined
- `provider/shape.ts` — `healthCheck?: HealthCheckDef<TConfig>` already on `BaseProviderFields`
- `factory/webhook.ts` — `defineWebhookProvider` spreads `def` into result; `healthCheck` passes through
- `registry.ts` — consumers that want to call `provider.healthCheck?.check(...)` already have the type

---

## 7. Import Requirements

Each provider file needs `ConnectionStatus` imported from `../../provider/api` only if TypeScript can't infer the return type. Since `HealthCheckDef<TConfig>` declares the return type as `Promise<ConnectionStatus>`, the string literals `"healthy"` and `"revoked"` will satisfy the type without an explicit import. No new imports required in any provider file.

---

## 8. Key Gotchas

1. **GitHub `accessToken` is always `null`** — `usesStoredToken: false`. The health check MUST build a fresh App JWT from `config`, never use `accessToken`.

2. **Sentry auth is `config.clientSecret`**, not the user `accessToken`. The `GET /sentry-app-installations/{id}/` endpoint is authenticated as the Sentry App (using `clientSecret`), not as the end user.

3. **Linear errors are HTTP 200** — a revoked/invalid token returns `{ data: null, errors: [...] }` with HTTP 200. Must inspect `result.data?.viewer` existence, not just `response.ok`.

4. **Vercel uses 403 not 401** — Vercel's API returns `403 Forbidden` (not `401`) when an access token is invalid or revoked. Both 401 and 403 should map to `"revoked"` defensively.

5. **`externalId` is always the installation/connection identifier** — GitHub: numeric installation ID; Linear: org UUID or viewer UUID; Sentry: installation UUID (`sentryInstallationId`); Vercel: team ID or user ID.

6. **No changes to `defineWebhookProvider` or any factory** — `healthCheck` is an optional field and the factory spreads `def` wholesale, so it just works.

---

## 9. File Locations for Edits

| Provider | File |
|----------|------|
| GitHub | `/packages/console-providers/src/providers/github/index.ts` |
| Linear | `/packages/console-providers/src/providers/linear/index.ts` |
| Sentry | `/packages/console-providers/src/providers/sentry/index.ts` |
| Vercel | `/packages/console-providers/src/providers/vercel/index.ts` |

No new files. No new imports (string literals satisfy the `ConnectionStatus` type). Each `healthCheck` block is a ~10 line addition to the existing `defineWebhookProvider({...})` call.
