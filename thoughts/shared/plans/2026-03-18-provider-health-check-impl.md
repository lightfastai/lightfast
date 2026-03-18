# Provider `healthCheck.check()` Implementation Plan

## Overview

Add `healthCheck.check()` probes to the four active webhook providers (GitHub, Linear, Sentry, Vercel) in `packages/console-providers`. Each probe is a lightweight API call that returns `ConnectionStatus` (`"healthy" | "revoked" | "suspended"`), enabling a future 5-minute cron to detect revoked/broken connections without relying on webhook-based lifecycle detection.

## Current State Analysis

### Type System (already complete)

The type infrastructure is fully in place from the provider redesign:

- **`HealthCheckDef<TConfig>`** defined in `packages/console-providers/src/provider/api.ts` (lines 20-26)
- **`connectionStatusSchema`** defined as `z.enum(["healthy", "revoked", "suspended"])` (lines 5-9)
- **`healthCheck?: HealthCheckDef<TConfig>`** declared on `BaseProviderFields` in `packages/console-providers/src/provider/shape.ts` (line 55)
- **`defineWebhookProvider()`** in `packages/console-providers/src/factory/webhook.ts` spreads `def` into the result with `...def` (line 58), so `healthCheck` passes through automatically — no factory changes needed

### Provider Auth Patterns (drives implementation)

Each provider has a different auth pattern for its health probe:

| Provider | Auth Pattern | `accessToken` param | Probe Auth |
|----------|-------------|---------------------|------------|
| GitHub | App-token (`usesStoredToken: false`) | Always `null` | Build RS256 JWT from `config.appId` + `config.privateKey` |
| Linear | OAuth (`usesStoredToken: true`) | Stored user token | `Bearer ${accessToken}` |
| Sentry | OAuth (`usesStoredToken: true`) | Stored user token (unused) | `Bearer ${config.clientSecret}` (app-level auth) |
| Vercel | OAuth (`usesStoredToken: true`) | Stored user token | `Bearer ${accessToken}` |

### Key Discoveries

- **GitHub `createGitHubAppJWT()`** is already a top-level function in `providers/github/index.ts` (line 31) — the health check can call it directly
- **Sentry health check uses `config.clientSecret`**, NOT the user's `accessToken` — confirmed by `revokeToken` at line 318 of `providers/sentry/index.ts` which uses the same pattern for the `DELETE /sentry-app-installations/{id}/` endpoint
- **Linear wraps auth errors in HTTP 200** — a revoked token returns `{ data: null, errors: [...] }` with HTTP 200. Must inspect `result.data?.viewer` existence, not just `response.ok`
- **Vercel uses 403 (not 401)** for invalid/revoked tokens — both 401 and 403 should map to `"revoked"` defensively
- **All providers use raw `fetch()`** with `AbortSignal.timeout()` — no shared fetch helper exists. Health checks follow this same pattern.

## Desired End State

After this plan is complete:

1. `github.healthCheck.check(config, externalId, null)` returns `"healthy"` or `"revoked"`
2. `linear.healthCheck.check(config, externalId, accessToken)` returns `"healthy"` or `"revoked"`
3. `sentry.healthCheck.check(config, externalId, accessToken)` returns `"healthy"` or `"revoked"`
4. `vercel.healthCheck.check(config, externalId, accessToken)` returns `"healthy"` or `"revoked"`
5. Each provider has unit tests covering: happy path (200 -> healthy), auth failure -> revoked, null token handling, network error propagation
6. TypeScript compiles cleanly — `healthCheck` satisfies `HealthCheckDef<TConfig>`
7. No changes to any type definitions, factory functions, or registry code

### Verification

```bash
pnpm --filter @repo/console-providers test
pnpm --filter @repo/console-providers typecheck
```

## What We're NOT Doing

