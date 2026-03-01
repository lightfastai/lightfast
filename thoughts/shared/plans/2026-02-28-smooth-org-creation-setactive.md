# Smooth Org Creation setActive Flow

## Overview

Fix the broken UX transition when creating a new organization. Currently, after org creation at `/account/teams/new`, the user is navigated to `/new?teamSlug=...` without calling `setActive()` first. This leaves the user in a "pending" state (no active org in Clerk session), causing the `/new` page's org-scoped tRPC prefetch to fail silently and creating an inconsistent session state.

## Current State Analysis

### The Bug
`create-team-button.tsx:82-88` navigates to `/new?teamSlug=...` on success **without** calling `setActive()`. The comment at line 25-26 claims "No setActive() call needed" — this is incorrect because:

1. `/new/page.tsx:58` prefetches `orgTrpc.connections.github.get.queryOptions()` — an **org-scoped** call that requires an active org in the Clerk session
2. The user remains "pending" (`orgId = null`) until `setActive` is called later in `create-workspace-button.tsx:165-166` — but that's too late for the server-side prefetch
3. Every other org-switching flow in the codebase (`TeamSwitcherLink:65`, `team-general-settings-client:82`) calls `setActive` before navigation

### Key Discoveries
- `setActive` is obtained from `useOrganizationList()` (`@clerk/nextjs`)
- The `organization.create` tRPC mutation returns `{ organizationId, slug }` — we have the `organizationId` needed for `setActive`
- The `/new` route is in `isTeamCreationRoute` (`middleware.ts:43-50`), so it bypasses `auth.protect()` — but the **org-scoped** prefetch still needs an active org context
- `create-workspace-button.tsx:165-166` already calls `setActive` after workspace creation — calling it earlier (after org creation) means it will be a no-op there (already active), which is fine

## Desired End State

After creating a team:
1. `setActive({ organization: newOrgId })` is called immediately after successful org creation
2. The user's Clerk session has the new org active before navigation to `/new`
3. The `/new` page's org-scoped prefetch (`orgTrpc.connections.github.get`) works correctly because the session has an active org
4. The transition feels seamless — no flash, no failed prefetch, no intermediate "pending" state

### Verification
- Create a new org → navigate to `/new` → the GitHub connector section loads without errors
- The Clerk session cookie contains the new org's ID immediately after creation
- No console errors about UNAUTHORIZED or missing org context on the `/new` page

## What We're NOT Doing

- Not changing the two-step flow (create team → create workspace) — that's a deliberate UX choice
- Not modifying middleware routing or `organizationSyncOptions`
- Not changing the `/new` page's layout or component structure
- Not removing the `setActive` call in `create-workspace-button.tsx` — it's still needed as a safety net (user might change the org dropdown on the `/new` page)

## Implementation Approach

Single-file change to `create-team-button.tsx`: add `useOrganizationList()` hook, call `setActive` in the `onSuccess` callback before `router.push`.

## Phase 1: Add `setActive` to Org Creation Flow

### Overview
Add Clerk's `setActive` call to the `CreateTeamButton` component so the new org is activated in the session before navigating to the workspace creation page.

### Changes Required:

#### 1. `apps/console/src/app/(app)/(user)/account/teams/new/_components/create-team-button.tsx`

**Import `useOrganizationList`** from `@clerk/nextjs` (same import used by `create-workspace-button.tsx` and `team-switcher-link.tsx`).

**Add the hook** inside the component to get `setActive`.

**Update `onSuccess`** to call `setActive` before `router.push`, and make it async.

**Update the comment** at the top to remove the incorrect "No setActive() call needed" note.

```tsx
// At top of file, add import:
import { useOrganizationList } from "@clerk/nextjs";

// Inside component, add hook:
const { setActive } = useOrganizationList();

// Update onSuccess callback:
onSuccess: async (data) => {
  toast.success(`Team created! Successfully created ${teamName}`);

  // Activate the new org in Clerk's session before navigating
  // This ensures the /new page's org-scoped prefetch has the correct org context
  if (setActive) {
    await setActive({ organization: data.organizationId });
  }

  // Navigate to workspace creation
  router.push(`/new?teamSlug=${data.slug}`);
},
```

**Update the component docblock** to reflect the new behavior:

```tsx
/**
 * Create Team Button
 * Client island for team creation mutation
 *
 * Features:
 * - Form validation before submission
 * - tRPC mutation to create Clerk organization
 * - Optimistic updates with rollback on error
 * - setActive() to activate new org in Clerk session before navigation
 * - Client-side navigation to workspace creation
 * - Toast notifications for success/error states
 */
```

### Success Criteria:

#### Automated Verification:
- [ ] Type checking passes: `pnpm typecheck`
- [ ] Linting passes: `pnpm lint`
- [ ] Build succeeds: `pnpm build:console`

#### Manual Verification:
- [ ] Create a new org → verify `/new` page loads with GitHub connector section (no errors)
- [ ] Check browser Network tab: `orgTrpc.connections.github.get` request on `/new` page returns 200 (not UNAUTHORIZED)
- [ ] Check browser console: no Clerk/auth errors after org creation
- [ ] Existing flow still works: create org → create workspace → lands on `/:slug/:workspace` correctly
- [ ] Team switcher still works after the full flow (new org appears, can switch between orgs)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Manual Testing Steps:
1. Sign up as a new user (or delete existing orgs)
2. Create a new team at `/account/teams/new`
3. Verify immediate navigation to `/new?teamSlug=<slug>` without flash
4. Verify the org selector on `/new` shows the new org pre-selected
5. Verify the GitHub connector section loads (not erroring due to missing org)
6. Complete workspace creation → verify landing on `/:slug/:workspace`
7. Verify org switcher shows the new org

### Edge Cases:
- User with existing orgs creating an additional org
- Rapid double-click on "Continue" button (already handled by `isPending` disable)
- Network latency on `setActive` call (should be fast — it's a client-side cookie update)

## Performance Considerations

`setActive` is a client-side operation that updates Clerk session cookies — it does NOT make a network request to Clerk's servers. The additional latency is negligible (< 10ms). This is confirmed by the pattern in `TeamSwitcherLink` which calls `setActive` inline during click handling without any perceived delay.

## References

- `setActive` in team switcher: `apps/console/src/components/team-switcher-link.tsx:65-66`
- `setActive` in workspace creation: `apps/console/src/app/(app)/(user)/new/_components/create-workspace-button.tsx:165-166`
- `setActive` in team rename: `apps/console/src/app/(app)/(org)/[slug]/(manage)/settings/_components/team-general-settings-client.tsx:82-83`
- Middleware org sync: `apps/console/src/middleware.ts:186-188`
- Org creation tRPC: `api/console/src/router/user/organization.ts:116-155`
