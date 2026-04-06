---
date: 2026-04-05T12:00:00+08:00
researcher: claude
git_commit: 1eee35c3fb8e0499e18e522daccf1a8e3e68a9aa
branch: main
topic: "Clerk use* hooks vs tRPC layer — mapping all client-side Clerk state dependencies"
tags: [research, codebase, clerk, trpc, auth, organization, hooks]
status: complete
last_updated: 2026-04-05
---

# Research: Clerk `use*` Hooks vs tRPC Layer

**Date**: 2026-04-05
**Git Commit**: [`1eee35c3f`](https://github.com/lightfastai/lightfast/blob/1eee35c3fb8e0499e18e522daccf1a8e3e68a9aa)
**Branch**: main

## Research Question

Map all Clerk `use*` hook usage across the codebase, identify what the tRPC layer already provides as an alternative, and document where the two overlap or could diverge.

## Summary

The codebase uses **7 distinct Clerk hooks** across **14 files**, all in `apps/app/src/`. The vendor abstraction (`@vendor/clerk/client`) re-exports 12 hooks but only 7 are actually called. The hooks fall into three clear categories based on replaceability:

1. **Auth flow hooks** (`useSignIn`, `useSignUp`) — These drive the sign-in/sign-up UI flows and have no tRPC equivalent. They must remain.
2. **Data-reading hooks** (`useOrganization`, `useUser`) — These read org/user data that is **already served by tRPC** (`organization.listUserOrganizations`, `account.get`). These are candidates for removal.
3. **Action hooks** (`useOrganizationList.setActive`, `useClerk.signOut`, `useAuth.getToken`) — These trigger Clerk session mutations (switching org, signing out, getting JWTs). `setActive` and `signOut` are Clerk SDK actions with no tRPC equivalent. `getToken` is a one-off for CLI auth.

The tRPC layer already proxies all Clerk data reads through server-side `clerkClient` calls with Redis caching (5-min TTL). Components like `app-sidebar.tsx` and `user-page-header.tsx` already demonstrate the target pattern: tRPC for data, Clerk only for `setActive`/`signOut`.

## Detailed Findings

### Category 1: Auth Flow Hooks (KEEP — no tRPC equivalent)

These hooks drive the authentication UI and interact with Clerk's client-side auth state machine. They have no server-side tRPC counterpart.

#### `useSignIn`

| File | Line | Usage |
|---|---|---|
| [`session-activator.tsx`](https://github.com/lightfastai/lightfast/blob/1eee35c3fb8e0499e18e522daccf1a8e3e68a9aa/apps/app/src/app/(auth)/_components/session-activator.tsx#L5) | 5 | `signIn.ticket()`, `signIn.finalize()` — invite ticket activation |
| [`otp-island.tsx`](https://github.com/lightfastai/lightfast/blob/1eee35c3fb8e0499e18e522daccf1a8e3e68a9aa/apps/app/src/app/(auth)/_components/otp-island.tsx#L5) | 5 | `signIn.emailCode.sendCode()`, `.verifyCode()`, `signIn.finalize()` — OTP flow |
| [`oauth-button.tsx`](https://github.com/lightfastai/lightfast/blob/1eee35c3fb8e0499e18e522daccf1a8e3e68a9aa/apps/app/src/app/(auth)/_components/oauth-button.tsx#L7) | 7 | `signIn.sso()` — OAuth redirect initiation |

#### `useSignUp`

| File | Line | Usage |
|---|---|---|
| [`sign-up/sso-callback/page.tsx`](https://github.com/lightfastai/lightfast/blob/1eee35c3fb8e0499e18e522daccf1a8e3e68a9aa/apps/app/src/app/(auth)/sign-up/sso-callback/page.tsx#L6) | 6 | `signUp.status`, `signUp.update()`, `signUp.finalize()` — post-OAuth completion |
| [`otp-island.tsx`](https://github.com/lightfastai/lightfast/blob/1eee35c3fb8e0499e18e522daccf1a8e3e68a9aa/apps/app/src/app/(auth)/_components/otp-island.tsx#L5) | 5 | `signUp.create()`, `signUp.verifications.sendEmailCode()`, `.verifyEmailCode()` |
| [`oauth-button.tsx`](https://github.com/lightfastai/lightfast/blob/1eee35c3fb8e0499e18e522daccf1a8e3e68a9aa/apps/app/src/app/(auth)/_components/oauth-button.tsx#L7) | 7 | `signUp.create({ ticket })`, `signUp.sso()` |

All auth flow hooks are confined to `apps/app/src/app/(auth)/` components. No overlap with tRPC.

---

### Category 2: Data-Reading Hooks (DROP candidates — tRPC already serves this data)

#### `useOrganization` — reads `organization.id`

| File | Line | Destructured | Used For |
|---|---|---|---|
| [`org-search.tsx`](https://github.com/lightfastai/lightfast/blob/1eee35c3fb8e0499e18e522daccf1a8e3e68a9aa/apps/app/src/components/org-search.tsx#L59) | 59 | `{ organization }` | `organization.id` → `X-Org-ID` header for `/v1/search` fetch |
| [`ask-lightfast.tsx`](https://github.com/lightfastai/lightfast/blob/1eee35c3fb8e0499e18e522daccf1a8e3e68a9aa/apps/app/src/components/ask-lightfast.tsx#L8) | 8 | `{ organization }` | `organization.id` → prop to `<AnswerInterface>` |
| [`events-table.tsx`](https://github.com/lightfastai/lightfast/blob/1eee35c3fb8e0499e18e522daccf1a8e3e68a9aa/apps/app/src/app/(app)/(org)/[slug]/(manage)/events/_components/events-table.tsx#L134) | 134 | `{ organization }` | `organization.id` → realtime channel name |

**tRPC equivalent**: `trpc.organization.listUserOrganizations` returns org IDs. The active org's `clerkOrgId` is also available in the tRPC context as `ctx.auth.orgId` (for `clerk-active` sessions). However, these components need the org ID on the client side for non-tRPC calls (raw fetch headers, realtime subscriptions).

#### `useUser` — reads user profile

| File | Line | Destructured | Used For |
|---|---|---|---|
| [`app-header.tsx`](https://github.com/lightfastai/lightfast/blob/1eee35c3fb8e0499e18e522daccf1a8e3e68a9aa/apps/app/src/components/app-header.tsx#L11) | 11 | `{ user, isLoaded }` | email, initials derivation for `<UserMenu>` |
| [`notifications-provider.tsx`](https://github.com/lightfastai/lightfast/blob/1eee35c3fb8e0499e18e522daccf1a8e3e68a9aa/apps/app/src/components/notifications-provider.tsx#L12) | 12 | `{ user, isLoaded }` | `user.id` for notifications channel identity |

**tRPC equivalent**: `trpc.account.get` returns `{ id, firstName, lastName, fullName, username, primaryEmailAddress, imageUrl }` — the exact same data. Already used in [`user-page-header.tsx`](https://github.com/lightfastai/lightfast/blob/1eee35c3fb8e0499e18e522daccf1a8e3e68a9aa/apps/app/src/components/user-page-header.tsx#L15) and [`profile-data-display.tsx`](https://github.com/lightfastai/lightfast/blob/1eee35c3fb8e0499e18e522daccf1a8e3e68a9aa/apps/app/src/app/(app)/(user)/(pending-allowed)/account/settings/general/_components/profile-data-display.tsx#L28) for the same purpose.

**Existing duplication**: `app-header.tsx` derives `email` + `initials` from `useUser()`, while `user-page-header.tsx` derives the identical values from `trpc.account.get`. The derivation logic is duplicated.

---

### Category 3: Action Hooks (KEEP — but narrow the surface)

#### `useOrganizationList` — used exclusively for `setActive()`

| File | Line | Used For |
|---|---|---|
| [`app-sidebar.tsx`](https://github.com/lightfastai/lightfast/blob/1eee35c3fb8e0499e18e522daccf1a8e3e68a9aa/apps/app/src/components/app-sidebar.tsx#L105) | 105 | `setActive({ organization: orgId })` on org switch |
| [`user-page-header.tsx`](https://github.com/lightfastai/lightfast/blob/1eee35c3fb8e0499e18e522daccf1a8e3e68a9aa/apps/app/src/components/user-page-header.tsx#L13) | 13 | `setActive({ organization: orgId })` on org switch |
| [`team-name-form.tsx`](https://github.com/lightfastai/lightfast/blob/1eee35c3fb8e0499e18e522daccf1a8e3e68a9aa/apps/app/src/app/(app)/(user)/(pending-allowed)/account/teams/new/_components/team-name-form.tsx#L25) | 25 | `setActive()` after tRPC `organization.create` |
| [`team-general-settings-client.tsx`](https://github.com/lightfastai/lightfast/blob/1eee35c3fb8e0499e18e522daccf1a8e3e68a9aa/apps/app/src/app/(app)/(org)/[slug]/(manage)/settings/_components/team-general-settings-client.tsx#L40) | 40 | `setActive()` after tRPC `organization.updateName` |

`setActive` is a Clerk SDK method that updates the session cookie. This is a Clerk-specific action with no tRPC equivalent — it mutates Clerk's client-side session state. However, all four files already use tRPC for the actual data (org list, create, rename). The `setActive` call is the only remaining Clerk dependency.

#### `useClerk` — used exclusively for `signOut()`

| File | Line | Used For |
|---|---|---|
| [`app-header.tsx`](https://github.com/lightfastai/lightfast/blob/1eee35c3fb8e0499e18e522daccf1a8e3e68a9aa/apps/app/src/components/app-header.tsx#L10) | 10 | `signOut({ redirectUrl: "/sign-in" })` |
| [`user-page-header.tsx`](https://github.com/lightfastai/lightfast/blob/1eee35c3fb8e0499e18e522daccf1a8e3e68a9aa/apps/app/src/components/user-page-header.tsx#L12) | 12 | `signOut({ redirectUrl: "/sign-in" })` |
| [`sign-out-button.tsx`](https://github.com/lightfastai/lightfast/blob/1eee35c3fb8e0499e18e522daccf1a8e3e68a9aa/apps/app/src/app/(app)/(org)/sign-out-button.tsx#L12) | 12 | `signOut({ redirectUrl: "/sign-in" })` |

`signOut` is a Clerk SDK method that clears the session. No tRPC equivalent exists or should — this is an auth action.

#### `useAuth` — used for `getToken()`

| File | Line | Used For |
|---|---|---|
| [`cli-auth-client.tsx`](https://github.com/lightfastai/lightfast/blob/1eee35c3fb8e0499e18e522daccf1a8e3e68a9aa/apps/app/src/app/(app)/(user)/(pending-not-allowed)/cli/auth/_components/cli-auth-client.tsx#L8) | 8 | `getToken()` for CLI JWT exchange |

One-off usage for CLI authentication flow. `isSignedIn` and `isLoaded` are also read here to gate the token exchange.

---

### The tRPC Layer: What Already Exists

The tRPC API already wraps all Clerk data reads server-side:

| tRPC Procedure | Clerk API Called | Client Usage |
|---|---|---|
| `account.get` | `clerk.users.getUser(userId)` | `user-page-header.tsx`, `profile-data-display.tsx` |
| `organization.listUserOrganizations` | `clerk.users.getOrganizationMembershipList()` | `app-sidebar.tsx`, `user-page-header.tsx`, `team-general-settings-client.tsx` |
| `organization.create` | `clerk.organizations.createOrganization()` | `team-name-form.tsx` |
| `organization.updateName` | `clerk.organizations.updateOrganization()` | `team-general-settings-client.tsx` |

All tRPC auth routes go through a Redis-cached membership lookup (`@repo/app-clerk-cache`, 5-min TTL at `clerk:user-orgs:{userId}`).

The tRPC context (`api/app/src/trpc.ts:59-89`) stamps every request with a discriminated union:
- `clerk-active` → `{ userId, orgId }` (both available)
- `clerk-pending` → `{ userId }` (no org selected)
- `unauthenticated` → no identity

Two procedure guards enforce this:
- `userScopedProcedure` — requires `clerk-pending` or `clerk-active`
- `orgScopedProcedure` — requires `clerk-active` only

---

### Overlap Map: Components Using Both Clerk Hooks AND tRPC

| Component | Clerk Hook(s) | tRPC Query/Mutation | What Clerk Provides | What tRPC Provides |
|---|---|---|---|---|
| `app-sidebar.tsx` | `useOrganizationList` | `organization.listUserOrganizations` | `setActive` (action) | org list (data) |
| `user-page-header.tsx` | `useClerk`, `useOrganizationList` | `account.get`, `organization.listUserOrganizations` | `signOut`, `setActive` (actions) | user profile, org list (data) |
| `team-name-form.tsx` | `useOrganizationList` | `organization.create` | `setActive` (action) | create mutation |
| `team-general-settings-client.tsx` | `useOrganizationList` | `organization.listUserOrganizations`, `organization.updateName` | `setActive` (action) | org data, rename mutation |
| `events-table.tsx` | `useOrganization` | `events.list` | `organization.id` (data) | event list (data) |

**Pattern**: Where overlap exists, tRPC handles data and Clerk handles session actions. The exception is `useOrganization` in `org-search.tsx`, `ask-lightfast.tsx`, and `events-table.tsx`, which read `organization.id` directly from Clerk client state instead of tRPC.

---

### Known Sync Issues (from codebase comments)

1. **Org rename propagation delay** (`team-general-settings-client.tsx:80-95`):
   > "Update Clerk's active organization before navigation. This ensures cookies are updated before the RSC request."
   > "Still navigate, but may cause temporary mismatch"

2. **`auth().orgSlug` stale after `setActive`** (`[slug]/layout.tsx:26-31`):
   > "After org name changes, setActive() updates cookies but there's propagation delay"
   > "auth().orgSlug might return old slug or null during RSC request"
   > Solution: `requireOrgAccess` fetches org directly from Clerk by slug, bypassing the cookie.

3. **Unimplemented webhook cache invalidation** (`app-clerk-cache/src/membership.ts:103-106`):
   > `invalidateUserOrgMemberships` exists but the TODO says "Integrate with Clerk webhook handler when implemented"

---

### Vendor Abstraction Layer

All Clerk imports go through `@vendor/clerk` (`vendor/clerk/`), which re-exports from `@clerk/nextjs`, `@clerk/backend`, and `@clerk/shared`.

**Exception**: Three CLI API routes import directly from `@clerk/nextjs/server`:
- `apps/app/src/app/api/cli/login/route.ts:6`
- `apps/app/src/app/api/cli/setup/route.ts:7`
- `apps/app/src/app/api/cli/lib/verify-jwt.ts:1`

**Re-exported but unused hooks**: `useEmailLink`, `useReverification`, `useSession`, `useSessionList`, `useOrganizationCreationDefaults` — available in `@vendor/clerk/client` but never called.

## Code References

### Clerk Hook Imports (all via `@vendor/clerk/client`)
- `apps/app/src/components/org-search.tsx:8` — `useOrganization`
- `apps/app/src/components/ask-lightfast.tsx:4` — `useOrganization`
- `apps/app/src/app/(app)/(org)/[slug]/(manage)/events/_components/events-table.tsx:25` — `useOrganization`
- `apps/app/src/components/app-sidebar.tsx:23` — `useOrganizationList`
- `apps/app/src/components/user-page-header.tsx:7` — `useClerk`, `useOrganizationList`
- `apps/app/src/components/app-header.tsx:4` — `useClerk`, `useUser`
- `apps/app/src/components/notifications-provider.tsx:3` — `useUser`
- `apps/app/src/app/(app)/(user)/(pending-not-allowed)/cli/auth/_components/cli-auth-client.tsx:3` — `useAuth`
- `apps/app/src/app/(auth)/_components/session-activator.tsx:5` — `useSignIn`
- `apps/app/src/app/(auth)/_components/otp-island.tsx:5` — `useSignIn`, `useSignUp`
- `apps/app/src/app/(auth)/_components/oauth-button.tsx:7` — `useSignIn`, `useSignUp`
- `apps/app/src/app/(auth)/sign-up/sso-callback/page.tsx:6` — `useSignUp`
- `apps/app/src/app/(app)/(user)/(pending-allowed)/account/teams/new/_components/team-name-form.tsx:7` — `useOrganizationList`
- `apps/app/src/app/(app)/(org)/[slug]/(manage)/settings/_components/team-general-settings-client.tsx:25` — `useOrganizationList`
- `apps/app/src/app/(app)/(org)/sign-out-button.tsx:4` — `useClerk`

### tRPC Auth Routes
- `api/app/src/router/user/account.ts:28-58` — `account.get`
- `api/app/src/router/user/organization.ts:23-46` — `organization.listUserOrganizations`
- `api/app/src/router/user/organization.ts:55-125` — `organization.create`
- `api/app/src/router/user/organization.ts:133-211` — `organization.updateName`

### tRPC Auth Infrastructure
- `api/app/src/trpc.ts:22-38` — `AuthContext` discriminated union
- `api/app/src/trpc.ts:59-89` — `createTRPCContext`
- `api/app/src/trpc.ts:187-261` — `userScopedProcedure` / `orgScopedProcedure`
- `api/app/src/trpc.ts:280-325` — `verifyOrgMembership`
- `packages/app-clerk-cache/src/membership.ts:25-62` — Redis-cached membership lookup

### Vendor Layer
- `vendor/clerk/src/client/index.ts:1-47` — client hook re-exports
- `vendor/clerk/src/server.ts:1-61` — server function re-exports

## Architecture Documentation

### Current Data Flow

```
┌─ Client Components ─────────────────────────────────────────────┐
│                                                                  │
│  AUTH FLOWS (Clerk-only):                                       │
│    useSignIn / useSignUp → Clerk client state machine           │
│                                                                  │
│  DATA READS (mixed):                                            │
│    useUser()          → Clerk client cache → Clerk API          │
│    useOrganization()  → Clerk client cache → Clerk API          │
│                                                                  │
│    trpc.account.get   → tRPC → clerkClient.users.getUser()     │
│    trpc.org.list      → tRPC → clerkClient.users.getOrgList()  │
│                        ↳ Redis cache (5min TTL)                 │
│                                                                  │
│  ACTIONS (Clerk-only):                                          │
│    useOrganizationList().setActive → Clerk session cookie       │
│    useClerk().signOut              → Clerk session clear        │
│    useAuth().getToken              → Clerk JWT                  │
│                                                                  │
│  MUTATIONS (tRPC → Clerk backend):                              │
│    trpc.org.create      → clerkClient.orgs.create              │
│    trpc.org.updateName  → clerkClient.orgs.update              │
│    Then: setActive() to sync cookie                             │
└──────────────────────────────────────────────────────────────────┘
```

### Hook → Replaceable Summary

| Hook | Files | Replaceable by tRPC? | Notes |
|---|---|---|---|
| `useSignIn` | 3 | No | Auth flow state machine |
| `useSignUp` | 3 | No | Auth flow state machine |
| `useClerk` (signOut) | 3 | No | Session destruction |
| `useAuth` (getToken) | 1 | No | JWT for CLI exchange |
| `useOrganizationList` (setActive) | 4 | No | Session cookie mutation |
| **`useOrganization`** (org.id) | **3** | **Yes** | org ID already in tRPC context |
| **`useUser`** (profile) | **2** | **Yes** | `account.get` returns same data |

**5 files use hooks that are directly replaceable** with existing tRPC queries.

## Historical Context (from thoughts/)

- `thoughts/shared/research/2026-04-05-app-platform-auth-flow.md` — Traces the two-layer auth architecture. Layer 1 is Clerk sessions (the hooks under study), Layer 2 is service JWTs for platform calls. Confirms `AuthContext` discriminated union as the canonical auth shape.
- `thoughts/shared/plans/2026-04-05-asynclocalstorage-request-context.md` — Plan references `AuthContext` (Clerk: `userId`, `orgId`) as a source for request-scoped identity.
- `thoughts/shared/plans/2026-04-05-standardize-platform-trpc.md` — Notes platform uses JWT auth, not Clerk, and is out of scope.

No prior migration plans targeting Clerk hooks were found.

## Open Questions

1. **How should `useOrganization().organization.id` be replaced in `org-search.tsx` and `ask-lightfast.tsx`?** These components use the org ID for raw `fetch` headers and prop passing, not tRPC calls. Options: a tRPC query, a shared React context seeded from the server-prefetched org list, or reading from the URL slug and resolving server-side.

2. **What is the migration path for `setActive()`?** Every org-switching and post-mutation flow calls `setActive` to sync Clerk's session cookie. If Clerk hooks are dropped, `setActive` would need to be called via `clerkClient` server-side or through a minimal Clerk utility kept in the vendor layer. Clerk's `organizationSyncOptions` in middleware already syncs org from URL, but `setActive` ensures the cookie is set before navigation.

3. **Should `signOut()` move to a server action?** Currently 3 components call `useClerk().signOut()`. Clerk offers `signOut` as a server-side redirect too — the middleware could handle it via a `/sign-out` route.

4. **How should `notifications-provider.tsx` get `user.id`?** Currently reads from `useUser()`. If replaced, it would need the user ID from tRPC or a server-seeded context.
