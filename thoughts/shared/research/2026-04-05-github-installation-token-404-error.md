---
date: 2026-04-05T12:00:00+08:00
researcher: claude
git_commit: 38ecf9eb8fa69b8e69b9f78179468c3d86a3a492
branch: main
topic: "GitHub installation token request failed: 404 on connections.generic.listResources"
tags: [research, codebase, github, token, connections, proxy, tRPC]
status: complete
last_updated: 2026-04-05
---

# Research: GitHub Installation Token Request Failed: 404

**Date**: 2026-04-05
**Git Commit**: 38ecf9eb8fa69b8e69b9f78179468c3d86a3a492
**Branch**: main

## Research Question

Investigate the tRPC error on `connections.generic.listResources`:
```
Error [TRPCError]: token_error: GitHub installation token request failed: 404
```

## Summary

The error originates from the GitHub provider's `getInstallationToken()` function when it calls the GitHub API endpoint `POST /app/installations/{id}/access_tokens` and receives a **404 response**. This means the GitHub App installation ID stored in the database (`gatewayInstallations.externalId`) no longer maps to a valid installation on GitHub's side — the GitHub App has been uninstalled or the installation ID is stale.

## Detailed Findings

### 1. Complete Error Call Chain

The error propagates through four layers:

```
[UI] connections.generic.listResources  (app tRPC)
  → memory.proxy.execute               (platform tRPC via createMemoryCaller)
    → getActiveTokenForInstallation()   (platform lib/token-helpers.ts)
      → github.auth.getActiveToken()    (app-providers/github/index.ts:163)
        → getInstallationToken()        (app-providers/github/index.ts:39)
          → POST https://api.github.com/app/installations/{id}/access_tokens  ← 404
```

### 2. Where the Error is Thrown