- **No cron job implementation** — the health check cron lives in `apps/platform` (Phase 1 of the platform redesign). This plan only provides the `check()` functions the cron will call.
- **No DB schema changes** — the `healthStatus`, `healthCheckFailures`, `lastHealthCheckAt` columns are part of the Phase 0 DB migration (separate plan).
- **No config drift detection** — drift detection runs at the platform level after a successful `check()`, not inside the provider.
- **No `"suspended"` state handling** — `check()` returns only `"healthy"` or `"revoked"`. The `"suspended"` status is a future extension for rate-limited or temporarily blocked connections.
- **No retry logic inside `check()`** — the cron job handles retry scheduling. `check()` either succeeds, returns a status, or throws (which the cron interprets as `"unreachable"` / transient failure).
- **No Apollo provider** — Apollo uses API keys that don't expire; `healthCheck` is intentionally omitted (`undefined`).

## Implementation Approach

Each provider gets a `healthCheck` block added to its `defineWebhookProvider({...})` call. The blocks are ~10-15 lines each, using raw `fetch()` with `AbortSignal.timeout(10_000)`. Error-to-status mapping is provider-specific. Tests follow the existing mock-fetch pattern established in each provider's `index.test.ts`.

## Phase 1: Add `healthCheck.check()` to All Four Providers

### Overview

Add the `healthCheck` field to each provider definition and write unit tests. All four providers are implemented in a single phase because they are independent, small, and follow the same pattern.

### Changes Required

#### 1. GitHub — `providers/github/index.ts`

**File**: `packages/console-providers/src/providers/github/index.ts`
**Location**: Inside `defineWebhookProvider({...})`, after the `backfill: githubBackfill,` line (line 253)
**Changes**: Add `healthCheck` block

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

**Rationale**:
- Probe: `GET /app/installations/{externalId}` — lightweight, read-only, confirms installation exists
- Auth: App JWT (same as `getInstallationToken` and `revokeAccess`). `accessToken` is always `null` for GitHub (app-token auth, `usesStoredToken: false`)
- 200 -> healthy, 404 -> revoked (user uninstalled the app), anything else -> throw (transient / unexpected)
- `createGitHubAppJWT` is already in scope (defined at line 31 of the same file)
- Headers match the existing GitHub API call pattern in `getInstallationToken` (lines 48-59)

#### 2. Linear — `providers/linear/index.ts`

**File**: `packages/console-providers/src/providers/linear/index.ts`
**Location**: Inside `defineWebhookProvider({...})`, after the `backfill: linearBackfill,` line (line 300)
**Changes**: Add `healthCheck` block

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
    return "revoked";
  },
},
```

**Rationale**:
- Probe: `POST /graphql { viewer { id } }` — same query used in `fetchLinearExternalId` (line 44). Minimal, confirms token is valid.
- Auth: `Bearer ${accessToken}` — stored user OAuth token
- Linear wraps auth errors in HTTP 200 with `errors` array. A revoked token returns `{ data: null, errors: [...] }` with HTTP 200. Must check `result.data?.viewer?.id` presence, not just `response.ok`.
- Null `accessToken` -> immediate `"revoked"` (no token stored means connection is broken)
- Non-200 HTTP response -> `"revoked"` (defensive, though Linear rarely returns non-200)

#### 3. Sentry — `providers/sentry/index.ts`

**File**: `packages/console-providers/src/providers/sentry/index.ts`
**Location**: Inside `defineWebhookProvider({...})`, after the `backfill: sentryBackfill,` line (line 196)
**Changes**: Add `healthCheck` block

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

**Rationale**:
- Probe: `GET /api/0/sentry-app-installations/{externalId}/` — checks installation exists and is active
- Auth: `Bearer ${config.clientSecret}` — **NOT** the user `accessToken`. This is confirmed by the existing `revokeToken` implementation (line 318) which uses `config.clientSecret` for the same `DELETE /sentry-app-installations/{id}/` endpoint. The `_accessToken` param is ignored.
- 200 -> healthy, 404 -> revoked (installation removed), 403 -> revoked (auth failure / installation deauthorized), anything else -> throw
- `externalId` is the Sentry installation UUID (set during `processCallback` at line 350)

#### 4. Vercel — `providers/vercel/index.ts`

**File**: `packages/console-providers/src/providers/vercel/index.ts`
**Location**: Inside `defineWebhookProvider({...})`, after the `backfill: vercelBackfill,` line (line 169)
**Changes**: Add `healthCheck` block

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

**Rationale**:
- Probe: `GET /v2/user` — lightweight user info endpoint, confirms token validity
- Auth: `Bearer ${accessToken}` — stored user OAuth token (long-lived, no refresh)
- Vercel returns 403 (not 401) for revoked tokens — both 401 and 403 map to `"revoked"` defensively
- Null `accessToken` -> immediate `"revoked"` (Vercel uses stored tokens, `usesStoredToken: true`)

---

#### 5. GitHub Tests — `providers/github/index.test.ts`

**File**: `packages/console-providers/src/providers/github/index.test.ts`
**Location**: After the existing `"extractSecret"` describe block (end of file, line 409)
**Changes**: Add `healthCheck.check` test suite

```ts
// ── healthCheck.check ─────────────────────────────────────────────────────────

