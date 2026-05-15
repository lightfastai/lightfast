# Pending-Allowed / Pending-Not-Allowed Scope Restructure Implementation Plan

## Overview

Rename the tRPC procedure boundaries and matching route groupings from `user-scoped` / `org-scoped` (which describe the *target* of the operation) to `pending-allowed` / `pending-not-allowed` (which describe the *auth gate* — whether a `clerk-pending` session is admitted). This is a coordinated rename across the API package (`api/app`), the Next.js app routes (`apps/app/src/app/(app)/...`), and every caller of the affected tRPC paths.

## Current State Analysis

**API package** (`api/app/src/`):
- `trpc.ts:167,187` defines two gated procedures:
  - `userScopedProcedure` — accepts `clerk-pending | clerk-active`
  - `orgScopedProcedure` — accepts `clerk-active` only (`requireOrg` middleware)
- `root.ts:14-20` exposes three routers flat:
  - `organization` (uses `userScopedProcedure`) — `router/user/organization.ts`
  - `account` (uses `userScopedProcedure`) — `router/user/account.ts`
  - `orgApiKeys` (uses `orgScopedProcedure`) — `router/org/org-api-keys.ts`

**App routes** (`apps/app/src/app/(app)/`):
- `(user)/layout.tsx` — wraps with `UserPageHeader`; prefetches `account.get`
- `(user)/(pending-allowed)/account/{settings,teams,welcome}/...` — onboarding pages (the inner `(pending-allowed)` route group exists today, redundantly)
- `(org)/[slug]/layout.tsx` — gates on `requireOrgAccess(slug)`, renders `AppSidebar` + `AppHeader`
- `(org)/[slug]/(workspace)/(manage)/settings/...` — org-active flows including `api-keys`
- `(org)/not-found.tsx` + `(org)/sign-out-button.tsx` — shared org not-found UI

**Callers of the routers** (16 files outside the router/trpc files themselves):
- `apps/app/src/app/(app)/layout.tsx:8,10` — prefetches `organization.listUserOrganizations` and `account.get`
- `apps/app/src/app/(app)/(user)/layout.tsx:10` — prefetches `account.get`
- `apps/app/src/app/(app)/(user)/(pending-allowed)/account/settings/general/page.tsx:29` — `account.get`
- `apps/app/src/app/(app)/(user)/(pending-allowed)/account/settings/general/_components/profile-data-display.tsx:29` — `account.get`
- `apps/app/src/app/(app)/(user)/(pending-allowed)/account/teams/new/_components/team-name-form.tsx:29,37` — `organization.create`, `organization.listUserOrganizations`
- `apps/app/src/app/(app)/(org)/[slug]/(workspace)/(manage)/settings/_components/team-general-settings-client.tsx:50,54` — `organization.listUserOrganizations`, `organization.updateName`
- `apps/app/src/app/(app)/(org)/[slug]/(workspace)/(manage)/settings/api-keys/page.tsx:10` — `orgApiKeys.list`
- `apps/app/src/app/(app)/(org)/[slug]/(workspace)/(manage)/settings/api-keys/_components/org-api-key-list.tsx:54,57,82,93,101` — `orgApiKeys.list/create/revoke/delete`
- `apps/app/src/components/user-page-header.tsx:15,20` — `account.get`, `organization.listUserOrganizations`
- `apps/app/src/components/app-header.tsx:16` — `account.get`
- `apps/app/src/components/app-sidebar.tsx:80` — `organization.listUserOrganizations`
- `apps/desktop/src/renderer/src/react/user-menu.tsx:8` — `account.get`
- `apps/desktop/src/renderer/src/react/account-card.tsx:6` — `account.get`
- `apps/desktop/src/renderer/src/react/settings/panes/account.tsx:7` — `account.get`
- `apps/app/src/proxy.ts:67` — comment-only reference to `userScopedProcedure`

## Desired End State

- `api/app/src/trpc.ts` exports `pendingAllowedProcedure` and `pendingNotAllowedProcedure` (old names removed; no aliases).
- `api/app/src/router/(pending-allowed)/{account.ts,organization.ts}` and `api/app/src/router/(pending-not-allowed)/org-api-keys.ts` exist; the old `router/user/` and `router/org/` directories are gone.
- `api/app/src/root.ts` exposes `pendingAllowed` and `pendingNotAllowed` as nested sub-routers:
  ```ts
  createTRPCRouter({
    pendingAllowed: createTRPCRouter({
      organization: organizationRouter,
      account: accountRouter,
    }),
    pendingNotAllowed: createTRPCRouter({
      orgApiKeys: orgApiKeysRouter,
    }),
  });
  ```
