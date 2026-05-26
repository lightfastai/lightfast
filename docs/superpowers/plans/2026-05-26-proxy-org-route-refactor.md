# Proxy Org Route Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Use test-driven-development for source edits and vercel:nextjs when moving App Router route groups. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove proxy-local reserved organization route segments, restore simple Clerk organization route patterns, rename the native client public auth surface to `/oauth`, and keep unbound organization routing correct.

**Architecture:** `apps/app/src/proxy.ts` should keep Nemo as the microfrontend-before-Clerk composition layer and keep route ownership as an ordered `createRouteMatcher` gate chain. App-owned API, auth, public, root, pending-session, and signed-in user routes should be handled before the org binding-status gate. The final org gate should use the broad `/:slug` product matcher plus active `orgSlug` path proof, without a proxy-local reserved-name list. App-owned route name reservation belongs to `@repo/app-reserved-names` and `@repo/app-validation`, not proxy control flow. The OAuth browser page and API handlers live together under an `(app)/(oauth)` App Router feature boundary while preserving focused handoff UI.

**Tech Stack:** Next.js App Router, Clerk middleware, Nemo, Vercel Microfrontends middleware, Vitest, pnpm, TypeScript, Electron, Lightfast CLI.

---

## References

- Design spec: `docs/superpowers/specs/2026-05-26-proxy-org-route-refactor-design.md`
- Native org-bound auth plan: `docs/superpowers/plans/2026-05-22-native-org-bound-auth.md`
- Proxy entrypoint: `apps/app/src/proxy.ts`
- Existing proxy tests: `apps/app/src/__tests__/proxy.test.ts`

## File Structure

Create:

- `apps/app/src/app/(app)/(oauth)/layout.tsx`
- `apps/app/src/app/(app)/(oauth)/oauth/[client]/start/page.tsx`
- `apps/app/src/app/(app)/(oauth)/oauth/[client]/start/actions.ts`
- `apps/app/src/app/(app)/(oauth)/oauth/[client]/start/validators.ts`
- `apps/app/src/app/(app)/(oauth)/oauth/[client]/start/_components/native-auth-org-select.tsx`
- `apps/app/src/app/(app)/(oauth)/api/oauth/[client]/config/route.ts`
- `apps/app/src/app/(app)/(oauth)/api/oauth/finalize/route.ts`
- `apps/app/src/app/(app)/(oauth)/api/oauth/_server/native-auth-caller.ts`
- `apps/app/src/app/(app)/(oauth)/api/oauth/_server/response.ts`
- `apps/app/src/__tests__/app/(app)/(oauth)/oauth/start-page.test.tsx`
- `apps/app/src/__tests__/app/api/oauth/oauth-routes.test.ts`
- `packages/app-reserved-names/vitest.config.ts`
- `packages/app-reserved-names/src/__tests__/organization.test.ts`
- `packages/app-validation/vitest.config.ts`
- `packages/app-validation/src/__tests__/clerk-org-slug.test.ts`

Modify:

- `apps/app/src/proxy.ts`
- `apps/app/src/__tests__/proxy.test.ts`
- `apps/app/package.json` only if test paths or aliases require it
- `core/cli/src/auth/oauth.ts`
- `core/cli/src/auth/app-client.ts`
- `core/cli/src/auth/__tests__/oauth.test.ts`
- `core/cli/src/auth/__tests__/app-client.test.ts`
- `core/cli/src/auth/__tests__/login-flow.test.ts`
- `apps/desktop/src/main/native-auth/flow.ts`
- `apps/desktop/src/main/native-auth/app-client.ts`
- `apps/desktop/src/main/native-auth/__tests__/flow.test.ts`
- `apps/desktop/README.md`
- `packages/app-reserved-names/package.json`
- `packages/app-reserved-names/data/organization-names.json` only if required names are missing
- `packages/app-validation/package.json`

Delete after replacement paths are green:

- `apps/app/src/app/(client-handshake)/layout.tsx`
- `apps/app/src/app/(client-handshake)/native-auth/[client]/start/page.tsx`
- `apps/app/src/app/(client-handshake)/native-auth/[client]/start/actions.ts`
- `apps/app/src/app/(client-handshake)/native-auth/[client]/start/validators.ts`
- `apps/app/src/app/(client-handshake)/native-auth/[client]/start/_components/native-auth-org-select.tsx`
- `apps/app/src/app/api/native-auth/[client]/oauth-config/route.ts`
- `apps/app/src/app/api/native-auth/finalize/route.ts`
- `apps/app/src/app/api/native-auth/_server/native-auth-caller.ts`
- `apps/app/src/app/api/native-auth/_server/response.ts`
- old native-auth route tests once equivalent OAuth tests exist

---

### Task 1: Add Red Proxy Tests for Positive Org Proof

**Files:**
- Modify: `apps/app/src/__tests__/proxy.test.ts`