**File**: [`packages/app-providers/src/providers/github/index.ts:61-64`](https://github.com/lightfastai/lightfast/blob/38ecf9eb8fa69b8e69b9f78179468c3d86a3a492/packages/app-providers/src/providers/github/index.ts#L61-L64)

```ts
if (!response.ok) {
  throw new Error(
    `GitHub installation token request failed: ${response.status}`
  );
}
```

The function `getInstallationToken()` (line 39) takes a `config: GitHubConfig` and `installationId: string`, generates a GitHub App JWT, then POSTs to GitHub's installation access token endpoint. A 404 means GitHub does not recognize the installation ID.

### 3. How the Token is Acquired

**File**: [`api/platform/src/lib/token-helpers.ts:14-69`](https://github.com/lightfastai/lightfast/blob/38ecf9eb8fa69b8e69b9f78179468c3d86a3a492/api/platform/src/lib/token-helpers.ts#L14-L69)

`getActiveTokenForInstallation()`:
1. Queries `gatewayTokens` for the installation's stored token
2. If the token is expired and has a `refreshToken`, attempts an OAuth refresh
3. Otherwise, calls `providerDef.auth.getActiveToken(config, installation.externalId, decryptedAccessToken)`

For GitHub (auth kind `"app-token"`), `getActiveToken` at line 163 directly calls `getInstallationToken(config, storedExternalId)` — meaning it always mints a fresh installation token from GitHub's API. The `storedExternalId` is the numeric GitHub installation ID.

### 4. Where the Error is Wrapped as `token_error`

**File**: [`api/platform/src/router/memory/proxy.ts:160-169`](https://github.com/lightfastai/lightfast/blob/38ecf9eb8fa69b8e69b9f78179468c3d86a3a492/api/platform/src/router/memory/proxy.ts#L160-L169)

```ts
} catch (err) {
  log.error("[proxy] token acquisition failed", { ... });
  throw new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: `token_error: ${err instanceof Error ? err.message : "unknown error"}`,
  });
}
```

The raw `Error("GitHub installation token request failed: 404")` is caught and re-thrown as a `TRPCError` with the `token_error:` prefix.

### 5. What Triggers This Code Path

**File**: [`api/app/src/router/org/connections.ts:710-779`](https://github.com/lightfastai/lightfast/blob/38ecf9eb8fa69b8e69b9f78179468c3d86a3a492/api/app/src/router/org/connections.ts#L710-L779)

The `listResources` procedure:
1. Looks up the `gatewayInstallation` record by ID + orgId + provider + status="active"
2. Creates a `memory` caller (service-to-service tRPC to the platform service)
3. Builds an `executeApi` callback that proxies API calls through `memory.proxy.execute`
4. Calls `providerDef.resourcePicker.listResources(executeApi, installation)` — which for GitHub calls `list-installation-repos` endpoint

The `listResources` for GitHub (line 308 in github/index.ts) calls `executeApi({ endpointId: "list-installation-repos", queryParams: { per_page: "100" } })`. Before making the actual API call, `proxy.execute` needs to acquire a token — and that's where the 404 occurs.

### 6. GitHub's `auth.kind: "app-token"` Flow

**File**: [`packages/app-providers/src/providers/github/index.ts:153-165`](https://github.com/lightfastai/lightfast/blob/38ecf9eb8fa69b8e69b9f78179468c3d86a3a492/packages/app-providers/src/providers/github/index.ts#L153-L165)

```ts
auth: {
  kind: "app-token" as const,
  usesStoredToken: false as const,
  getActiveToken: async (config, storedExternalId, _storedAccessToken) => {
    return getInstallationToken(config, storedExternalId);
  },
}
```

Key detail: `usesStoredToken: false` — GitHub never stores/reuses access tokens. Every API call generates a fresh installation token from the GitHub API. This means the 404 error will occur on every request for a stale installation, not just on a refresh attempt.

### 7. What a 404 from GitHub Means

The GitHub API returns 404 on `POST /app/installations/{id}/access_tokens` when:
- The GitHub App has been **uninstalled** by the org/user on GitHub
- The installation ID does not exist (was never valid or was deleted)
- The GitHub App JWT is authenticating as a different app than the one that owns the installation

The installation record in `gatewayInstallations` still has `status: "active"`, so the system doesn't know the app was uninstalled until this token request fails.

### 8. Existing Error Handling for Stale Installations

The `listResources` procedure has a 401 handler (connections.ts:755-764) that marks installations as `status: "error"` when a provider returns 401. However, the `token_error` is thrown before any API call is made — it occurs during token acquisition, not in the API response. The `TRPCError` with `INTERNAL_SERVER_ERROR` code propagates up to the UI unhandled.

## Code References

- `packages/app-providers/src/providers/github/index.ts:39-72` — `getInstallationToken()` function
- `packages/app-providers/src/providers/github/index.ts:163-164` — `getActiveToken` delegates to `getInstallationToken`
- `api/platform/src/lib/token-helpers.ts:14-69` — `getActiveTokenForInstallation()` orchestration
- `api/platform/src/router/memory/proxy.ts:143-170` — Token acquisition + `token_error` wrapping
- `api/app/src/router/org/connections.ts:710-779` — `listResources` procedure
- `api/app/src/router/org/connections.ts:748` — `createMemoryCaller()` for service-to-service call
- `packages/app-providers/src/providers/github/index.ts:308-320` — GitHub's `listResources` implementation
- `packages/app-providers/src/providers/github/index.test.ts:365` — Test asserting the 404 error message

## Architecture Documentation

### Token Acquisition for GitHub (app-token kind)

Unlike OAuth providers (Linear, Vercel, Sentry) that store and refresh long-lived tokens, GitHub uses a **GitHub App model** where:
1. A JWT is generated from the App's private key (`createGitHubAppJWT`)
2. The JWT is used to request a short-lived installation access token from GitHub's API
3. Installation tokens expire after 1 hour and are never stored — `usesStoredToken: false`
4. Each API proxy call generates a fresh token

### Service-to-Service Communication

The `app` tRPC service communicates with the `platform` tRPC service via `createMemoryCaller()` (imported from `@repo/platform-trpc/caller`). The `listResources` call in the app routes through `memory.proxy.execute` on the platform side, which handles token acquisition and API proxying.

## Open Questions

1. **Installation health detection**: The installation record remains `status: "active"` in the database after the GitHub App is uninstalled. The 401 handler in `listResources` marks installations as `"error"`, but the `token_error` path (which fires before any API call) does not update the installation status. Should `token_error` responses also mark the installation as errored?

2. **Health check coverage**: The platform has a `health-check.ts` Inngest function that calls `getActiveTokenForInstallation`. Does it currently detect and handle 404 failures for GitHub installations, or does it only check OAuth token expiry?
