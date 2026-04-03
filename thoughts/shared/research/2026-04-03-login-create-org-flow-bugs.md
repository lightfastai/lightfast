---
date: 2026-04-03T18:50:00+10:00
researcher: claude
git_commit: 34f5b76837648856dc476b8f947679021f7a6679
branch: chore/remove-memory-api-key-service-auth
repository: lightfast
topic: "Login → Create Org flow: bugs and issues"
tags: [research, codebase, onboarding, auth, org-creation, clerk, trpc, inngest]
status: complete
last_updated: 2026-04-03
---

# Research: Login → Create Org Flow — Bugs & Issues

**Date**: 2026-04-03  
**Git Commit**: `34f5b7683`  
**Branch**: `chore/remove-memory-api-key-service-auth`

## Research Question

Find bugs and issues in the login → create org flow, including live browser testing.

## Summary

The login → create org flow is a synchronous, Clerk-only path with no Inngest or webhooks involved. The flow itself (auth → org creation tRPC call) works correctly. However there is a **critical pre-existing bug** in the post-onboarding redirect that drops users on a 404 or into a redirect loop after completing the invite step. The current branch (`chore/remove-memory-api-key-service-auth`) is internally consistent and introduces no new bugs in this path.

---

## End-to-End Flow

```
sign-up/sign-in (OTP or OAuth)
  → otp-island.tsx / sso-callback pages
  → window.location.href = "/account/welcome"
  → proxy.ts middleware (isPendingAllowedRoute: /account/(.*))
  → welcome/page.tsx — relay logic:
      ├─ active org in JWT           → /:orgSlug
      ├─ cached org memberships      → /:firstOrgSlug
      └─ no orgs                     → /account/teams/new
              → team-name-form.tsx
              → trpc.organization.create  (userScopedProcedure)
              → clerk.organizations.createOrganization()
              → setActive({ organization: data.organizationId })
              → router.push(/account/teams/invite?teamSlug=<slug>)
              → invite-teammates.ts server action
              → redirect("/new?teamSlug=<slug>")   ← BUG
```

---

## Bugs Found

### BUG 1 (Critical, Pre-existing): Broken post-invite redirect lands on 404 or redirect loop

**File**: `apps/app/src/app/(app)/(user)/(pending-allowed)/account/teams/invite/_actions/invite-teammates.ts:50`

```ts
redirect(`/new?teamSlug=${teamSlug}`);
```

`/new` is not a real route. The Next.js file system has no `app/new/page.tsx`. Instead, `/new` is caught by the `[slug]` dynamic segment at `apps/app/src/app/(app)/(org)/[slug]/layout.tsx`.

**Failure mode A — Active session** (normal case after `setActive` completes):
- `[slug]/layout.tsx:53` resolves `slug = "new"`
- `requireOrgAccess("new")` at `apps/app/src/lib/org-access-clerk.ts:58` calls `clerk.organizations.getOrganization({ slug: "new" })`
- Clerk throws: org not found
- `hasAccess = false` → `notFound()` at `layout.tsx:64`
- **User lands on 404 after completing onboarding**

**Failure mode B — Pending session** (edge case: `setActive` fails or propagation delay):
- `proxy.ts:52`: `isPendingAllowedRoute` only allows `/account/(.*)`
- `/new` is blocked → redirect to `/sign-in/tasks?redirect_url=/new?teamSlug=...`
- `app/layout.tsx` has `taskUrls: { "choose-organization": "/account/teams/new" }`
- Clerk's "choose-organization" task fires → **redirect loop back to the create team form**

The `teamSlug` query param on `/new` is completely ignored by the `[slug]` layout.

**Confirmed on main**: This bug exists identically on `main` — not introduced by the current branch.

