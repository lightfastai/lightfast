# Drop Redundant Clerk Hooks — Consolidate on tRPC

## Overview

Remove 5 files' direct Clerk hook usage (`useOrganization`, `useUser`) where the tRPC layer already serves the same data. Introduces a shared `useActiveOrg()` hook and adds `account.get` prefetch at the `(app)` layout level. After this work, Clerk hooks are used **only** for auth flows (`useSignIn`, `useSignUp`) and session actions (`setActive`, `signOut`, `getToken`) — never for data reads.

## Current State Analysis

The codebase has **two parallel data paths** for user/org reads:
1. **Clerk client hooks** (`useOrganization`, `useUser`) — call Clerk's client-side cache → Clerk API
2. **tRPC queries** (`account.get`, `organization.listUserOrganizations`) — call Clerk server-side via `clerkClient` → Redis cache (5-min TTL)

Components like `app-sidebar.tsx` and `user-page-header.tsx` already use tRPC for data. But 5 files still use Clerk hooks for the same data, creating a dual-source problem.

### Key Discoveries:

- `trpc.organization.listUserOrganizations` is already prefetched at `apps/app/src/app/(app)/layout.tsx:10`
- `trpc.account.get` is only prefetched at `(user)/layout.tsx:10`, not at the `(app)` level — needs to be added
- `events-table.tsx:143` already has `data.clerkOrgId` from the `events.list` tRPC response — its `useOrganization` call is entirely redundant
- `team-general-settings-client.tsx` demonstrates the slug→orgId pattern: `organizations.find(o => o.slug === slug)`
- No shared `useActiveOrg` hook exists — components independently resolve org ID via `usePathname()` or `useOrganization()`
- `useParams<{ slug: string }>()` is used at `link-sources-button.tsx:24` as established pattern

## Desired End State

- **0 files** import `useOrganization` or `useUser` from `@vendor/clerk/client`
- All org ID / user profile reads go through tRPC (server-cached, prefetched)
- New `useActiveOrg()` hook in `@repo/app-trpc/hooks` provides org context in one line
- `trpc.account.get` prefetched at `(app)/layout.tsx` for all authenticated pages

### Verification:
```bash
# No data-reading Clerk hooks remain (auth flow + action hooks are fine)
grep -r "useOrganization\b\|useUser\b" apps/app/src/ --include="*.tsx" --include="*.ts"
# Should return 0 results

# Type checking passes
pnpm typecheck

# Build passes
pnpm build:app
```

## What We're NOT Doing

- NOT removing `useSignIn`, `useSignUp` (auth flow hooks — no tRPC equivalent)
- NOT removing `useOrganizationList` (used for `setActive()` session action)
- NOT removing `useClerk` (used for `signOut()` session action)
- NOT removing `useAuth` (used for `getToken()` CLI auth)
- NOT creating a shared `useCurrentUser()` hook (only 2 consumers — not worth abstracting yet)
- NOT pruning unused re-exports from `@vendor/clerk/client` (separate cleanup)

## Implementation Approach

Three phases, ordered by dependency: infrastructure first, then org ID replacements, then user data replacements.

---

## Phase 1: Infrastructure — `useActiveOrg` Hook + `account.get` Prefetch [DONE]

### Overview

Create the shared `useActiveOrg()` hook and add the `account.get` prefetch to the top-level `(app)` layout. These are prerequisites for Phases 2 and 3.

### Changes Required:

#### 1. Create `useActiveOrg` hook

**File**: `packages/app-trpc/src/hooks/use-active-org.ts` (new file)

```ts
"use client";

import { useParams } from "next/navigation";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useTRPC } from "../react";

/**
 * Returns the active organization based on the URL slug.
 * Reads from the prefetched `listUserOrganizations` cache — no additional network request.
 * Must be used within a `[slug]` route segment.
 */
export function useActiveOrg() {
  const params = useParams<{ slug: string }>();
  const trpc = useTRPC();

  const { data: organizations } = useSuspenseQuery({
    ...trpc.organization.listUserOrganizations.queryOptions(),
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000,
  });

  return organizations.find((o) => o.slug === params.slug) ?? null;
}
```