- `apps/app/src/app/(app)/(pending-allowed)/{layout.tsx, account/...}` exists (former `(user)/` content, with the inner `(pending-allowed)` collapsed). `(user)/` is gone.
- `apps/app/src/app/(app)/(pending-not-allowed)/{[slug]/...,not-found.tsx,sign-out-button.tsx}` exists. `(org)/` is gone.
- Every caller listed above invokes the new nested paths (`trpc.pendingAllowed.organization.*`, `trpc.pendingAllowed.account.*`, `trpc.pendingNotAllowed.orgApiKeys.*`).
- `pnpm --filter @api/app build`, `pnpm typecheck`, `pnpm check` pass clean.
- All existing onboarding and org-active flows render identically to today: `/account/teams/new`, `/account/settings/general`, `/account/welcome`, `/<slug>/settings`, `/<slug>/settings/api-keys`.

### Key Discoveries:

- `userScopedProcedure` (`api/app/src/trpc.ts:167`) is just `authedProcedure` — its only gate is "not unauthenticated", which functionally permits both `clerk-pending` and `clerk-active`. That is exactly the `pendingAllowed` semantic.
- `orgScopedProcedure` (`api/app/src/trpc.ts:187`) composes `authedProcedure.use(requireOrg)` — the `requireOrg` middleware excludes `clerk-pending`. That is exactly the `pendingNotAllowed` semantic.
- The inner `(user)/(pending-allowed)/` route group at `apps/app/src/app/(app)/(user)/(pending-allowed)/` exists *today* but does not contribute its own `layout.tsx`. Collapsing it during the outer rename is a pure no-op for URL paths and layout boundaries.
- `(app)/layout.tsx` and `(app)/(user)/layout.tsx` both `prefetch(trpc.account.get.queryOptions())` (lines 10 and 10 respectively) — duplicate but pre-existing; this plan does not change that behavior, only the path.
- Route group parentheses in directory names work in plain TS packages (not just Next.js), so the `api/app/src/router/(pending-allowed)/` form is fine for relative imports like `from "../../trpc"`.

## What We're NOT Doing

- Not changing any procedure logic, input schemas, output shapes, or auth resolution.
- Not changing URL paths visible to users — route group renames are URL-invisible.
- Not consolidating the duplicate `account.get` prefetch between `(app)/layout.tsx` and the new `(pending-allowed)/layout.tsx`.
- Not adjusting `user-page-header.tsx` beyond the tRPC path update (confirmed with user — path update only).
- Not introducing aliases or backwards-compat re-exports for the old procedure/router names.
- Not touching `userScopedProcedure` callers outside `api/app/src/router/` or `apps/app/src/proxy.ts:67` — there are none (verified via grep).
- Not modifying tests in `apps/app/src/app/(auth)/` — they do not reference any of the affected tRPC paths.

## Implementation Approach

Two phases, coupled but separable. Phase 1 is the API surface — atomic because TypeScript would fail to compile any in-between state where some callers use the old path and some use the new. Phase 2 is the Next.js route folder rename — independent because route group names don't affect imports or URLs; it can land in the same PR or a follow-up at the user's discretion.

## Execution Protocol

Phase boundaries halt execution. Automated checks passing is necessary but not sufficient — the next phase starts only on user go-ahead.

## Phase 1: API restructure (procedures, folders, root.ts, all callers)

### Overview

Rename the two procedure exports, move the router files into route-group-style folders, rewrite `root.ts` to nest under `pendingAllowed` / `pendingNotAllowed`, and update every caller. Done atomically because TypeScript would block any partial state.

### Changes Required:

#### 1. Rename procedure exports

**File**: `api/app/src/trpc.ts`
**Changes**: Rename `userScopedProcedure` → `pendingAllowedProcedure` (line 167) and `orgScopedProcedure` → `pendingNotAllowedProcedure` (line 187). Update the JSDoc above each to describe the gate (which Clerk session types are admitted) rather than the operation target. Keep the underlying middleware composition (`authedProcedure`, `authedProcedure.use(requireOrg)`) unchanged.

#### 2. Move router files into route-group folders

