---
date: 2026-02-28T08:30:00+11:00
researcher: jeevan
git_commit: a24a17cacf5dba220c39c84e65e8b22d62e00c51
branch: feat/gateway-foundation
repository: lightfast
topic: "GitHub Connection Flow: First Connect, No gw-tokens, Auto-refresh, invalid_or_expired_state on Second Org"
tags: [research, codebase, github, connections, gateway, oauth, state-token]
status: complete
last_updated: 2026-02-28
last_updated_by: jeevan
---

# Research: GitHub Connection Flow

**Date**: 2026-02-28T08:30:00+11:00
**Git Commit**: a24a17cacf5dba220c39c84e65e8b22d62e00c51
**Branch**: feat/gateway-foundation

## Research Question

User went through first-time GitHub connection at `/new`, observed:
1. `provider_account_info` stored correctly in `gw_installations`
2. No `gw_tokens` record created for GitHub org connection
3. GitHub component did NOT auto-refresh — required manual page reload to see org
4. When trying to add a **second org** via "Adjust GitHub App permissions →", got `invalid_or_expired_state` error

---

## Summary

The GitHub connection uses a **GitHub App installation flow** (not OAuth), which is fundamentally different from other providers. No `gw_tokens` are created for GitHub by design — it uses short-lived JWT installation tokens generated on-demand. The auto-refresh didn't trigger because the popup redirect to the "connected" page doesn't auto-close. The `invalid_or_expired_state` error on the second org happens because `handleAdjustPermissions` bypasses the state token mechanism: it opens GitHub's native `installations/select_target` URL directly, and when a **brand new** installation_id comes back in the callback, the DB fallback can't resolve it (no existing record to look up).

---

## Detailed Findings

### 1. First-Time Connection Flow (works correctly)

**File**: `apps/console/src/app/(app)/(user)/new/_components/github-source-item.tsx`

`handleConnect()` (line 147–178):
1. Calls `trpc.connections.getAuthorizeUrl({ provider: "github" })`
2. tRPC proxy (`api/console/src/router/org/connections.ts:59–84`) calls the connections service `GET /services/connections/github/authorize` with `X-Org-Id`, `X-User-Id`, `X-API-Key`
3. Connections service generates a `nanoid()` state token and stores in Redis for 10 min:
   ```
   key = oauth:state:{state}
   hash = { provider, orgId, connectedBy, createdAt }
   TTL = 600 seconds
   ```
   (`apps/connections/src/routes/connections.ts:54–73`)
4. Returns `{ url, state }` where URL = `https://github.com/apps/{SLUG}/installations/new?state={state}`
5. Opens popup, poll timer checks `popup.closed` every 500ms
6. After GitHub App installation, GitHub redirects popup to `GET /services/connections/github/callback?installation_id=...&state=...`
7. Callback does **atomic read-and-delete** of state from Redis (`multi().hgetall().del()`), recovering `orgId` and `connectedBy`
8. Calls `GitHubProvider.handleCallback()` which: fetches installation details from GitHub API, builds `providerAccountInfo`, upserts to `gwInstallations`
9. Popup redirects to `${consoleUrl}/provider/github/connected`
10. When popup closes, poll timer fires `refetchConnection()`

---

### 2. Why No gw-tokens for GitHub — Intentional

**File**: `apps/connections/src/providers/impl/github.ts:206–213`

```typescript
async resolveToken(installation: GwInstallation): Promise<JwtTokenResult> {
  const token = await getInstallationToken(installation.externalId);
  return {
    accessToken: token,
    provider: "github",
    expiresIn: 3600, // GitHub installation tokens expire in 1 hour
  };
}
```

GitHub App uses **JWT-based installation tokens** (`getInstallationToken(externalId)` from `apps/connections/src/lib/github-jwt.ts`). These are generated on-demand from the App's private key — no OAuth access token is stored in `gw_tokens`. This is confirmed in `connections.ts:335`:
```typescript
hasToken: installation.provider === "github" ? true : installation.tokens.length > 0,
```
The `hasToken` check short-circuits for GitHub — it always returns `true` without checking `gw_tokens`.

The `gw_tokens` table is used by **Vercel, Linear, Sentry** (OAuth-based providers that store access + refresh tokens). GitHub is the only provider using JWT installation tokens.

---

### 3. Auto-Refresh Didn't Trigger After First Connect

**File**: `apps/console/src/app/(app)/(user)/new/_components/github-source-item.tsx:166–174`

```typescript
pollTimerRef.current = setInterval(() => {
  if (popup.closed) {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    void refetchConnection();
  }
}, 500);
```

The poll timer fires `refetchConnection()` **when the popup closes**. The popup after callback is redirected to `${consoleUrl}/provider/github/connected` — this page stays open (no auto-close script for the UI callback path, unlike the CLI "inline" path which includes `setTimeout(()=>window.close(),2000)`).

The user must **manually close the popup** for the poll timer to trigger `refetchConnection()`. If the user doesn't close the popup (just moves away from it), the timer never fires → no auto-refresh → data appears stale until page reload.

The CLI path (`redirectTo === "inline"`) does auto-close after 2 seconds (`apps/connections/src/routes/connections.ts:202–218`), but the UI path has no such behavior.

---

### 4. `invalid_or_expired_state` When Adding Second Org

**Root cause**: `handleAdjustPermissions` opens GitHub's native URL without generating a state token.

**File**: `apps/console/src/app/(app)/(user)/new/_components/github-source-item.tsx:129–145`