#### 2. Export the hook from `@repo/app-trpc`

**File**: `packages/app-trpc/package.json`
**Changes**: Add `"./hooks"` export

```jsonc
// Add to "exports":
"./hooks": {
  "default": "./src/hooks/use-active-org.ts"
}
```

#### 3. Add `account.get` prefetch to `(app)/layout.tsx`

**File**: `apps/app/src/app/(app)/layout.tsx`
**Changes**: Add `prefetch(trpc.account.get.queryOptions())` alongside existing `listUserOrganizations` prefetch

```ts
export default function AppLayout({ children }: { children: React.ReactNode }) {
  // Prefetch user's organizations for the org switcher (shared across all authenticated pages)
  prefetch(trpc.organization.listUserOrganizations.queryOptions());
  // Prefetch user profile for header + notifications (shared across all authenticated pages)
  prefetch(trpc.account.get.queryOptions());

  return (
    // ... rest unchanged
  );
}
```

#### 4. Wrap `ConsoleNotificationsProvider` in Suspense boundary

**File**: `apps/app/src/app/(app)/layout.tsx`
**Changes**: Add `<Suspense>` around `<ConsoleNotificationsProvider>` as safety net (prefetch ensures near-instant resolution)

```tsx
import { Suspense } from "react";

// Inside the return:
<HydrateClient>
  <Suspense fallback={null}>
    <ConsoleNotificationsProvider>
      <div className="flex flex-1 overflow-hidden">{children}</div>
      <Toaster />
    </ConsoleNotificationsProvider>
  </Suspense>
</HydrateClient>
```

### Success Criteria:

#### Automated Verification:

- [x] `pnpm typecheck` passes
- [x] `packages/app-trpc/src/hooks/use-active-org.ts` exists
- [x] `grep -c "account.get" apps/app/src/app/\(app\)/layout.tsx` returns at least 1

#### Manual Verification:

- [ ] App loads without flash or layout shift (prefetch works correctly)
- [ ] No Suspense fallback visible on page load

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Replace `useOrganization` in 3 Files [DONE]

### Overview

Replace all 3 `useOrganization` usages with either `useActiveOrg()` or the existing tRPC response data.

### Changes Required:

#### 1. `events-table.tsx` — use `data.clerkOrgId` from tRPC response

**File**: `apps/app/src/app/(app)/(org)/[slug]/(manage)/events/_components/events-table.tsx`
**Changes**: Remove `useOrganization` import + call, use `data.clerkOrgId` for realtime channel

Current (lines 25, 134, 138–141):
```ts
import { useOrganization } from "@vendor/clerk/client";
// ...
const { organization } = useOrganization();
// ...
const { status } = useRealtime({
  channels: organization?.id ? [`org-${organization.id}`] : [],
  events: ["org.event"],
  enabled: !!organization?.id && isDefaultView,
```

Replace with:
```ts
// Remove: import { useOrganization } from "@vendor/clerk/client";
// Remove: const { organization } = useOrganization();
// ...
const { status } = useRealtime({
  channels: data.clerkOrgId ? [`org-${data.clerkOrgId}`] : [],
  events: ["org.event"],
  enabled: !!data.clerkOrgId && isDefaultView,
```

`data` is already available from the `useSuspenseQuery(trpc.events.list.queryOptions(...))` call at line 86. The `clerkOrgId` field is already present on the response (used at line 143).

#### 2. `org-search.tsx` — use `useActiveOrg()`

**File**: `apps/app/src/components/org-search.tsx`
**Changes**: Replace `useOrganization` with `useActiveOrg()`

Current (lines 9, 60, 100):
```ts
import { useOrganization } from "@vendor/clerk/client";
// ...
const { organization } = useOrganization();
// ...
const clerkOrgId = organization?.id ?? "";
```

