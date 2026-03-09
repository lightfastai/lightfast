# Extract `@repo/app-header` Package — Implementation Plan

## Overview

Extract `TeamSwitcher`, `TeamSwitcherLink`, and `UserDropdownMenu` from `apps/console/src/components/` into a new `@repo/app-header` package with props-only interfaces and zero vendor dependencies. Both `apps/console` and `apps/auth` will import the shared components and provide their own data via props.

## Current State Analysis

### Components to extract (all in `apps/console/src/components/`):

| Component | File | Lines | Current vendor deps |
|---|---|---|---|
| `TeamSwitcher` | `team-switcher.tsx` | 167 | `@repo/console-trpc`, `@tanstack/react-query` |
| `TeamSwitcherLink` | `team-switcher-link.tsx` | 87 | `@vendor/clerk/client` |
| `UserDropdownMenu` | `user-dropdown-menu.tsx` | 132 | `@vendor/clerk/client` |

### Consumers:
- `app-sidebar.tsx:149` — `<TeamSwitcher mode={mode} />`
- `user-page-header.tsx:10` — `<TeamSwitcher mode="account" />`
- `workspace-switcher.tsx:16,71,110` — imports `TeamSwitcherLink` directly

### Data flow:
- `apps/console/src/app/(app)/layout.tsx:13` prefetches `listUserOrganizations` via RSC
- `TeamSwitcher` calls `useSuspenseQuery(trpc.organization.listUserOrganizations)` — always resolves from cache
- `TeamSwitcherLink` calls `useOrganizationList().setActive()` — Clerk-specific
- `UserDropdownMenu` calls `useClerk().signOut()` and `useUser()` — Clerk-specific

### Key Discoveries:
- Auth app has `@repo/ui`, `@vendor/clerk`, `lucide-react`, `next` but NO tRPC, NO React Query, NO Knock
- Auth app has no `src/components/` directory — components live in route-group `_components/` folders
- `@repo/ui` pattern: source exports (`.tsx` → no build step), `workspace:*`, extends `@repo/typescript-config/react-library.json`
- Auth app layout at `(auth)/layout.tsx` has an inline header (logo + CTA) — separate from where shared header would go
- `Organization` type from tRPC: `{ id: string; slug: string | null; name: string; role: string; imageUrl: string }`
- Shared components only need `{ id: string; slug: string | null; name: string }` — minimal subset

## Desired End State

A `packages/app-header/` package exists with:
- Props-only `TeamSwitcher`, `TeamSwitcherLink`, `UserMenu` components
- Zero vendor dependencies (no Clerk, no tRPC, no Knock)
- Package deps: `@repo/ui`, `next`, `lucide-react`, `react`

Both apps consume these components:
- **Console**: data from tRPC `useSuspenseQuery`, Clerk `setActive` / `signOut` / `useUser` passed as callbacks/props
- **Auth**: data from Clerk `useOrganizationList`, same Clerk callbacks passed as props

### Verification:
- `pnpm --filter @lightfast/console typecheck` passes
- `pnpm --filter @lightfast/auth typecheck` passes
- `pnpm build:console` succeeds
- `pnpm build:auth` succeeds (if `build:auth` script exists, else `pnpm --filter @lightfast/auth build`)
- Console UI works identically — team switcher, user menu, workspace switcher all functional
- Auth app has a new `(user)` route group with the shared header

## What We're NOT Doing

- Not extracting `WorkspaceSwitcher` — it stays console-only (no auth use case)
- Not extracting `AppSidebar` — console-specific layout
- Not adding a context provider — pure props pattern
- Not sharing the `UserPageHeader` layout component — each app composes its own ~15-line wrapper
- Not changing the tRPC procedure or data model
- Not removing the RSC prefetch in console's `AppLayout`

## Implementation Approach

Props-only components (shadcn pattern). Each component declares exactly what data it needs as props. No context, no hooks that reach into vendor SDKs. Each app owns data fetching and auth SDK interactions.

---

## Phase 1: Create `@repo/app-header` Package

### Overview
Create the new package with all three shared components refactored to props-only interfaces.

### Changes Required:

#### 1. Package scaffolding
**File**: `packages/app-header/package.json`