**Files**:
- `api/app/src/router/user/account.ts` → `api/app/src/router/(pending-allowed)/account.ts`
- `api/app/src/router/user/organization.ts` → `api/app/src/router/(pending-allowed)/organization.ts`
- `api/app/src/router/org/org-api-keys.ts` → `api/app/src/router/(pending-not-allowed)/org-api-keys.ts`

**Changes**: Inside each moved file, update the procedure import:
- `import { userScopedProcedure } from "../../trpc";` → `import { pendingAllowedProcedure } from "../../trpc";`
- `import { orgScopedProcedure } from "../../trpc";` → `import { pendingNotAllowedProcedure } from "../../trpc";`

And replace every reference to the old name in the procedure chain (e.g. `userScopedProcedure.query(...)` → `pendingAllowedProcedure.query(...)`). Delete the now-empty `router/user/` and `router/org/` directories.

#### 3. Restructure `root.ts` to nested router shape

**File**: `api/app/src/root.ts`
**Changes**: Replace the flat-router body with nested groupings.

```ts
import { orgApiKeysRouter } from "./router/(pending-not-allowed)/org-api-keys";
import { accountRouter } from "./router/(pending-allowed)/account";
import { organizationRouter } from "./router/(pending-allowed)/organization";
import { createTRPCRouter } from "./trpc";

export const appRouter = createTRPCRouter({
  pendingAllowed: createTRPCRouter({
    organization: organizationRouter,
    account: accountRouter,
  }),
  pendingNotAllowed: createTRPCRouter({
    orgApiKeys: orgApiKeysRouter,
  }),
});

export type AppRouter = typeof appRouter;
```

Also refresh the JSDoc header to describe the new gate-based grouping.

#### 4. Update caller paths — `apps/app`

**Files & changes** (all are simple search-and-replace within each file; line numbers are pre-edit):

- `apps/app/src/app/(app)/layout.tsx:8,10`
  - `trpc.organization.listUserOrganizations` → `trpc.pendingAllowed.organization.listUserOrganizations`
  - `trpc.account.get` → `trpc.pendingAllowed.account.get`
- `apps/app/src/app/(app)/(user)/layout.tsx:10` *(this file moves in Phase 2 but the path update happens here)*
  - `trpc.account.get` → `trpc.pendingAllowed.account.get`
- `apps/app/src/app/(app)/(user)/(pending-allowed)/account/settings/general/page.tsx:29` — `trpc.account.get` → `trpc.pendingAllowed.account.get`
- `apps/app/src/app/(app)/(user)/(pending-allowed)/account/settings/general/_components/profile-data-display.tsx:29` — `trpc.account.get` → `trpc.pendingAllowed.account.get`
- `apps/app/src/app/(app)/(user)/(pending-allowed)/account/teams/new/_components/team-name-form.tsx:29,37`
  - `trpc.organization.create` → `trpc.pendingAllowed.organization.create`
  - `trpc.organization.listUserOrganizations.queryOptions().queryKey` → `trpc.pendingAllowed.organization.listUserOrganizations.queryOptions().queryKey`
- `apps/app/src/app/(app)/(org)/[slug]/(workspace)/(manage)/settings/_components/team-general-settings-client.tsx:50,54`
  - `trpc.organization.listUserOrganizations` → `trpc.pendingAllowed.organization.listUserOrganizations`
  - `trpc.organization.updateName` → `trpc.pendingAllowed.organization.updateName`
- `apps/app/src/app/(app)/(org)/[slug]/(workspace)/(manage)/settings/api-keys/page.tsx:10` — `trpc.orgApiKeys.list` → `trpc.pendingNotAllowed.orgApiKeys.list`
- `apps/app/src/app/(app)/(org)/[slug]/(workspace)/(manage)/settings/api-keys/_components/org-api-key-list.tsx:54,57,82,93,101` — replace all five `trpc.orgApiKeys.*` with `trpc.pendingNotAllowed.orgApiKeys.*`
- `apps/app/src/components/user-page-header.tsx:15,20`
  - `trpc.account.get` → `trpc.pendingAllowed.account.get`
  - `trpc.organization.listUserOrganizations` → `trpc.pendingAllowed.organization.listUserOrganizations`
- `apps/app/src/components/app-header.tsx:16` — `trpc.account.get` → `trpc.pendingAllowed.account.get`
- `apps/app/src/components/app-sidebar.tsx:80` — `trpc.organization.listUserOrganizations` → `trpc.pendingAllowed.organization.listUserOrganizations`
- `apps/app/src/proxy.ts:67` (comment only) — `userScopedProcedure` → `pendingAllowedProcedure`