Replace with:
```ts
import { useActiveOrg } from "@repo/app-trpc/hooks";
// ...
const activeOrg = useActiveOrg();
// ...
const clerkOrgId = activeOrg?.id ?? "";
```

Remove the `useOrganization` import line entirely.

#### 3. `ask-lightfast.tsx` — use `useActiveOrg()`

**File**: `apps/app/src/components/ask-lightfast.tsx`
**Changes**: Replace `useOrganization` with `useActiveOrg()`

Current (lines 4, 8–9):
```ts
import { useOrganization } from "@vendor/clerk/client";
// ...
const { organization } = useOrganization();
const clerkOrgId = organization?.id ?? "";
```

Replace with:
```ts
import { useActiveOrg } from "@repo/app-trpc/hooks";
// ...
const activeOrg = useActiveOrg();
const clerkOrgId = activeOrg?.id ?? "";
```

### Success Criteria:

#### Automated Verification:

- [x] `pnpm typecheck` passes
- [x] `grep -r "useOrganization" apps/app/src/ --include="*.tsx" | wc -l` returns 0

#### Manual Verification:

- [ ] Search page (`/[slug]/search`) works — search results return with correct org context
- [ ] Ask Lightfast page (`/[slug]/ask`) works — AI answers scoped to correct org
- [ ] Events page (`/[slug]/events`) works — live realtime events appear with green "Live" indicator
- [ ] Org switching still works correctly across all pages

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Replace `useUser` in 2 Files [DONE]

### Overview

Replace `useUser` with `useSuspenseQuery(trpc.account.get)` in `app-header.tsx` and `notifications-provider.tsx`.

### Changes Required:

#### 1. `app-header.tsx` — replace `useUser` with `trpc.account.get`

**File**: `apps/app/src/components/app-header.tsx`
**Changes**: Replace `useUser` with `useSuspenseQuery`. Keep `useClerk` for `signOut`. Align email/initials derivation with the pattern in `user-page-header.tsx`.

Current (lines 3–4, 10–37, 47):
```ts
import { useClerk, useUser } from "@vendor/clerk/client";
// ...
const { user, isLoaded } = useUser();

const email =
  user?.primaryEmailAddress?.emailAddress ??
  user?.emailAddresses[0]?.emailAddress ??
  user?.username ??
  "";

const initials = (() => {
  if (!user) return "LF";
  // ... derivation from user.firstName, user.lastName, user.username
})();

// Render gate:
{isLoaded && user && ( <UserMenu ... /> )}
```

Replace with:
```ts
import { useTRPC } from "@repo/app-trpc/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useClerk } from "@vendor/clerk/client";
// ...
const trpc = useTRPC();
const { signOut } = useClerk();

const { data: profile } = useSuspenseQuery({
  ...trpc.account.get.queryOptions(),
  refetchOnMount: false,
  refetchOnWindowFocus: false,
  staleTime: 5 * 60 * 1000,
});

const email = profile.primaryEmailAddress ?? profile.username ?? "";

const initials = (() => {
  const { firstName, lastName, fullName, username } = profile;
  if (fullName) {
    return fullName
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }
  if (firstName && lastName) {
    return `${firstName[0]}${lastName[0]}`.toUpperCase();
  }
  if (firstName) {
    return firstName.substring(0, 2).toUpperCase();
  }
  if (lastName) {
    return lastName.substring(0, 2).toUpperCase();
  }
  if (username) {
    return username.substring(0, 2).toUpperCase();
  }
  return "LF";
})();

// Remove the `isLoaded && user &&` gate — useSuspenseQuery guarantees data
<UserMenu
  email={email}
  initials={initials}
  onSignOut={() => void signOut({ redirectUrl: "/sign-in" })}
  settingsHref="/account/settings/general"
/>
```

#### 2. `notifications-provider.tsx` — replace `useUser` with `trpc.account.get`

