---
date: 2026-04-05T00:00:00+00:00
researcher: claude
git_commit: 49b1745f8253dd50feff86d7d7db1f8b95628480
branch: main
topic: "How apps/app and apps/platform communicate — authentication flow from sources page to GitHub org details"
tags: [research, codebase, authentication, tRPC, platform, github, service-jwt, clerk]
status: complete
last_updated: 2026-04-05
---

# Research: App ↔ Platform Authentication & GitHub Org Details Flow

**Date**: 2026-04-05
**Git Commit**: `49b1745f8`
**Branch**: main

## Research Question

How do `apps/app` and `apps/platform` communicate in terms of authentication? Trace the full caller flow from `apps/app/src/app/(app)/(org)/[slug]/(manage)/sources/page.tsx` to fetching GitHub org details.

## Summary

The two apps use a **two-layer tRPC architecture** with distinct auth mechanisms:

- **Layer 1 (apps/app)**: Clerk session-based auth. The browser sends Clerk session cookies; the app's tRPC context resolves a discriminated union (`clerk-active`, `clerk-pending`, `unauthenticated`). Org-scoped procedures require `clerk-active` (both `userId` and `orgId` present).

- **Layer 2 (apps/platform)**: Service JWT auth. When the app's tRPC procedures need platform data, they call `createMemoryCaller()` which signs a short-lived HS256 JWT (60s TTL, `iss="console"`, `aud="lightfast-memory"`) and invokes the platform router **in-process** — no HTTP round-trip. The platform verifies the JWT and grants `serviceProcedure` access.

For GitHub specifically, the platform does not store OAuth tokens. GitHub uses a **GitHub App model**: the platform generates a fresh installation access token on every API call by signing a RS256 App JWT and calling `POST /app/installations/{id}/access_tokens`.

## Detailed Findings

### 1. Browser → App tRPC (Clerk Auth)

When a user navigates to `/{slug}/sources`, the RSC page renders on the server.