```json
{
  "name": "@repo/app-header",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "license": "FSL-1.1-Apache-2.0",
  "sideEffects": false,
  "exports": {
    "./team-switcher": "./src/team-switcher.tsx",
    "./team-switcher-link": "./src/team-switcher-link.tsx",
    "./user-menu": "./src/user-menu.tsx"
  },
  "dependencies": {
    "@repo/ui": "workspace:*",
    "lucide-react": "catalog:",
    "next": "catalog:next16",
    "react": "19.2.4"
  },
  "devDependencies": {
    "@repo/typescript-config": "workspace:*",
    "typescript": "catalog:"
  }
}
```

**File**: `packages/app-header/tsconfig.json`

```json
{
  "extends": "@repo/typescript-config/react-library.json",
  "compilerOptions": {
    "outDir": "dist",
    "baseUrl": ".",
    "paths": {
      "@repo/app-header/*": ["./src/*"]
    }
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

#### 2. TeamSwitcherLink (props-only)
**File**: `packages/app-header/src/team-switcher-link.tsx`

Refactored from `apps/console/src/components/team-switcher-link.tsx`. Key changes:
- Remove `@vendor/clerk/client` import (`useOrganizationList`)
- Remove `orgId` and `orgSlug` props — replaced by single `href` string
- Remove `workspaceName` prop — caller builds full URL
- Add `onNavigate?: () => Promise<void>` prop — app provides auth-specific logic (e.g., `clerk.setActive()`)
- Rename `onSwitch` → `onClick` for clarity (closes dropdown, etc.)

```tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

interface TeamSwitcherLinkProps {
  children: React.ReactNode;
  className?: string;
  href: string;
  /** Async callback invoked before navigation (e.g., set active org in auth SDK) */
  onNavigate?: () => Promise<void>;
  /** Sync callback invoked on click (e.g., close dropdown) */
  onClick?: () => void;
}

export function TeamSwitcherLink({
  children,
  className,
  href,
  onNavigate,
  onClick,
}: TeamSwitcherLinkProps) {
  const router = useRouter();

  const handleClick = async (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) {
      return;
    }

    e.preventDefault();
    onClick?.();

    try {
      if (onNavigate) {
        await onNavigate();
      }
      router.push(href);
    } catch (error) {
      console.error("Failed to navigate:", error);
    }
  };

  return (
    <Link
      className={className}
      href={href}
      onClick={handleClick}
      prefetch={true}
    >
      {children}
    </Link>
  );
}
```

#### 3. TeamSwitcher (props-only)
**File**: `packages/app-header/src/team-switcher.tsx`

Refactored from `apps/console/src/components/team-switcher.tsx`. Key changes:
- Remove `@repo/console-trpc` and `@tanstack/react-query` imports
- Accept `organizations` as required prop
- Accept `onOrgSelect` callback for org switching (app provides auth-specific logic)
- Accept `createTeamHref` for the "Create Team" link
- Keep `usePathname()` for `currentOrgSlug` detection — this is a UI concern, not a data concern

```tsx
"use client";

import { Avatar, AvatarFallback } from "@repo/ui/components/ui/avatar";
import { Button } from "@repo/ui/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/components/ui/dropdown-menu";
import { cn } from "@repo/ui/lib/utils";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { TeamSwitcherLink } from "./team-switcher-link";

type TeamSwitcherMode = "organization" | "account";

interface Organization {
  id: string;
  slug: string | null;
  name: string;
}

interface TeamSwitcherProps {
  /** List of organizations the user belongs to */
  organizations: Organization[];
  /**
   * Mode determines what is displayed:
   * - "organization": Shows current organization name
   * - "account": Shows "My Account" but allows switching to organizations
   */
  mode?: TeamSwitcherMode;
  /** Called when user selects an org — app should handle auth SDK (e.g., clerk.setActive) */
  onOrgSelect: (orgId: string, orgSlug: string) => Promise<void>;
  /** Href for "Create Team" link (e.g., "/account/teams/new") */
  createTeamHref: string;
}

export type { Organization, TeamSwitcherMode, TeamSwitcherProps };