describe("healthCheck.check", () => {
  it("returns 'healthy' when GitHub returns 200", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });

    const result = await github.healthCheck!.check(testConfig, "12345", null);
    expect(result).toBe("healthy");
  });

  it("returns 'revoked' when GitHub returns 404 (installation uninstalled)", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });

    const result = await github.healthCheck!.check(testConfig, "12345", null);
    expect(result).toBe("revoked");
  });

  it("throws on unexpected HTTP status", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

    await expect(
      github.healthCheck!.check(testConfig, "12345", null)
    ).rejects.toThrow("GitHub health check failed: 500");
  });

  it("calls GET /app/installations/{externalId} with App JWT auth", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });

    await github.healthCheck!.check(testConfig, "99999", null);

    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.github.com/app/installations/99999");
    expect(init.method).toBe("GET");
    const authHeader =
      (init.headers as Record<string, string>).Authorization ?? "";
    expect(authHeader).toMatch(/^Bearer /);
  });

  it("ignores accessToken param — uses App JWT", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });

    // accessToken is null for GitHub app-token providers
    const result = await github.healthCheck!.check(testConfig, "12345", null);
    expect(result).toBe("healthy");
  });
});
```

#### 6. Linear Tests — `providers/linear/index.test.ts`

**File**: `packages/console-providers/src/providers/linear/index.test.ts`
**Location**: After the existing `"webhook.parsePayload"` describe block (end of file, line 541)
**Changes**: Add `healthCheck.check` test suite

```ts
// ── healthCheck.check ─────────────────────────────────────────────────────────

describe("healthCheck.check", () => {
  it("returns 'healthy' when viewer query succeeds", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({ data: { viewer: { id: "viewer-id-abc" } } }),
    });

    const result = await linear.healthCheck!.check(
      testConfig,
      "org-id",
      "lin_api_token123"
    );
    expect(result).toBe("healthy");
  });

  it("returns 'revoked' when accessToken is null", async () => {
    const result = await linear.healthCheck!.check(
      testConfig,
      "org-id",
      null
    );
    expect(result).toBe("revoked");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns 'revoked' when HTTP response is not ok", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });

    const result = await linear.healthCheck!.check(
      testConfig,
      "org-id",
      "bad-token"
    );
    expect(result).toBe("revoked");
  });

  it("returns 'revoked' when viewer is null (GraphQL auth error wrapped in 200)", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          data: null,
          errors: [
            {
              message: "Authentication required",
              extensions: { type: "AUTHENTICATION_ERROR" },
            },
          ],
        }),
    });

    const result = await linear.healthCheck!.check(
      testConfig,
      "org-id",
      "revoked-token"
    );
    expect(result).toBe("revoked");
  });

  it("sends POST /graphql with viewer query and Bearer auth", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({ data: { viewer: { id: "viewer-id" } } }),
    });

    await linear.healthCheck!.check(testConfig, "org-id", "my-token");

    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.linear.app/graphql");
    expect(init.method).toBe("POST");
    const auth = (init.headers as Record<string, string>).Authorization;
    expect(auth).toBe("Bearer my-token");
    const body = JSON.parse(init.body as string) as { query: string };
    expect(body.query).toBe("{ viewer { id } }");
  });
});
```

#### 7. Sentry Tests — `providers/sentry/index.test.ts`

**File**: `packages/console-providers/src/providers/sentry/index.test.ts`
**Location**: After the existing `"webhook.parsePayload"` describe block (end of file, line 600)
**Changes**: Add `healthCheck.check` test suite

```ts
// ── healthCheck.check ─────────────────────────────────────────────────────────