**Correct target**: Should redirect to `/${teamSlug}` (the newly created org's slug).

---

### BUG 2 (Minor): No activity logging on org creation

**File**: `api/app/src/router/user/organization.ts:54-124`

The `organization.create` tRPC procedure calls `clerk.organizations.createOrganization()` and returns, but never calls `recordActivity`, `recordCriticalActivity`, or sends any Inngest event. Org creation is invisible in the activity log — no `auth` or `settings` category event fires.

This is consistent across the entire `organization.ts` router (`create`, `listUserOrganizations`, `updateName` — none log activity).

---

### BUG 3 (Dev-only): Inngest 404 on microfrontend proxy

The Inngest dev CLI polls `http://localhost:3024/api/inngest` via `PUT` for function sync. The microfrontends proxy at port 3024 does not route `/api/inngest` — it's only served directly at port 4107. The `PUT` returns 404, preventing Inngest function sync in dev.

**Impact**: Does not affect the auth/org creation path. Dev environment only.

---

## Detailed Findings

### Auth Entry Points

All auth paths land at `/account/welcome` post-authentication:
- `apps/app/src/app/(auth)/_components/otp-island.tsx` — OTP flow, `window.location.href = "/account/welcome"` on success
- `apps/app/src/app/(auth)/sign-up/sso-callback/page.tsx` — GitHub OAuth, finalizes to `/account/welcome`
- `apps/app/src/app/(auth)/sign-in/sso-callback/page.tsx` — GitHub OAuth sign-in
- `apps/app/src/app/(auth)/_components/oauth-button.tsx` — `redirectUrl: "/account/welcome"` on all three strategies
- `apps/app/src/app/(auth)/_components/session-activator.tsx` — magic-link/ticket flow → `/account/welcome`

### Middleware (Pending Session Gate)

`apps/app/src/proxy.ts:52`:
```ts
const isPendingAllowedRoute = createRouteMatcher(["/account/(.*)"]);
```

Only `/account/(.*)` routes are accessible to pending sessions (users with no active org). The org creation form at `/account/teams/new` is in this list. The final invite redirect target `/new` is **not**.

### tRPC Org Creation Procedure

`api/app/src/router/user/organization.ts:54-124`

- Procedure type: `userScopedProcedure` (accepts `clerk-pending` and `clerk-active`)
- Input: `{ slug: clerkOrgSlugSchema }`
- Action: `clerk.organizations.createOrganization({ name: slug, slug, createdBy: userId })`
- Returns: `{ organizationId, slug }`
- No DB writes. No Inngest events. No activity log.

### Post-Create Redirect (TeamNameForm)

`apps/app/src/app/(app)/(user)/(pending-allowed)/account/teams/new/_components/team-name-form.tsx:30-43`

```ts
onSuccess: async (data) => {
  if (setActive) {
    await setActive({ organization: data.organizationId });
  }
  void queryClient.invalidateQueries({ ... });
  router.push(`/account/teams/invite?teamSlug=${data.slug}`);
}
```

The `setActive` call is conditional on `setActive` being non-null. If `useOrganizationList` returns `null` for `setActive` (e.g., Clerk not fully initialized), the session stays pending and the subsequent `/new` redirect hits failure mode B.

### App Layout — Clerk Task URLs

`apps/app/src/app/(app)/layout.tsx`:
```ts
taskUrls: { "choose-organization": "/account/teams/new" }
```

This is what causes the redirect loop in failure mode B: Clerk's "choose-organization" task resolves to `/account/teams/new`, sending the user back to the create team form they just completed.

### No Inngest / Webhooks in Org Creation

- `api/app/src/inngest/index.ts` — only registers `recordActivity`. No org-creation function.
- No Clerk webhook handler exists anywhere in the codebase (confirmed by search). `vendor/clerk/src/webhooks.ts` exports types but no route consumes them.
- `packages/app-clerk-cache/src/membership.ts:102`: `TODO: Integrate with Clerk webhook handler when implemented`

### Branch Changes: Internally Consistent

The `chore/remove-memory-api-key-service-auth` branch removes the workspace abstraction layer:
- Deleted `workspaceRouter` and `workspaceAccessRouter` — zero surviving frontend references
- Removed `resolveWorkspaceByName` from `trpc.ts` — zero surviving callers
- Renamed `workspaceId` → `clerkOrgId` throughout jobs/activity/console schema
- Added `eventsRouter` to `root.ts`
- TypeScript compiles clean with zero errors

None of these changes affect the login → create org path. The org creation path uses `userScopedProcedure` and Clerk APIs exclusively — untouched by the workspace removal.

---

## Live Browser Testing

**Dev server**: Running at `http://localhost:3024` (microfrontends proxy) and `http://localhost:4107` (app direct).

**Confirmed in browser**:
- `/sign-up` → 200 OK (custom auth page)
- `/sign-in` → 200 OK
- `/account/teams/new` → renders correctly (active Clerk dev session present, no org)
- `/new?teamSlug=test-org` → **307 → `/sign-in/tasks?redirect_url=...`** (pending session blocked by middleware, confirming failure mode B)

No JavaScript console errors on page load. Two tRPC calls fire on `/account/teams/new` load (org listing queries).

---

## Code References

| File | Line | Description |
|---|---|---|
| `apps/app/src/app/(app)/(user)/(pending-allowed)/account/teams/invite/_actions/invite-teammates.ts` | 50 | **BUG**: `redirect("/new?teamSlug=${teamSlug}")` — wrong target |
| `apps/app/src/app/(app)/(org)/[slug]/layout.tsx` | 52-64 | `requireOrgAccess(slug)` → `notFound()` when slug="new" |
| `apps/app/src/lib/org-access-clerk.ts` | 46-83 | `requireOrgAccess` — calls Clerk by slug, throws if not found |
| `apps/app/src/proxy.ts` | 52 | `isPendingAllowedRoute` — only `/account/(.*)` allowed for pending |
| `apps/app/src/app/(app)/layout.tsx` | taskUrls | `choose-organization` → `/account/teams/new` (causes loop) |
| `apps/app/src/app/(app)/(user)/(pending-allowed)/account/teams/new/_components/team-name-form.tsx` | 30-43 | `onSuccess`: `setActive` conditional, then push to invite |
| `api/app/src/router/user/organization.ts` | 54-124 | `organization.create` procedure — no activity logging |
| `api/app/src/router/user/organization.ts` | 52 | Comment: "Does NOT create a default workspace" |
| `apps/app/src/app/(app)/(user)/(pending-allowed)/account/welcome/page.tsx` | — | Relay: active org → `/:slug`, cached → `/:slug`, none → `/account/teams/new` |

---

## Open Questions

- What should the final post-onboarding destination be? `/${teamSlug}` directly, or an intermediate "you're all set" page?
- Should org creation fire a `console/activity.record` event with category `auth`?
- The invite-teammates action is a mock (no real email sending) — is email invite wired up elsewhere?