#### 5. Update caller paths — `apps/desktop`

**Files**:
- `apps/desktop/src/renderer/src/react/user-menu.tsx:8`
- `apps/desktop/src/renderer/src/react/account-card.tsx:6`
- `apps/desktop/src/renderer/src/react/settings/panes/account.tsx:7`

**Changes**: Each invokes `trpc.account.get.queryOptions()` — update to `trpc.pendingAllowed.account.get.queryOptions()`.

### Success Criteria:

#### Automated Verification:

- [x] `grep -rn "userScopedProcedure\|orgScopedProcedure" api/app/src` returns no results
- [x] `grep -rn "router/user\|router/org" api/app/src` returns no results
- [x] `grep -rn "trpc\.\(organization\|account\|orgApiKeys\)\." apps/app/src apps/desktop/src packages` returns no results (only nested paths remain)
- [x] `ls api/app/src/router/` shows only `(pending-allowed)` and `(pending-not-allowed)` directories
- [x] `pnpm --filter @api/app build` succeeds *(no `build` script in `@api/app`; typecheck is the build — `pnpm --filter @api/app typecheck` passes clean)*
- [x] `pnpm typecheck` succeeds (all packages) *(37/37 packages green)*
- [x] `pnpm check` succeeds *(13 pre-existing failures in `apps/app/src/app/(auth)/sso-callback/page{,.test}.tsx` — untracked files on this branch, unrelated to Phase 1; zero new failures introduced)*

#### Human Review:

- [x] Open `/account/welcome` while signed in as a pending (no-org) Clerk user → page renders without tRPC errors in console
- [x] Open `/account/teams/new` → submit a new team name → succeeds, redirects, team appears in the org switcher
- [x] Open `/account/settings/general` → profile data renders (validates `pendingAllowed.account.get` query)
- [x] Open `/<existing-slug>/settings` → org name renders in the form (validates `pendingAllowed.organization.listUserOrganizations` from an org page)
- [x] Open `/<existing-slug>/settings/api-keys` → list renders; create + revoke + delete each succeed (validates `pendingNotAllowed.orgApiKeys.*`)
- [x] Desktop app (if running locally): user menu and account pane show profile data (validates desktop callers)

#### Out-of-Plan Adjustment

`apps/app/src/proxy.ts:69` had an actual route-matcher pattern `"/api/trpc/organization.create(.*)"` (not just the comment-only reference at line 67 that the plan called out). Since the tRPC URL path now reflects the nested router structure, that string was updated to `"/api/trpc/pendingAllowed.organization.create(.*)"` for consistency. Note: this matcher is dead code today — `isApiRoute` catches `/api/trpc/(.*)` first at proxy.ts:54 and exits before the pending-redirect logic. Update is for maintenance accuracy, no behavior change.

---

## Phase 2: App route folder restructure

### Overview

Rename the two top-level route groups inside `apps/app/src/app/(app)/` and collapse the redundant inner `(pending-allowed)/` directory. Route group names don't affect URLs, so no user-visible change — but the folder layout now matches the API scope vocabulary.

### Changes Required:

#### 1. Rename `(user)/` → `(pending-allowed)/` and flatten the inner group

**Before**:
```
(app)/(user)/layout.tsx
(app)/(user)/(pending-allowed)/account/settings/...
(app)/(user)/(pending-allowed)/account/teams/...
(app)/(user)/(pending-allowed)/account/welcome/...
```

**After**:
```
(app)/(pending-allowed)/layout.tsx       (moved from (user)/layout.tsx, content unchanged after Phase 1)
(app)/(pending-allowed)/account/settings/...
(app)/(pending-allowed)/account/teams/...
(app)/(pending-allowed)/account/welcome/...
```

**How**: `git mv "(app)/(user)" "(app)/(pending-allowed)-tmp"` then `git mv "(app)/(pending-allowed)-tmp/(pending-allowed)/account" "(app)/(pending-allowed)-tmp/account"` then `rmdir "(app)/(pending-allowed)-tmp/(pending-allowed)"` then `git mv "(app)/(pending-allowed)-tmp" "(app)/(pending-allowed)"`. (The two-step rename via a `-tmp` suffix avoids any case where a target path momentarily equals an ancestor of the source.)

#### 2. Rename `(org)/` → `(pending-not-allowed)/`