describe("healthCheck.check", () => {
  it("returns 'healthy' when Sentry returns 200", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });

    const result = await sentry.healthCheck!.check(
      testConfig,
      installationId,
      "sentry-access-token"
    );
    expect(result).toBe("healthy");
  });

  it("returns 'revoked' when Sentry returns 404 (installation removed)", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });

    const result = await sentry.healthCheck!.check(
      testConfig,
      installationId,
      "sentry-access-token"
    );
    expect(result).toBe("revoked");
  });

  it("returns 'revoked' when Sentry returns 403", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 403 });

    const result = await sentry.healthCheck!.check(
      testConfig,
      installationId,
      "sentry-access-token"
    );
    expect(result).toBe("revoked");
  });

  it("throws on unexpected HTTP status", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

    await expect(
      sentry.healthCheck!.check(testConfig, installationId, "token")
    ).rejects.toThrow("Sentry health check failed: 500");
  });

  it("uses config.clientSecret for auth — NOT the accessToken param", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });

    await sentry.healthCheck!.check(
      testConfig,
      installationId,
      "user-access-token-should-be-ignored"
    );

    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain(
      `sentry-app-installations/${installationId}/`
    );
    expect(init.method).toBe("GET");
    const auth = (init.headers as Record<string, string>).Authorization;
    expect(auth).toBe(`Bearer ${testConfig.clientSecret}`);
  });
});
```

#### 8. Vercel Tests — `providers/vercel/index.test.ts`

**File**: `packages/console-providers/src/providers/vercel/index.test.ts`
**Location**: After the existing `"webhook.parsePayload"` describe block (end of file, line 547)
**Changes**: Add `healthCheck.check` test suite

```ts
// ── healthCheck.check ─────────────────────────────────────────────────────────

