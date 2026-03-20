# UserPageHeader — tRPC `account.get` + Always Visible

## Overview

Replace Clerk's `useUser()` in `UserPageHeader` with `useSuspenseQuery` on `trpc.account.get`, add server-side prefetch in the `(user)` layout, and remove the `isLoaded && user` conditional so `UserMenu` always renders.

## Current State

- `user-page-header.tsx` derives `email` and `initials` from Clerk's `useUser()` hook
- `UserMenu` is gated: `{isLoaded && user && <UserMenu ... />}` — invisible during Clerk's client-side load phase
- `useOrganizationList` used solely for `setActive` (org switching)
- `(user)/layout.tsx` has no `prefetch` or `HydrateClient` — raw layout only
- `account.get` tRPC procedure already exists and returns `{ firstName, lastName, fullName, username, primaryEmailAddress, imageUrl }` directly from Clerk server-side
- `profile-data-display.tsx` already uses this exact pattern with `useSuspenseQuery` on `account.get`

## Desired End State

- `UserPageHeader` reads user identity from `trpc.account.get` via `useSuspenseQuery`
- `UserMenu` always renders (no `isLoaded` gate) — data is guaranteed by Suspense
- `(user)/layout.tsx` prefetches `account.get` so the header renders without a client-side fetch
- `useClerk` kept for `signOut` only; `useOrganizationList` kept for `setActive` only
- `useUser` import removed

## What We're NOT Doing

- Not touching `app-header.tsx` (org-scoped header — separate concern)
- Not changing `UserMenu` or `TeamSwitcher` component interfaces
- Not adding `imageUrl` to `UserMenu` (it doesn't accept one)
- Not removing `useOrganizationList` — no tRPC alternative for `setActive`
- Not creating a full skeleton component — using an inline height placeholder

---

## Phase 1: Prefetch `account.get` in `(user)/layout.tsx`

### Overview
Make `(user)/layout.tsx` a server component that prefetches `account.get` before rendering the header, and wraps in `HydrateClient` + `Suspense`.

### Changes Required

#### `apps/console/src/app/(app)/(user)/layout.tsx`

**Before:**
```tsx
import { UserPageHeader } from "~/components/user-page-header";

export default function UserLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex flex-1 flex-col bg-background">
      <UserPageHeader />
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        {children}
      </div>
    </div>
  );
}
```

**After:**
```tsx
import { HydrateClient, prefetch, userTrpc } from "@repo/app-trpc/server";
import { Suspense } from "react";
import { UserPageHeader } from "~/components/user-page-header";

export default function UserLayout({ children }: { children: React.ReactNode }) {
  prefetch(userTrpc.account.get.queryOptions());

  return (
    <HydrateClient>
      <div className="relative flex flex-1 flex-col bg-background">
        <Suspense fallback={<div className="h-14 border-b border-border" />}>
          <UserPageHeader />
        </Suspense>
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          {children}
        </div>
      </div>
    </HydrateClient>
  );
}
```

**Notes:**
- `listUserOrganizations` is already prefetched in parent `(app)/layout.tsx:13` — no duplication needed
- `HydrationBoundary` (used by `HydrateClient`) is composable — nested boundaries work correctly alongside the parent's `HydrateClient`
- The inline `<div className="h-14 border-b border-border" />` fallback matches the header height exactly; with prefetch, suspension will never actually occur in practice

### Success Criteria

#### Automated:
- [ ] Type check passes: `pnpm typecheck`
- [ ] Lint passes: `pnpm check`

#### Manual:
- [ ] Page loads without flash/layout shift on `/account/settings/general`

---

## Phase 2: Replace `useUser` with `trpc.account.get` in `UserPageHeader`

### Overview
Swap the Clerk client SDK `useUser` hook for `useSuspenseQuery` on `trpc.account.get`. Derive `email` and `initials` from the tRPC response. Remove the `isLoaded && user` conditional from `UserMenu`.

### Changes Required

#### `apps/console/src/components/user-page-header.tsx`

**Full replacement:**
```tsx
"use client";

import { useTRPC } from "@repo/app-trpc/react";
import { TeamSwitcher } from "@repo/ui/components/app-header/team-switcher";
import { UserMenu } from "@repo/ui/components/app-header/user-menu";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useClerk, useOrganizationList } from "@vendor/clerk/client";
import { NotificationsTrigger } from "@vendor/knock/components/trigger";
import { authUrl } from "~/lib/related-projects";

export function UserPageHeader() {
  const trpc = useTRPC();
  const { signOut } = useClerk();
  const { setActive } = useOrganizationList();

  const { data: profile } = useSuspenseQuery({
    ...trpc.account.get.queryOptions(),
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000,
  });

  const { data: organizations = [] } = useSuspenseQuery({
    ...trpc.organization.listUserOrganizations.queryOptions(),
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000,
  });

  const handleOrgSelect = async (orgId: string) => {
    if (setActive) {
      await setActive({ organization: orgId });
    }
  };

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
    if (firstName) return firstName.substring(0, 2).toUpperCase();
    if (lastName) return lastName.substring(0, 2).toUpperCase();
    if (username) return username.substring(0, 2).toUpperCase();
    return "LF";
  })();

  return (
    <div className="sticky top-0 z-10 flex h-14 items-center border-border border-b bg-background px-4 md:border-b-0 md:bg-transparent">
      <TeamSwitcher
        createTeamHref="/account/teams/new"
        mode="account"
        onOrgSelect={handleOrgSelect}
        organizations={organizations}
      />
      <div className="ml-auto flex items-center gap-3">
        <NotificationsTrigger />
        <UserMenu
          email={email}
          initials={initials}
          onSignOut={() =>
            void signOut({ redirectUrl: `${authUrl}/sign-in` })
          }
          settingsHref="/account/settings/general"
        />
      </div>
    </div>
  );
}
```

**Key changes:**
- `useUser` removed; `useClerk` kept for `signOut` only
- `profile.primaryEmailAddress` is already a `string | null` (not a Clerk object — the tRPC procedure extracts the string at `account.ts:43`)
- `UserMenu` rendered unconditionally — no `isLoaded && user` gate
- `fullName` path added to initials (matches `profile-data-display.tsx` pattern)

### Success Criteria

#### Automated:
- [ ] Type check passes: `pnpm typecheck`
- [ ] Lint passes: `pnpm check`
- [ ] Build succeeds: `pnpm build:console`

#### Manual:
- [ ] `UserMenu` appears immediately on page load (no flicker/hide)
- [ ] Email and initials render correctly
- [ ] Org switcher still works (clicking an org switches context)
- [ ] Sign out navigates to auth sign-in
- [ ] Navigate between `/account/settings/general`, `/account/teams`, `/account/welcome` — header always visible

## References

- `account.get` procedure: `api/console/src/router/user/account.ts:27`
- Pattern to follow: `apps/console/src/app/(app)/(user)/account/settings/general/_components/profile-data-display.tsx:28`
- Parent prefetch: `apps/console/src/app/(app)/layout.tsx:13`
- Current header: `apps/console/src/components/user-page-header.tsx`