**Before**:
```
(app)/(org)/not-found.tsx
(app)/(org)/sign-out-button.tsx
(app)/(org)/[slug]/layout.tsx
(app)/(org)/[slug]/(workspace)/...
```

**After**:
```
(app)/(pending-not-allowed)/not-found.tsx
(app)/(pending-not-allowed)/sign-out-button.tsx
(app)/(pending-not-allowed)/[slug]/layout.tsx
(app)/(pending-not-allowed)/[slug]/(workspace)/...
```

**How**: `git mv "(app)/(org)" "(app)/(pending-not-allowed)"`.

#### 3. Verify no internal imports break

Files under the moved directories use relative imports only for siblings (e.g. `sign-out-button` is imported from `not-found.tsx` as `"./sign-out-button"` at `(org)/not-found.tsx:2`). Those continue to resolve after the rename. Any `~/...` alias imports (e.g. `~/components/...`, `~/lib/...`) are unaffected because the alias root doesn't change. No code edits expected in this phase — but run typecheck to confirm.

### Success Criteria:

#### Automated Verification:

- [x] `ls apps/app/src/app/\(app\)/` shows only `(pending-allowed)`, `(pending-not-allowed)`, `layout.tsx`
- [x] `find apps/app/src/app/\(app\)/\(pending-allowed\) -maxdepth 1` shows `layout.tsx` and `account/` directly (no inner `(pending-allowed)/`)
- [x] `grep -rn "(app)/(user)\|(app)/(org)" apps/app/src` returns no results (no stale relative-path references)
- [x] `pnpm --filter @api/app build` still succeeds *(no `build` script; typecheck is the build — passes)*
- [x] `pnpm typecheck` succeeds *(37/37 packages green)*
- [x] `pnpm check` succeeds *(3 pre-existing errors in `.agents/skills/lightfast-{clerk,desktop-signin}/lib/*.mjs`; zero new failures from Phase 2. Note: the 13 sso-callback errors flagged in Phase 1's note were resolved between phases — formatter run or stale Biome cache.)*
- [x] `pnpm --filter @apps/app build` succeeds (catches Next.js route resolution issues) *(filter name is `@lightfast/app`. Compile, typecheck, and page-data collection all pass — proving the renamed routes resolve cleanly. Static prerender then fails on the unrelated `/sign-up/accept-invitation` page (this branch's separate sign-up rework — missing `Suspense` around `useSearchParams()`). Outside Phase 2 scope; plan explicitly excludes `(auth)` files.)*

#### Human Review:

- [ ] Same flows as Phase 1 → each URL still resolves and renders (route group rename is URL-invisible, but worth confirming Next.js routing didn't get confused mid-rename):
  - [ ] `/account/welcome`
  - [ ] `/account/teams/new`
  - [ ] `/account/settings/general`
  - [ ] `/<existing-slug>/settings`
  - [ ] `/<existing-slug>/settings/api-keys`
- [ ] Trigger the `(pending-not-allowed)/not-found.tsx` path: navigate to `/some-bogus-slug` while signed in → the org 404 UI with the sign-out button renders

---

## Testing Strategy

### Unit Tests:

No unit tests touch the renamed paths directly. The auth-flow tests in `apps/app/src/app/(auth)/` were verified to have no `trpc.organization|account|orgApiKeys` references.

### Integration Tests:

Manual smoke flow listed under each phase's Human Review covers every renamed router and every renamed route group. No automated end-to-end coverage exists for these flows today.

## Performance Considerations

None. Nesting routers under `pendingAllowed` / `pendingNotAllowed` is a purely syntactic change in tRPC — no extra middleware, no extra network round-trips, no change to query keys' cache identity beyond the path string itself (which means React Query will treat post-rename queries as fresh — expected and harmless on first load after deploy).

## Migration Notes

This is a code-only rename; no data migration. Deployment-time consideration: clients with stale bundles after deploy will hit the old paths and receive `NOT_FOUND` from tRPC. Standard for any tRPC path rename — acceptable because the affected pages are all behind auth and a hard refresh resolves it.

## References

- Current router: `api/app/src/root.ts`
- Procedures: `api/app/src/trpc.ts:115-187`
- Auth context: `api/app/src/auth/context.ts`
- Pre-existing inner route group: `apps/app/src/app/(app)/(user)/(pending-allowed)/`
- Recent split work this branch builds on: `thoughts/shared/plans/2026-05-14-auth-signin-signup-split.md`