- [ ] Capture the second argument passed to the mocked `clerkMiddleware()` so tests can assert `organizationSyncOptions.organizationPatterns`.
- [ ] Change pending-session allowlist expectations from `/native-auth/desktop/start` to `/oauth/desktop/start`.
- [ ] Change native auth facade expectations from `/api/native-auth/finalize` to `/api/oauth/finalize`.
- [ ] Add an unbound active org test proving `/account/settings` does not redirect to `/account/tasks/bind`.
- [ ] Add an unbound active org test proving `/oauth/desktop/start` does not redirect to `/oauth/tasks/bind`.
- [ ] Add unbound active org tests proving `/docs` and `/docs/get-started` do not redirect.
- [ ] Add an unbound active org mismatch test proving `/different-team/workspace` does not redirect when Clerk's active `orgSlug` is `acme`.
- [ ] Assert Clerk organization patterns are exactly `["/:slug", "/:slug/(.*)"]`.
- [ ] Run `pnpm --filter @lightfast/app test -- src/__tests__/proxy.test.ts` and confirm the new expectations fail against the current proxy.

### Task 2: Add Red Tests for the `/oauth` Route Surface

**Files:**
- Modify or replace: `apps/app/src/__tests__/app/(client-handshake)/native-auth/start-page.test.tsx`
- Modify or replace: `apps/app/src/__tests__/app/api/native-auth/native-auth-routes.test.ts`
- Modify: `core/cli/src/auth/__tests__/oauth.test.ts`
- Modify: `core/cli/src/auth/__tests__/app-client.test.ts`
- Modify: `core/cli/src/auth/__tests__/login-flow.test.ts`
- Modify: `apps/desktop/src/main/native-auth/__tests__/flow.test.ts`

- [ ] Move the start-page test to the new `(app)/(oauth)` test path and update dynamic imports to `~/app/(app)/(oauth)/oauth/[client]/start/page` and `actions`.
- [ ] Move the route-handler test to `app/api/oauth` test naming and update imports to the new route handler paths.
- [ ] Expect OAuth config at `/api/oauth/:client/config`, not `/api/native-auth/:client/oauth-config`.
- [ ] Expect finalization at `/api/oauth/finalize`, not `/api/native-auth/finalize`.
- [ ] Expect browser start URLs at `/oauth/cli/start` and `/oauth/desktop/start`.
- [ ] Keep internal names such as `NativeAuthOrgSelect`, `native-auth-caller`, and `@repo/native-auth-contract` unless changing them removes real implementation friction.
- [ ] Run the focused app, CLI, and desktop tests and confirm they fail for path-shape reasons only.

### Task 3: Move the OAuth Feature Boundary Under `(app)`

**Files:**
- Create: `apps/app/src/app/(app)/(oauth)/layout.tsx`
- Move: `apps/app/src/app/(client-handshake)/native-auth/[client]/start/*`
- Move: `apps/app/src/app/api/native-auth/*`

- [ ] Create `(app)/(oauth)/layout.tsx` as a focused handoff shell that inherits `(app)` providers but not `(pending-allowed)`'s `UserLayoutShell`.
- [ ] Move the browser page from `/native-auth/[client]/start` to `/oauth/[client]/start`.
- [ ] Move the OAuth config route from `/api/native-auth/[client]/oauth-config` to `/api/oauth/[client]/config`.
- [ ] Move the finalize route from `/api/native-auth/finalize` to `/api/oauth/finalize`.
- [ ] Move `_server` helpers under `apps/app/src/app/(app)/(oauth)/api/oauth/_server`.
- [ ] Update server imports in the page, action, and route-handler files to reference the new colocated API helper path.
- [ ] Delete the old `(client-handshake)` route group after no files remain in it.
- [ ] Run the focused app route tests until the new files pass.

### Task 4: Update CLI and Desktop Clients

**Files:**
- Modify: `core/cli/src/auth/oauth.ts`
- Modify: `core/cli/src/auth/app-client.ts`
- Modify: `core/cli/src/auth/__tests__/oauth.test.ts`
- Modify: `core/cli/src/auth/__tests__/app-client.test.ts`
- Modify: `core/cli/src/auth/__tests__/login-flow.test.ts`
- Modify: `apps/desktop/src/main/native-auth/flow.ts`
- Modify: `apps/desktop/src/main/native-auth/app-client.ts`
- Modify: `apps/desktop/src/main/native-auth/__tests__/flow.test.ts`
- Modify: `apps/desktop/README.md`

- [ ] Build CLI start URLs with `/oauth/cli/start`.
- [ ] Fetch CLI OAuth config from `/api/oauth/cli/config`.
- [ ] Finalize CLI native OAuth through `/api/oauth/finalize`.
- [ ] Build desktop start URLs with `/oauth/desktop/start`.
- [ ] Fetch desktop OAuth config from `/api/oauth/desktop/config`.
- [ ] Finalize desktop native OAuth through `/api/oauth/finalize`.
- [ ] Update README references that describe the desktop browser flow.
- [ ] Run the focused CLI and desktop native-auth tests until green.

### Task 5: Refactor Proxy Org Detection

**Files:**
- Modify: `apps/app/src/proxy.ts`
- Modify: `apps/app/src/__tests__/proxy.test.ts`