```typescript
const handleAdjustPermissions = () => {
  const popup = window.open(
    `https://github.com/apps/${githubEnv.NEXT_PUBLIC_GITHUB_APP_SLUG}/installations/select_target`,
    // ↑ Opens GitHub's native multi-org selector directly — NO state token generated
    ...
  );
  const pollTimer = setInterval(() => {
    if (popup?.closed) {
      clearInterval(pollTimer);
      void refetchConnection();  // Only refetches, no state token involved
    }
  }, 500);
};
```

When a user adds a **second org** through `installations/select_target`:
1. GitHub redirects to `GET /services/connections/github/callback?installation_id=<NEW_ID>&setup_action=install`
2. `state` query param is absent (or is GitHub's internal value, not a Redis key)
3. `resolveAndConsumeState()` returns `null`

The GitHub-specific fallback in `connections.ts:149–175`:
```typescript
if (!stateData && providerName === "github") {
  const installationId = c.req.query("installation_id");
  if (installationId) {
    const existing = await db.select(...)
      .from(gwInstallations)
      .where(
        and(
          eq(gwInstallations.provider, "github"),
          eq(gwInstallations.externalId, installationId),  // ← looks for NEW_ID
        ),
      )
      .limit(1);
    const row = existing[0];
    if (row) {
      stateData = { provider: "github", orgId: row.orgId, connectedBy: row.connectedBy };
    }
  }
}
```

**For a NEW org's installation**: `installationId = <NEW_ID>` → not in DB yet → `existing[0]` is undefined → `stateData` stays `null` → line 177: `return c.json({ error: "invalid_or_expired_state" }, 400)`.

**When the fallback WORKS** (existing org reinstall/permission update): Same `installation_id` as an existing `gwInstallations` record → DB lookup succeeds → `orgId` and `connectedBy` recovered → callback proceeds normally.

The `installations/select_target` URL is designed for **adjusting existing installations** (hence "Adjust GitHub App permissions" label). Adding a brand new org through this flow sends a new `installation_id` that the fallback cannot resolve.

---

## Code References

| File | Lines | Description |
|------|-------|-------------|
| `apps/console/src/app/(app)/(user)/new/_components/github-source-item.tsx` | 129–145 | `handleAdjustPermissions` — opens GitHub selector with no state token |
| `apps/console/src/app/(app)/(user)/new/_components/github-source-item.tsx` | 147–178 | `handleConnect` — generates state, opens popup, polls for close |
| `apps/console/src/app/(app)/(user)/new/_components/github-source-item.tsx` | 52–56 | `useSuspenseQuery` with `refetchOnMount: false, refetchOnWindowFocus: false` |
| `apps/connections/src/routes/connections.ts` | 54–73 | State token generation and Redis storage (10 min TTL) |
| `apps/connections/src/routes/connections.ts` | 80–97 | `resolveAndConsumeState` — atomic read-and-delete |
| `apps/connections/src/routes/connections.ts` | 149–175 | GitHub-specific fallback for stateless callbacks (reinstalls only) |
| `apps/connections/src/routes/connections.ts` | 177–178 | `invalid_or_expired_state` error returned when all recovery fails |
| `apps/connections/src/providers/impl/github.ts` | 206–213 | `resolveToken` — JWT-based, no gw_tokens used |
| `apps/connections/src/providers/impl/github.ts` | 119–203 | `handleCallback` — full installation upsert logic |
| `api/console/src/router/org/connections.ts` | 59–84 | `getAuthorizeUrl` tRPC procedure — proxies to connections service |
| `db/console/src/schema/tables/gw-installations.ts` | 30–66 | `providerAccountInfo` discriminated union schema |

---

## Architecture Documentation

### GitHub vs OAuth Providers

| Aspect | GitHub | Vercel / Linear / Sentry |
|--------|--------|--------------------------|
| Auth mechanism | GitHub App (JWT) | OAuth 2.0 |
| Token storage | None (`gw_tokens` unused) | Stored encrypted in `gw_tokens` |
| Token renewal | Generated on-demand from private key | `refreshToken` flow |
| Callback recovery | Falls back to DB lookup by `installation_id` | Must have valid state token |
| State token | Required for NEW installs | Always required |

### State Token Lifecycle

```
getAuthorizeUrl → nanoid() → Redis hset(oauth:state:{state}, {orgId, connectedBy}, TTL 600s)
                                          ↓
GitHub redirect → callback → Redis multi().hgetall().del() → stateData
                                          ↓
                              fallback: DB lookup by installation_id (GitHub only)
                                          ↓
                              null → invalid_or_expired_state (400)
```

### "Adjust Permissions" Button Limitation

The "Adjust GitHub App permissions →" button opens `installations/select_target` which:
- Works for modifying existing installations (DB fallback succeeds)
- Fails for adding NEW org installations (no state token + no DB record)

The button label implies permission adjustment, but the GitHub UI also allows adding new orgs through that endpoint.

---

## Related Research

- `thoughts/shared/plans/2026-02-28-fix-github-connector.md`
- `thoughts/shared/plans/2026-02-28-fix-github-installation-account-info.md`
- `thoughts/shared/plans/2026-02-28-provider-account-info-enforcement.md`

## Open Questions

- Does `${consoleUrl}/provider/github/connected` page have any auto-close behavior?
- When `handleAdjustPermissions` polls and calls `refetchConnection()` after a successful existing-org permission update, does the UI update correctly?
- Is there a separate path intended for adding a second GitHub org (vs. adjusting existing)?