describe("healthCheck.check", () => {
  it("returns 'healthy' when Vercel returns 200", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });

    const result = await vercel.healthCheck!.check(
      testConfig,
      "team-456",
      "vercel-access-token-abc"
    );
    expect(result).toBe("healthy");
  });

  it("returns 'revoked' when accessToken is null", async () => {
    const result = await vercel.healthCheck!.check(
      testConfig,
      "team-456",
      null
    );
    expect(result).toBe("revoked");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns 'revoked' when Vercel returns 403", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 403 });

    const result = await vercel.healthCheck!.check(
      testConfig,
      "team-456",
      "bad-token"
    );
    expect(result).toBe("revoked");
  });

  it("returns 'revoked' when Vercel returns 401", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });

    const result = await vercel.healthCheck!.check(
      testConfig,
      "team-456",
      "expired-token"
    );
    expect(result).toBe("revoked");
  });

  it("throws on unexpected HTTP status", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

    await expect(
      vercel.healthCheck!.check(testConfig, "team-456", "token")
    ).rejects.toThrow("Vercel health check failed: 500");
  });

  it("calls GET /v2/user with Bearer auth", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });

    await vercel.healthCheck!.check(
      testConfig,
      "team-456",
      "my-vercel-token"
    );

    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.vercel.com/v2/user");
    expect(init.method).toBe("GET");
    const auth = (init.headers as Record<string, string>).Authorization;
    expect(auth).toBe("Bearer my-vercel-token");
  });
});
```

---

### Success Criteria

#### Automated Verification
- [ ] All existing tests still pass: `pnpm --filter @repo/console-providers test`
- [ ] New health check tests pass (20 new tests across 4 providers)
- [ ] Type checking passes: `pnpm --filter @repo/console-providers typecheck`
- [ ] Linting passes: `pnpm check`
- [ ] `github.healthCheck` is defined (not `undefined`)
- [ ] `linear.healthCheck` is defined (not `undefined`)
- [ ] `sentry.healthCheck` is defined (not `undefined`)
- [ ] `vercel.healthCheck` is defined (not `undefined`)

#### Manual Verification
- [ ] Confirm that `healthCheck` appears on the provider object when inspected (e.g., `console.log(Object.keys(github))`)
- [ ] Verify no new imports were needed (string literals `"healthy"` and `"revoked"` satisfy `ConnectionStatus` without explicit import)

**Implementation Note**: This is a single-phase plan. After all automated verification passes, the feature is complete. No manual testing required beyond the checks above since the health check functions are only called by the future cron job (not by any UI or API endpoint yet).

---

## Testing Strategy

### Unit Tests (per provider)

Each provider gets 4-6 tests covering:

1. **Happy path**: API returns 200 -> `"healthy"`
2. **Auth failure**: API returns 401/403/404 -> `"revoked"` (provider-specific status codes)
3. **Null token handling**: For Linear and Vercel where `accessToken` matters, `null` -> `"revoked"` without calling fetch
4. **Unexpected errors**: API returns 5xx -> throws Error (cron job interprets as transient failure)
5. **Correct endpoint + auth**: Verify the URL, method, and Authorization header

### Edge Cases Covered

| Edge Case | Provider | Expected |
|-----------|----------|----------|
| `accessToken` is `null` | Linear, Vercel | `"revoked"` (no fetch call) |
| `accessToken` is `null` | GitHub | Works fine (uses App JWT from config) |
| `accessToken` is `null` | Sentry | Works fine (uses `config.clientSecret`) |
| GraphQL 200 with auth error | Linear | `"revoked"` (inspects `data.viewer.id`) |
| 403 instead of 401 | Vercel | `"revoked"` (both mapped) |
| 404 for deleted installation | GitHub, Sentry | `"revoked"` |
| Network timeout | All | `AbortError` thrown (cron handles) |

### Test Pattern

All tests follow the existing mock-fetch pattern:
- `vi.stubGlobal("fetch", mockFetch)` in `beforeAll`
- `mockFetch.mockReset()` in `afterEach`
- `mockFetch.mockResolvedValueOnce(...)` per test
- Assert on `mockFetch.mock.calls[0]` for request verification

## Performance Considerations

- Each `check()` call is a single HTTP request with 10-second timeout
- GitHub's JWT creation uses `createRS256JWT` which is async (Web Crypto) but fast (~1ms)
- Linear's GraphQL query `{ viewer { id } }` is the minimal possible query
- No retry logic — the cron job owns retry scheduling (re-probes on next 5m cycle)

## Dependencies

- **Phase 0 DB schema migration** must be complete before the health check cron can store results. However, the `check()` implementations themselves have no DB dependency and can be merged independently.
- **No external package additions** — all implementations use `fetch()` which is available in Node 22+ and edge runtimes.

## References

- Research document: `thoughts/shared/research/2026-03-18-provider-health-check-impl.md`
- Platform architecture plan (health check cron): `thoughts/shared/plans/2026-03-18-platform-architecture-redesign.md` (section "Health Check -> Lifecycle Trigger")
- Type definitions: `packages/console-providers/src/provider/api.ts` (lines 5-26)
- Shape definition: `packages/console-providers/src/provider/shape.ts` (line 55)
- Factory: `packages/console-providers/src/factory/webhook.ts` (lines 57-64)