**Context creation** ([`api/app/src/trpc.ts:60-90`](https://github.com/lightfastai/lightfast/blob/49b1745f8/api/app/src/trpc.ts#L60-L90)):
- Calls `auth()` from `@vendor/clerk/server`
- Produces a discriminated union `AuthContext`:
  - `clerk-active`: both `userId` and `orgId` present → full org access
  - `clerk-pending`: only `userId` → user-level access only
  - `unauthenticated`: no session

**RSC entry** ([`packages/app-trpc/src/server.tsx:14-18`](https://github.com/lightfastai/lightfast/blob/49b1745f8/packages/app-trpc/src/server.tsx#L14-L18)):
- `createContext()` is `cache()`-wrapped, runs once per request
- Reads Next.js `headers()`, sets `x-trpc-source: "rsc"`, passes to `createTRPCContext`

**Procedure guards** ([`api/app/src/trpc.ts:246-272`](https://github.com/lightfastai/lightfast/blob/49b1745f8/api/app/src/trpc.ts#L246-L272)):
- `orgScopedProcedure` requires `clerk-active` — throws `FORBIDDEN` for `clerk-pending`
- Both `connections.generic.listInstallations` and `connections.resources.list` use `orgScopedProcedure`

### 2. App tRPC → Platform tRPC (Service JWT)

When an app-side procedure needs platform data, it calls `createMemoryCaller()`.

**Caller factory** ([`packages/platform-trpc/src/caller.ts:20`](https://github.com/lightfastai/lightfast/blob/49b1745f8/packages/platform-trpc/src/caller.ts#L20)):
1. Calls `signServiceJWT("console")` — produces an HS256 JWT with `iss="console"`, `aud="lightfast-memory"`, 60s expiry
2. Constructs synthetic `Headers` with `Authorization: Bearer <token>` and `x-trpc-source: console-service`
3. Calls `createMemoryTRPCContext({ headers })` — the platform's context factory, **in the same Node.js process**
4. Returns `memoryRouter.createCaller(ctx)` — a direct function call interface

**This is not an HTTP call.** The app imports `@api/platform` as a workspace dependency and invokes the router directly. The JWT exists to enforce the auth contract even in-process.

**JWT signing** ([`api/platform/src/lib/jwt.ts:31-41`](https://github.com/lightfastai/lightfast/blob/49b1745f8/api/platform/src/lib/jwt.ts#L31-L41)):
- Uses `jose` `SignJWT` with HS256
- Secret: `SERVICE_JWT_SECRET` env var (min 32 chars)
- TTL: 60 seconds

**JWT verification** ([`api/platform/src/lib/jwt.ts:50-63`](https://github.com/lightfastai/lightfast/blob/49b1745f8/api/platform/src/lib/jwt.ts#L50-L63)):
- `jwtVerify` with `audience: "lightfast-memory"`, `algorithms: ["HS256"]`
- Extracts `iss` claim as caller identity

**Platform context** ([`api/platform/src/trpc.ts:38-77`](https://github.com/lightfastai/lightfast/blob/49b1745f8/api/platform/src/trpc.ts#L38-L77)):
- Extracts `Authorization: Bearer` header
- Calls `verifyServiceJWT(token)`
- Resolves to `{ auth: { type: "service", caller: "console" } }`

**Platform procedure guard** ([`api/platform/src/trpc.ts:143-160`](https://github.com/lightfastai/lightfast/blob/49b1745f8/api/platform/src/trpc.ts#L143-L160)):
- `serviceProcedure` requires `ctx.auth.type === "service"`, throws `UNAUTHORIZED` otherwise
- All platform router procedures (`connections`, `proxy`, `backfill`) use `serviceProcedure`

### 3. The Specific Flow: Sources Page → GitHub Org Details

```
Browser GET /{slug}/sources
  │
  ▼
sources/page.tsx (RSC)
  │  prefetch(trpc.connections.generic.listInstallations({ provider: "github" }))
  │  prefetch(trpc.connections.resources.list())
  │
  ▼
orgScopedProcedure middleware
  │  Clerk auth() → requires clerk-active (userId + orgId)
  │  Throws FORBIDDEN if no org context
  │
  ▼
connections.generic.listInstallations  [api/app/src/router/org/connections.ts:652]
  │  1. Queries gatewayInstallations WHERE provider="github" AND orgId=ctx.auth.orgId
  │  2. For each installation → calls providerDef.resourcePicker.enrichInstallation()
  │
  ▼
github.resourcePicker.enrichInstallation()  [packages/app-providers/src/providers/github/index.ts]
  │  Calls proxy.execute("github", "get-app-installation", { installation_id })
  │
  ▼
createMemoryCaller()  [packages/platform-trpc/src/caller.ts:20]
  │  signServiceJWT("console") → HS256 JWT, 60s TTL
  │  createMemoryTRPCContext({ headers }) → in-process
  │  memoryRouter.createCaller(ctx)
  │
  ▼
memory.proxy.execute  [api/platform/src/router/memory/proxy.ts]
  │  Detects endpoint has buildAuth → uses App JWT instead of installation token
  │
  ▼
buildGitHubAppAuth()  [packages/app-providers/src/providers/github/api.ts]
  │  createRS256JWT({ appId, privateKey }) → GitHub App JWT (RS256)
  │
  ▼
GET https://api.github.com/app/installations/{id}
  │  Authorization: Bearer <github-app-jwt>
  │
  ▼
Response: { account: { login: "org-name", avatar_url: "..." }, ... }
  │  → enriched installation with org name + avatar returned to UI
```

### 4. Token Model: GitHub vs Other Providers

GitHub is unique among providers in this codebase:

| Aspect | GitHub | Other Providers (e.g., Sentry, Linear) |
|--------|--------|---------------------------------------|
| Auth kind | `"app-token"` | `"oauth"` |
| Uses stored token | `false` | `true` |
| Token acquisition | Fresh installation access token per call via `POST /app/installations/{id}/access_tokens` | Stored in `gatewayTokens` table (AES-GCM encrypted), refreshed on expiry |
| App-level auth | RS256 JWT signed with GitHub App private key | N/A |

**GitHub App JWT generation** ([`packages/app-providers/src/runtime/jwt.ts`](https://github.com/lightfastai/lightfast/blob/49b1745f8/packages/app-providers/src/runtime/jwt.ts)):
- Uses `jose` `SignJWT` with RS256 + PKCS#8 private key
- `iss = GITHUB_APP_ID`, 10-minute expiry
- Used to authenticate as the GitHub App itself (not as a user)

**Installation access token** ([`packages/app-providers/src/providers/github/index.ts`](https://github.com/lightfastai/lightfast/blob/49b1745f8/packages/app-providers/src/providers/github/index.ts)):
- `getInstallationToken()` calls `POST https://api.github.com/app/installations/{id}/access_tokens` with the App JWT
- Returns a short-lived token scoped to that specific installation's permissions
- This is the token used for data-plane operations (listing repos, reading PRs, etc.)

### 5. Auth Layers Summary

The full request touches **four distinct auth boundaries**:

1. **Clerk session** → Browser to app tRPC (cookie-based, org-scoped)
2. **Service JWT** → App tRPC to platform tRPC (HS256, in-process, `aud="lightfast-memory"`)
3. **GitHub App JWT** → Platform to GitHub API (RS256, `iss=APP_ID`)
4. **Installation access token** → GitHub API data access (short-lived, per-installation)

For the `get-app-installation` endpoint specifically, only layers 1–3 are used (the App JWT authenticates directly; no installation access token needed).

## Code References

- `apps/app/src/app/(app)/(org)/[slug]/(manage)/sources/page.tsx` — Sources page, prefetches `listInstallations` and `resources.list`
- `api/app/src/trpc.ts:60-90` — App tRPC context creation (Clerk auth)
- `api/app/src/trpc.ts:246-272` — `orgScopedProcedure` definition
- `api/app/src/router/org/connections.ts:652` — `connections.generic.listInstallations` procedure
- `packages/platform-trpc/src/caller.ts:20` — `createMemoryCaller()` — in-process platform caller
- `api/platform/src/lib/jwt.ts:31-63` — Service JWT sign/verify
- `api/platform/src/trpc.ts:38-77` — Platform context creation (service JWT auth)
- `api/platform/src/trpc.ts:143-160` — `serviceProcedure` guard
- `api/platform/src/router/memory/proxy.ts:143` — Proxy execute, `buildAuth` special case
- `packages/app-providers/src/providers/github/index.ts` — GitHub provider: `enrichInstallation`, `getInstallationToken`, `getActiveToken`
- `packages/app-providers/src/providers/github/api.ts` — GitHub API catalog with `buildAuth` for App JWT endpoints
- `packages/app-providers/src/runtime/jwt.ts` — RS256 JWT creation for GitHub App auth
- `api/platform/src/lib/token-helpers.ts` — Token vault read path (not used for GitHub)

## Architecture Documentation

### Communication Topology

```
┌──────────────────────────────────────────────────────────┐
│  Browser                                                  │
│  Clerk session cookie → httpBatchStreamLink → /api/trpc  │
└──────────────────┬───────────────────────────────────────┘
                   │ HTTP (Clerk auth)
                   ▼
┌──────────────────────────────────────────────────────────┐
│  apps/app (Next.js, port 4107)                           │
│  @api/app tRPC router                                    │
│  orgScopedProcedure: requires clerk-active (userId+orgId)│
│                                                          │
│  connections router calls createMemoryCaller()           │
│  ─────────────────────────────────────────────           │
│  In-process call (no HTTP)                               │
│  Service JWT: HS256, 60s TTL, aud="lightfast-memory"     │
└──────────────────┬───────────────────────────────────────┘
                   │ In-process (service JWT)
                   ▼
┌──────────────────────────────────────────────────────────┐
│  @api/platform (imported as workspace dep)               │
│  memoryRouter: connections, proxy, backfill              │
│  serviceProcedure: requires auth.type === "service"      │
│                                                          │
│  proxy.execute: resolves provider auth, calls external   │
└──────────────────┬───────────────────────────────────────┘
                   │ HTTPS (GitHub App JWT / installation token)
                   ▼
┌──────────────────────────────────────────────────────────┐
│  GitHub API (api.github.com)                             │
│  App JWT endpoints: GET /app/installations/{id}          │
│  Installation token endpoints: repos, PRs, issues, etc.  │
└──────────────────────────────────────────────────────────┘
```

### Key Design Decisions Present in the Code

- **In-process over HTTP**: The app calls platform's router directly via `memoryRouter.createCaller()`, avoiding network overhead. The JWT is still signed/verified to maintain the auth contract.
- **GitHub App model (not OAuth)**: GitHub uses `auth.kind: "app-token"` with `usesStoredToken: false`. No tokens are stored in the vault. Fresh installation access tokens are generated per-call.
- **`buildAuth` escape hatch**: The proxy's `execute` procedure checks if an API endpoint declares its own `buildAuth` function. GitHub's `get-app-installation` uses this to authenticate as the App itself (RS256 JWT) rather than as an installation.
- **Shared secret JWT**: Both apps share `SERVICE_JWT_SECRET`. There is no per-caller key — the `iss` claim distinguishes callers (`"console"` for the app, `"admin"` for admin procedures).

## Open Questions

- How does the HTTP path (client-side tRPC via `@repo/platform-trpc/react.tsx`) authenticate? The `MemoryTRPCReactProvider` creates an HTTP client pointing to platform's `/api/trpc/memory`, but no Bearer token injection is visible in the client-side link setup — this path may rely on CORS origin gating alone.