**File**: `apps/app/src/components/notifications-provider.tsx`
**Changes**: Replace `useUser` with `useSuspenseQuery`. Remove loading branch — Suspense boundary (added in Phase 1) handles the loading state.

Current:
```ts
"use client";

import { useUser } from "@vendor/clerk/client";
import { NotificationsProvider } from "@vendor/knock/components/provider";
import type { ReactNode } from "react";

export function ConsoleNotificationsProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { user, isLoaded } = useUser();

  if (!(isLoaded && user)) {
    return (
      <NotificationsProvider userId="loading">{children}</NotificationsProvider>
    );
  }

  return (
    <NotificationsProvider userId={user.id}>{children}</NotificationsProvider>
  );
}
```

Replace with:
```ts
"use client";

import { useTRPC } from "@repo/app-trpc/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { NotificationsProvider } from "@vendor/knock/components/provider";
import type { ReactNode } from "react";

export function ConsoleNotificationsProvider({
  children,
}: {
  children: ReactNode;
}) {
  const trpc = useTRPC();
  const { data: profile } = useSuspenseQuery({
    ...trpc.account.get.queryOptions(),
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000,
  });

  return (
    <NotificationsProvider userId={profile.id}>{children}</NotificationsProvider>
  );
}
```

### Success Criteria:

#### Automated Verification:

- [x] `pnpm typecheck` passes
- [x] `grep -r "useUser\b" apps/app/src/ --include="*.tsx" | wc -l` returns 0
- [x] `grep -r "useOrganization\b" apps/app/src/ --include="*.tsx" | wc -l` returns 0 (still holds from Phase 2)
- [x] `pnpm build:app` succeeds

#### Manual Verification:

- [ ] User menu in header shows correct email and initials
- [ ] Sign-out from header works (redirects to `/sign-in`)
- [ ] Notifications load correctly (Knock provider receives real user ID)
- [ ] No flash or layout shift on page load
- [ ] Page load performance is unchanged or improved (check Network tab — no extra Clerk API calls)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding.

---

## Testing Strategy

### Automated:

- `pnpm typecheck` — catches any type mismatches from the hook signature changes
- `pnpm build:app` — validates the full build including SSR

### Manual Testing Steps:

1. **Org context**: Navigate to `/[slug]/search`, `/[slug]/ask`, `/[slug]/events` — verify all pages load with correct org data
2. **Realtime**: Go to Events page, trigger a webhook — verify the live event appears
3. **User data**: Check the header avatar shows correct initials and email in the dropdown
4. **Org switching**: Switch orgs via sidebar or header — verify all pages update correctly
5. **Auth flows**: Sign in, sign up, sign out — verify unchanged behavior
6. **Cold load**: Hard-refresh on an org page — verify no flash (prefetch works)

## Performance Considerations

- **Fewer client-side Clerk API calls**: Clerk's `useOrganization` and `useUser` make client-side requests to Clerk's API. Replacing them with prefetched tRPC queries eliminates these extra network requests.
- **Server-side caching**: tRPC queries go through Redis cache (5-min TTL) — subsequent requests within the TTL window are served from cache.
- **No waterfall**: Both `listUserOrganizations` and `account.get` are prefetched in the server component layout before `HydrateClient`, so client components get data synchronously.

## References

- Research document: `thoughts/shared/research/2026-04-05-clerk-hooks-vs-trpc-layer.md`
- Target pattern (org data via tRPC): `apps/app/src/components/app-sidebar.tsx:107-112`
- Target pattern (user data via tRPC): `apps/app/src/components/user-page-header.tsx:15-27`
- tRPC `account.get` procedure: `api/app/src/router/user/account.ts:28-58`
- tRPC `listUserOrganizations` procedure: `api/app/src/router/user/organization.ts:23-46`
- `(app)` layout prefetch: `apps/app/src/app/(app)/layout.tsx:10`
- Vendor abstraction layer: `vendor/clerk/src/client/index.ts`