- [ ] Replace public route matcher `/api/native-auth/(.*)` with `/api/oauth/(.*)`.
- [ ] Replace pending-session route matcher `/native-auth(.*)` with `/oauth(.*)`.
- [ ] Remove `RESERVED_ORG_ROUTE_SEGMENTS`, `RESERVED_ORG_ROUTE_SEGMENT_SET`, `RESERVED_ORG_ROUTE_PATTERN`, and `ORGANIZATION_SLUG_PATTERN`.
- [ ] Keep route ownership as an ordered `createRouteMatcher` gate chain; do not introduce a `RouteKind` or `classifyRoute()` abstraction.
- [ ] Add or reuse an app-owned signed-in browser route matcher for `/account/*` and `/oauth/*`.
- [ ] Ensure app-owned signed-in browser routes are handled before last-active-org persistence and binding-status redirects.
- [ ] Add a small active-org path check that returns true only for `/${orgSlug}` and `/${orgSlug}/*`.
- [ ] Keep last-active-org persistence behind the org-product matcher plus active-org path proof.
- [ ] Keep binding redirects behind the org-product matcher, active-org path proof, and existing settings/bind route exclusions.
- [ ] Redirect unbound active org product routes to `/${orgSlug}/tasks/bind`.
- [ ] Restore Clerk organization patterns to `["/:slug", "/:slug/(.*)"]`.
- [ ] Keep Nemo's structure: microfrontends middleware in `before`, Clerk proxy as the catch-all route, app-owned API bypass before Nemo.
- [ ] Run `pnpm --filter @lightfast/app test -- src/__tests__/proxy.test.ts` until green.

### Task 6: Pin Reserved Names in Validation Tests

**Files:**
- Create: `packages/app-reserved-names/vitest.config.ts`
- Create: `packages/app-reserved-names/src/__tests__/organization.test.ts`
- Modify: `packages/app-reserved-names/package.json`
- Modify: `packages/app-reserved-names/data/organization-names.json` only if needed
- Create: `packages/app-validation/vitest.config.ts`
- Create: `packages/app-validation/src/__tests__/clerk-org-slug.test.ts`
- Modify: `packages/app-validation/package.json`

- [ ] Add `test: "vitest run"` scripts and Vitest dev dependencies matching nearby packages.
- [ ] Test that `organization.check("oauth")` and `organization.check("ingest")` return true.
- [ ] Do not add `cli` or `desktop` to the reserved-name set solely for this migration; they are second-level OAuth client ids, not top-level app routes.
- [ ] Test that `clerkOrgSlugSchema` rejects `oauth` and `ingest`.
- [ ] If `oauth` or `ingest` is missing from `organization-names.json`, add it in sorted order.
- [ ] Run `pnpm --filter @repo/app-reserved-names test` and `pnpm --filter @repo/app-validation test` until green.

### Task 7: Cleanup and Search-Based Guardrails

**Files:**
- Modify as discovered by search.

- [ ] Run `rg -n "native-auth|api/native-auth|/native-auth|oauth-config|RESERVED_ORG_ROUTE|ORGANIZATION_SLUG_PATTERN" apps/app core/cli apps/desktop packages api`.
- [ ] Remove public URL references to `/native-auth` and `/api/native-auth`.
- [ ] Leave internal package/module names containing `native-auth` when they describe native client auth internals.
- [ ] Remove obsolete tests that only cover the deleted route tree after equivalent `/oauth` tests are in place.
- [ ] Confirm no proxy-local reserved org route segment list remains.

## Verification

Run focused checks first:

```bash
pnpm --filter @lightfast/app test -- src/__tests__/proxy.test.ts
pnpm --filter @lightfast/app test -- 'src/__tests__/app/(app)/(oauth)/oauth/start-page.test.tsx' 'src/__tests__/app/api/oauth/oauth-routes.test.ts'
pnpm --filter @lightfastai/cli test -- src/auth/__tests__/oauth.test.ts src/auth/__tests__/app-client.test.ts src/auth/__tests__/login-flow.test.ts
pnpm --filter @lightfast/desktop test -- src/main/native-auth/__tests__/flow.test.ts
pnpm --filter @repo/app-reserved-names test
pnpm --filter @repo/app-validation test
```

Then run typechecks:

```bash
pnpm --filter @lightfast/app typecheck
pnpm --filter @lightfastai/cli typecheck
pnpm --filter @lightfast/desktop typecheck
pnpm --filter @repo/app-reserved-names typecheck
pnpm --filter @repo/app-validation typecheck
```

Optional full confidence gate if the workspace is clean enough:

```bash
pnpm check
```

## Success Criteria

- `apps/app/src/proxy.ts` has no reserved organization route segment list.
- Clerk organization patterns are readable: `/:slug` and `/:slug/(.*)`.
- Binding redirects only run after app-owned route gates and active `orgSlug` path proof.
- App-owned routes such as `/account/settings`, `/docs/get-started`, and `/oauth/desktop/start` do not trigger org binding redirects.
- Native client public URLs are `/oauth/*` and `/api/oauth/*`.
- OAuth browser routes and route handlers are colocated under `apps/app/src/app/(app)/(oauth)`.
- Organization slug validation rejects app-owned top-level route names such as `oauth` and `ingest`.
