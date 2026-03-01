# Fix GitHub Connector - Implementation Plan

## Overview

The "Connect GitHub" button on the `/new` workspace creation page fails with `fetch failed` (INTERNAL_SERVER_ERROR). The tRPC router constructs an incorrect URL path when calling the connections Hono service, causing the server-side fetch to 404 (or ECONNREFUSED if the path doesn't match any listener).

## Current State Analysis

### Bug: URL path mismatch in tRPC router

The tRPC router constructs the wrong URL path. It calls `/connections/:provider/authorize` but the Hono app mounts routes at `/services/connections`.

**File**: `api/console/src/router/org/connections.ts:67`
```ts
// Current (wrong): http://localhost:4110/connections/github/authorize
`${connectionsUrl}/connections/${input.provider}/authorize`
```

**File**: `apps/connections/src/app.ts:10`
```ts
// Routes are mounted at /services/connections
app.route("/services/connections", connections);
```

The connections service IS started by turbo's `with` config in `apps/console/turbo.json:73`:
```json
"with": ["@lightfast/connections#dev"]
```

### Dead code: unused connectionsUrl export

**File**: `apps/console/src/lib/related-projects.ts:33-38`

```ts
export const connectionsUrl = `${withRelatedProject({...})}/api`;
```

This export is **never imported** anywhere in the codebase. The tRPC router defines its own local `connectionsUrl` at `api/console/src/router/org/connections.ts:22-27`. The Next.js rewrite at `next.config.ts:169` handles browser-facing traffic to `/services/connections/*`.

## Desired End State

1. The "Connect GitHub" button successfully initiates the OAuth popup flow
2. Dead `connectionsUrl` removed from `related-projects.ts`
3. tRPC router uses correct URL path to reach the connections Hono service

### Verification:
- Click "Connect GitHub" on `/new` page → GitHub OAuth popup opens (no console errors)
- `pnpm typecheck` and `pnpm lint` pass

## What We're NOT Doing

- Reworking the `github-connector.tsx` component logic (effects, state management)
- Changing the connections service Hono routes
- Modifying the production URL resolution (`withRelatedProject` for tRPC router is still needed for Vercel deployments)
- Changing the OAuth callback flow

## Implementation Approach

Two small, independent fixes. All are one-line or few-line changes.

## Phase 1: Fix URL path in tRPC router

### Overview
Fix the server-side fetch URL to include the `/services/connections` prefix that the Hono app expects.

### Changes Required:

#### 1. Fix `getAuthorizeUrl` and `cliAuthorize` fetch URLs
**File**: `api/console/src/router/org/connections.ts`

Line 67 — change:
```ts
`${connectionsUrl}/connections/${input.provider}/authorize`,
```
to:
```ts
`${connectionsUrl}/services/connections/${input.provider}/authorize`,
```

Line 112 — change:
```ts
`${connectionsUrl}/connections/${input.provider}/authorize?redirect_to=inline`,
```
to:
```ts
`${connectionsUrl}/services/connections/${input.provider}/authorize?redirect_to=inline`,
```

### Success Criteria:

#### Automated Verification:
- [x] Type checking passes: `pnpm typecheck`
- [x] Linting passes: `pnpm lint`

#### Manual Verification:
- [ ] With connections service running on port 4110, the tRPC `getAuthorizeUrl` call returns `{ url, state }` instead of failing

---

## Phase 2: Remove dead connectionsUrl export

### Overview
Clean up the unused `connectionsUrl` from `related-projects.ts`. The Next.js rewrite handles browser-facing connections traffic; the tRPC router has its own URL resolution.

### Changes Required:

#### 1. Remove connectionsUrl export
**File**: `apps/console/src/lib/related-projects.ts`

Remove lines 31-38:
```ts
// Get the connections service URL dynamically based on environment
// Connections is a standalone Hono service (not part of microfrontends)
export const connectionsUrl = `${withRelatedProject({
  projectName: 'lightfast-connections',
  defaultHost: isDevelopment
    ? 'http://localhost:4110'
    : 'https://connections.lightfast.ai',
})}/api`;
```

### Success Criteria:

#### Automated Verification:
- [x] Type checking passes: `pnpm typecheck`
- [x] Linting passes: `pnpm lint`
- [ ] No import errors (grep confirms no imports of `connectionsUrl` from this file)

---

## Testing Strategy

### Manual Testing Steps:
1. Start dev servers: `pnpm dev:app`
2. Verify connections service: `curl http://localhost:4110/`
3. Navigate to `/new` page in browser
4. Click "Connect GitHub" button
5. Verify GitHub OAuth popup opens without console errors
6. Complete OAuth flow and verify connection is established

## References

- tRPC router: `api/console/src/router/org/connections.ts`
- Connections Hono app: `apps/connections/src/app.ts`
- Connections routes: `apps/connections/src/routes/connections.ts`
- Console turbo config (with): `apps/console/turbo.json:73`
- Next.js rewrite: `apps/console/next.config.ts:169`
- GitHub connector component: `apps/console/src/app/(app)/(user)/new/_components/github-connector.tsx`