export function TeamSwitcher({
  organizations,
  mode = "organization",
  onOrgSelect,
  createTeamHref,
}: TeamSwitcherProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Extract org slug from pathname (e.g., /someteam/... -> someteam)
  const currentOrgSlug = (() => {
    if (mode === "account") {
      return null;
    }
    const pathParts = pathname.split("/").filter(Boolean);
    const reservedRoutes = ["new", "account", "api", "sign-in", "sign-up"];
    if (pathParts[0] && !reservedRoutes.includes(pathParts[0])) {
      return pathParts[0];
    }
    return null;
  })();

  const currentOrg = currentOrgSlug
    ? organizations.find((org) => org.slug === currentOrgSlug)
    : null;

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const displayText =
    mode === "account" ? "My Account" : (currentOrg?.name ?? "Select team");
  const displayInitials =
    mode === "account" ? "MA" : currentOrg ? getInitials(currentOrg.name) : "?";

  return (
    <DropdownMenu onOpenChange={setOpen} open={open}>
      <div className="flex items-center gap-1">
        {mode === "organization" && currentOrg ? (
          <TeamSwitcherLink
            className="flex min-w-0 items-center gap-2"
            href={`/${currentOrg.slug}`}
            onNavigate={() => onOrgSelect(currentOrg.id, currentOrg.slug ?? "")}
          >
            <Avatar className="size-6">
              <AvatarFallback className="bg-foreground text-[10px] text-background">
                {displayInitials}
              </AvatarFallback>
            </Avatar>
            <span className="truncate font-medium text-sm">{displayText}</span>
          </TeamSwitcherLink>
        ) : (
          <div className="flex min-w-0 items-center gap-2">
            <Avatar className="size-6">
              <AvatarFallback className="bg-foreground text-[10px] text-background">
                {displayInitials}
              </AvatarFallback>
            </Avatar>
            <span className="truncate font-medium text-sm">{displayText}</span>
          </div>
        )}

        <DropdownMenuTrigger asChild>
          <Button className="h-8 w-8 p-0" size="sm" variant="ghost">
            <ChevronsUpDown className="h-4 w-4 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
      </div>
      <DropdownMenuContent align="start" className="w-[280px] space-y-1">
        <div className="px-2 py-1.5">
          <p className="font-medium text-muted-foreground text-xs">Teams</p>
        </div>
        {organizations.map((org) => {
          const isSelected =
            mode === "organization" && currentOrg?.id === org.id;

          return (
            <DropdownMenuItem asChild className="p-0" key={org.id}>
              <TeamSwitcherLink
                className={cn(
                  "flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 hover:bg-accent focus:bg-accent",
                  isSelected && "bg-muted/50"
                )}
                href={`/${org.slug}`}
                onClick={() => setOpen(false)}
                onNavigate={() => onOrgSelect(org.id, org.slug ?? "")}
              >
                <Avatar className="h-5 w-5 shrink-0">
                  <AvatarFallback className="bg-foreground text-[10px] text-background">
                    {getInitials(org.name)}
                  </AvatarFallback>
                </Avatar>
                <span className="flex-1 truncate text-left">{org.name}</span>
                {isSelected && (
                  <Check className="h-4 w-4 shrink-0 text-foreground" />
                )}
              </TeamSwitcherLink>
            </DropdownMenuItem>
          );
        })}

        <DropdownMenuItem asChild className="p-0">
          <Link
            className="flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-muted-foreground hover:bg-accent hover:text-foreground focus:bg-accent"
            href={createTeamHref}
            prefetch={true}
          >
            <div className="flex h-5 w-5 items-center justify-center rounded-full border border-muted-foreground/50 border-dashed">
              <Plus className="h-3 w-3" />
            </div>
            <span>Create Team</span>
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

#### 4. UserMenu (props-only)
**File**: `packages/app-header/src/user-menu.tsx`

Refactored from `apps/console/src/components/user-dropdown-menu.tsx`. Key changes:
- Remove `@vendor/clerk/client` imports (`useClerk`, `useUser`)
- Accept `email`, `initials`, `settingsHref`, `onSignOut` as props
- Remove loading/null states — consuming app handles those before rendering
- Rename from `UserDropdownMenu` → `UserMenu`

```tsx
"use client";

import { Avatar, AvatarFallback } from "@repo/ui/components/ui/avatar";
import { Button } from "@repo/ui/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/components/ui/dropdown-menu";
import { Settings } from "lucide-react";
import Link from "next/link";

interface UserMenuProps {
  /** User's display email */
  email: string;
  /** 1-2 character initials for avatar */
  initials: string;
  /** Href for settings link (e.g., "/account/settings/general") */
  settingsHref: string;
  /** Called when user clicks "Sign out" */
  onSignOut: () => void;
  className?: string;
}

export type { UserMenuProps };

export function UserMenu({
  email,
  initials,
  settingsHref,
  onSignOut,
  className,
}: UserMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          className={`size-8 rounded-full p-0 ${className ?? ""}`}
          variant="ghost"
        >
          <Avatar className="size-6">
            <AvatarFallback className="bg-foreground text-[10px] text-background">
              {initials}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <div className="px-2 py-1.5">
          <p className="text-muted-foreground text-sm">{email || "User"}</p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link className="cursor-pointer" href={settingsHref} prefetch={true}>
            <Settings className="mr-2 h-3 w-3" />
            Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="cursor-pointer text-sm"
          onClick={onSignOut}
        >
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

#### 5. Install dependencies

```bash
pnpm install
```

### Success Criteria:

#### Automated Verification:
- [x] `pnpm install` completes without errors
- [x] Package resolves: `ls packages/app-header/src/` shows 3 `.tsx` files
- [x] Type checking passes: `pnpm --filter @repo/app-header typecheck`

#### Manual Verification:
- [ ] Review the component interfaces — confirm they're truly vendor-free

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 2.

---

## Phase 2: Migrate Console App

### Overview
Update `apps/console` to import from `@repo/app-header` instead of local components. Create thin wrapper functions that bridge tRPC/Clerk data into the shared component props.

### Changes Required:

#### 1. Add `@repo/app-header` dependency
**File**: `apps/console/package.json`
**Changes**: Add `"@repo/app-header": "workspace:*"` to `dependencies`

#### 2. Rewrite `user-page-header.tsx`
**File**: `apps/console/src/components/user-page-header.tsx`
**Changes**: Import from `@repo/app-header`, fetch org data via tRPC, pass Clerk callbacks as props.

```tsx
"use client";

import { TeamSwitcher } from "@repo/app-header/team-switcher";
import { UserMenu } from "@repo/app-header/user-menu";
import { useTRPC } from "@repo/console-trpc/react";
import { NotificationsTrigger } from "@vendor/knock/components/trigger";
import { useClerk, useOrganizationList, useUser } from "@vendor/clerk/client";
import { useSuspenseQuery } from "@tanstack/react-query";

export function UserPageHeader() {
  const trpc = useTRPC();
  const { signOut } = useClerk();
  const { user, isLoaded } = useUser();
  const { setActive } = useOrganizationList();

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

  const email =
    user?.primaryEmailAddress?.emailAddress ??
    user?.emailAddresses[0]?.emailAddress ??
    user?.username ??
    "";

  const initials = (() => {
    if (!user) return "LF";
    const { firstName, lastName, username } = user;
    if (firstName && lastName) return `${firstName[0]}${lastName[0]}`.toUpperCase();
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
        {isLoaded && user && (
          <UserMenu
            email={email}
            initials={initials}
            onSignOut={() => void signOut()}
            settingsHref="/account/settings/general"
          />
        )}
      </div>
    </div>
  );
}
```

#### 3. Rewrite `app-sidebar.tsx` TeamSwitcher usage
**File**: `apps/console/src/components/app-sidebar.tsx`
**Changes**: Import `TeamSwitcher` from `@repo/app-header/team-switcher`, add tRPC query and Clerk `setActive` callback.

Replace the import and add data fetching:
```tsx
// Replace:
import { TeamSwitcher } from "./team-switcher";

// With:
import { TeamSwitcher } from "@repo/app-header/team-switcher";
import { useTRPC } from "@repo/console-trpc/react";
import { useOrganizationList } from "@vendor/clerk/client";
import { useSuspenseQuery } from "@tanstack/react-query";
```

Inside `AppSidebar()`, add data fetching before the return:
```tsx
const trpc = useTRPC();
const { setActive } = useOrganizationList();

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
```

Update the JSX from:
```tsx
<TeamSwitcher mode={mode} />
```
to:
```tsx
<TeamSwitcher
  createTeamHref="/account/teams/new"
  mode={mode}
  onOrgSelect={handleOrgSelect}
  organizations={organizations}
/>
```

#### 4. Update `workspace-switcher.tsx` TeamSwitcherLink import
**File**: `apps/console/src/components/workspace-switcher.tsx`
**Changes**: Update `TeamSwitcherLink` import and adapt to new `href`-based API.

Replace the import:
```tsx
// Replace:
import { TeamSwitcherLink } from "./team-switcher-link";

// With:
import { TeamSwitcherLink } from "@repo/app-header/team-switcher-link";
import { useOrganizationList } from "@vendor/clerk/client";
```

Add `setActive` hook inside `WorkspaceSwitcher()`:
```tsx
const { setActive } = useOrganizationList();
```

Update the TeamSwitcherLink usages at lines 71-80 (current workspace label):
```tsx
// Before:
<TeamSwitcherLink
  className="flex min-w-0 items-center"
  orgId={currentOrg.id}
  orgSlug={currentOrg.slug}
  workspaceName={currentWorkspace.name}
>

// After:
<TeamSwitcherLink
  className="flex min-w-0 items-center"
  href={`/${currentOrg.slug}/${currentWorkspace.name}`}
  onNavigate={async () => {
    if (setActive) await setActive({ organization: currentOrg.id });
  }}
>
```

Update at lines 110-126 (dropdown list items):
```tsx
// Before:
<TeamSwitcherLink
  className={cn(...)}
  onSwitch={() => setOpen(false)}
  orgId={currentOrg.id}
  orgSlug={currentOrg.slug}
  workspaceName={workspace.name}
>

// After:
<TeamSwitcherLink
  className={cn(...)}
  href={`/${currentOrg.slug}/${workspace.name}`}
  onClick={() => setOpen(false)}
  onNavigate={async () => {
    if (setActive) await setActive({ organization: currentOrg.id });
  }}
>
```

#### 5. Delete old console-local copies
**Files to delete**:
- `apps/console/src/components/team-switcher.tsx`
- `apps/console/src/components/team-switcher-link.tsx`
- `apps/console/src/components/user-dropdown-menu.tsx`

#### 6. Install dependencies

```bash
pnpm install
```

### Success Criteria:

#### Automated Verification:
- [x] No dangling imports: `pnpm --filter @lightfast/console typecheck`
- [ ] Console builds: `pnpm build:console`
- [ ] Linting passes: `pnpm check`

#### Manual Verification:
- [ ] Console team switcher dropdown works — shows all orgs, switching navigates correctly
- [ ] Console sidebar team switcher works in org mode
- [ ] Console user dropdown menu shows email, initials, sign out works
- [ ] Console workspace switcher still works (navigate between workspaces)
- [ ] Console notifications bell still appears in user page header

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Integrate Auth App

### Overview
Add `@repo/app-header` to the auth app. Create a new `(user)` route group with a layout that uses the shared header components. Wire up Clerk hooks for data.

### Changes Required:

#### 1. Add `@repo/app-header` dependency
**File**: `apps/auth/package.json`
**Changes**: Add `"@repo/app-header": "workspace:*"` to `dependencies`

#### 2. Create user page header for auth
**File**: `apps/auth/src/app/(app)/(user)/_components/user-page-header.tsx`

```tsx
"use client";

import { TeamSwitcher } from "@repo/app-header/team-switcher";
import { UserMenu } from "@repo/app-header/user-menu";
import { useClerk, useOrganizationList, useUser } from "@vendor/clerk/client";

export function UserPageHeader() {
  const { signOut } = useClerk();
  const { user, isLoaded } = useUser();
  const { setActive, userMemberships } = useOrganizationList({
    userMemberships: { infinite: true },
  });

  const organizations = (userMemberships.data ?? []).map((m) => ({
    id: m.organization.id,
    slug: m.organization.slug,
    name: m.organization.name,
  }));

  const handleOrgSelect = async (orgId: string) => {
    if (setActive) {
      await setActive({ organization: orgId });
    }
  };

  const email =
    user?.primaryEmailAddress?.emailAddress ??
    user?.emailAddresses[0]?.emailAddress ??
    user?.username ??
    "";

  const initials = (() => {
    if (!user) return "LF";
    const { firstName, lastName, username } = user;
    if (firstName && lastName) return `${firstName[0]}${lastName[0]}`.toUpperCase();
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
        {isLoaded && user && (
          <UserMenu
            email={email}
            initials={initials}
            onSignOut={() => void signOut()}
            settingsHref="/account/settings/general"
          />
        )}
      </div>
    </div>
  );
}
```

#### 3. Create `(user)` route group layout
**File**: `apps/auth/src/app/(app)/(user)/layout.tsx`

```tsx
import type React from "react";
import { UserPageHeader } from "./_components/user-page-header";

export default function UserLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <UserPageHeader />
      <main className="flex flex-1 items-center justify-center p-4">
        {children}
      </main>
    </div>
  );
}
```

#### 4. Create placeholder page (optional — needed for build verification)
**File**: `apps/auth/src/app/(app)/(user)/page.tsx`

This is a placeholder to verify the route group and layout work. It can be replaced with real content later.

```tsx
import { redirect } from "next/navigation";

export default function UserIndexPage() {
  // Redirect to console for now — this route group will host
  // future authenticated pages in the auth app
  redirect("/");
}
```

#### 5. Install dependencies

```bash
pnpm install
```

### Success Criteria:

#### Automated Verification:
- [x] No dangling imports: `pnpm --filter @lightfast/auth typecheck`
- [ ] Auth builds: `pnpm --filter @lightfast/auth build`
- [ ] Package types resolve: verify `@repo/app-header` imports work

#### Manual Verification:
- [ ] Auth app still works — sign-in/sign-up flows unaffected
- [ ] The `(user)` layout renders the shared header when accessed
- [ ] Team switcher shows orgs from Clerk in auth app
- [ ] User menu shows email/initials and sign out works in auth app
- [ ] The existing `(auth)` layout (sign-in/sign-up) and `(early-access)` page are unaffected

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: Cleanup & Final Verification

### Overview
Remove any unused imports/types from the console app, ensure no stale references remain, and run full verification across both apps.

### Changes Required:

#### 1. Check for stale references
Search for any remaining imports from the deleted files:
```bash
grep -r "from \"~/components/team-switcher\"" apps/console/src/
grep -r "from \"~/components/user-dropdown-menu\"" apps/console/src/
grep -r "from \"./team-switcher-link\"" apps/console/src/
grep -r "from \"./team-switcher\"" apps/console/src/
```

All should return empty. If any remain, update them.

#### 2. Check `apps/console/src/types/index.ts`
The `Organization` type at line 82-83 derives from `RouterOutputs`. This is still valid (used elsewhere in console). No changes needed — the shared package defines its own minimal `Organization` interface.

### Success Criteria:

#### Automated Verification:
- [ ] Full type check passes: `pnpm typecheck`
- [ ] Linting passes: `pnpm check`
- [ ] Console builds: `pnpm build:console`
- [ ] Auth builds: `pnpm --filter @lightfast/auth build`
- [ ] No stale references to deleted files

#### Manual Verification:
- [ ] Console: full app walkthrough — sidebar team switcher, user page header, workspace switcher, notifications
- [ ] Auth: sign-in/sign-up flows work, `(user)` route renders shared header
- [ ] Org switching works end-to-end in both apps (Clerk cookies update, navigation succeeds)

---

## Testing Strategy

### Unit Tests:
- No new unit tests required for this refactor — it's a structural extraction with no behavior change
- Existing console tests should continue to pass

### Integration Tests:
- Console E2E tests (if any cover team/workspace switching) should pass unchanged
- Auth E2E tests should pass unchanged (sign-in/sign-up flows)

### Manual Testing Steps:
1. Start dev servers: `pnpm dev:app`
2. Console: Navigate to org page, verify sidebar team switcher shows orgs and switches correctly
3. Console: Navigate to account page, verify user page header shows "My Account" team switcher + notifications + user menu
4. Console: Navigate to workspace, verify workspace switcher still works
5. Console: Click user menu → Settings navigates correctly, Sign out works
6. Auth: Access the `(user)` route, verify shared header renders with team switcher and user menu
7. Auth: Sign-in/sign-up pages still use their own inline header (unaffected)

## Performance Considerations

- No performance impact — the tRPC query in console is still prefetched at `AppLayout` level and resolves from React Query cache
- Auth uses Clerk's `useOrganizationList` which is populated from the session — no additional network request
- Bundle size: the shared package adds no new dependencies that aren't already in both apps

## References

- Prior research: `thoughts/shared/research/2026-03-09-team-switcher-standalone-refactor.md`
- Console app layout (prefetch): `apps/console/src/app/(app)/layout.tsx:13`
- Auth app root layout (Clerk provider): `apps/auth/src/app/layout.tsx:85-100`
- Package pattern reference: `packages/ui/package.json`
- Organization tRPC procedure: `api/console/src/router/user/organization.ts:22-44`
