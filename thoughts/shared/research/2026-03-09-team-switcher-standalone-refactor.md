---
date: 2026-03-09T00:00:00+00:00
researcher: claude
git_commit: 7c481b0c7b29815e6c667b3c122a94b7ed0c776e
branch: refactor/move-early-access-to-auth
repository: lightfast
topic: "TeamSwitcher standalone refactor - remove tRPC dependency, pass orgs from parent"
tags: [research, codebase, team-switcher, trpc, refactor, console]
status: complete
last_updated: 2026-03-09
---

# Research: TeamSwitcher Standalone Refactor

**Date**: 2026-03-09
**Git Commit**: `7c481b0c7b29815e6c667b3c122a94b7ed0c776e`
**Branch**: `refactor/move-early-access-to-auth`

## Research Question

How can `apps/console/src/components/team-switcher.tsx` be made more standalone so it does not depend on tRPC directly — either by accepting organizations as props or by adding a data-fetching wrapper?

---

## Summary

`TeamSwitcher` currently calls `useSuspenseQuery(trpc.organization.listUserOrganizations)` internally. The data is already prefetched at the RSC `AppLayout` level and lands in the React Query cache before either consumer (`AppSidebar`, `UserPageHeader`) renders. Extracting the `useSuspenseQuery` call to the parent components would be a pure refactor: no additional network requests, no changed behavior.

Three viable approaches exist, ranging from minimal to complete separation of concerns.

---

## Detailed Findings

### Current Shape of TeamSwitcher

`apps/console/src/components/team-switcher.tsx`

- **Props**: `mode?: "organization" | "account"` (line 28)
- **Internal tRPC call**: `useSuspenseQuery(trpc.organization.listUserOrganizations.queryOptions())` (line 37-42)
- **Cache config**: `staleTime: 5min`, `refetchOnMount: false`, `refetchOnWindowFocus: false`
- **Derived state**: `currentOrgSlug` from URL via `usePathname()` (line 46-57), `currentOrg` by matching slug to fetched org list (line 60-62)
- **Render**: Avatar + name in trigger, dropdown list of all orgs via `TeamSwitcherLink`, "Create Team" link at bottom

The org data type returned by `listUserOrganizations` (one element):
```ts
{
  id: string;
  slug: string | null;
  name: string;
  role: string;
  imageUrl: string;
}
```
Convenience type alias at `apps/console/src/types/index.ts:83`:
`RouterOutputs["organization"]["listUserOrganizations"][number]`

### Where the Data Is Already Prefetched

`apps/console/src/app/(app)/layout.tsx:13`
```ts
prefetch(userTrpc.organization.listUserOrganizations.queryOptions());
```
This RSC layout wraps every authenticated page. It pre-seeds the React Query cache before the client tree hydrates. Both consumers of `TeamSwitcher` are nested under this layout, so the `useSuspenseQuery` inside `TeamSwitcher` always resolves from cache — no waterfall.

### Consumer 1: AppSidebar

`apps/console/src/components/app-sidebar.tsx:149`
```tsx
<TeamSwitcher mode={mode} />
```
`AppSidebar` is a client component. It derives `mode` from `usePathname()` (line 135-138). It does not interact with organizations itself — it fully delegates to `TeamSwitcher`. It is used in the org-level sidebar.

### Consumer 2: UserPageHeader

`apps/console/src/components/user-page-header.tsx:10`
```tsx
<TeamSwitcher mode="account" />
```
`UserPageHeader` is a client component. It does nothing with org data — it just renders `TeamSwitcher` in "account" mode (meaning the dropdown shows all orgs but the trigger says "My Account").

### TeamSwitcherLink (no change needed)

`apps/console/src/components/team-switcher-link.tsx`
This child component is already standalone — it accepts `orgId`, `orgSlug`, `workspaceName?`, `className?`, `onSwitch?` as props and uses only Clerk's `useOrganizationList` and Next.js router. It has no tRPC dependency.

### WorkspaceSwitcher (comparison pattern)

`apps/console/src/components/workspace-switcher.tsx`
Also calls `listUserOrganizations` internally (line 31-36), in addition to a workspace list query. Follows the same embedded-fetch pattern as `TeamSwitcher`. Not in scope for this refactor but shares the same architectural shape.

---

## Refactor Options

### Option A: Split into UI + Wrapper (recommended for full isolation)

Create two components:

**`TeamSwitcherUI`** (presentation only):
```ts
interface TeamSwitcherUIProps {
  organizations: Array<{ id: string; slug: string | null; name: string }>;
  mode?: "organization" | "account";
}
```
- Accepts `organizations` as a prop
- Derives `currentOrgSlug` from `usePathname()` internally (this is fine — URL is a UI concern)
- All rendering logic stays identical

**`TeamSwitcher`** (data wrapper, backward compatible):
```tsx
export function TeamSwitcher({ mode = "organization" }: TeamSwitcherProps) {
  const trpc = useTRPC();
  const { data: organizations = [] } = useSuspenseQuery({
    ...trpc.organization.listUserOrganizations.queryOptions(),
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000,
  });
  return <TeamSwitcherUI organizations={organizations} mode={mode} />;
}
```

Both `AppSidebar` and `UserPageHeader` continue to use `<TeamSwitcher />` with no changes. New use cases that already have org data can use `<TeamSwitcherUI />` directly.

### Option B: Add `organizations` as optional prop

Modify `TeamSwitcher` to accept `organizations` as an optional prop. If provided, skip the tRPC call; if not, fetch internally.

```ts
interface TeamSwitcherProps {
  mode?: TeamSwitcherMode;
  organizations?: Array<{ id: string; slug: string | null; name: string }>;
}
```

Simpler but introduces conditional data-fetching logic in one component.

### Option C: Lift data fetch to parent components

Move the `useSuspenseQuery` call into `AppSidebar` and `UserPageHeader`, and pass `organizations` down:

```tsx
// AppSidebar (modified)
const { data: organizations = [] } = useSuspenseQuery({
  ...trpc.organization.listUserOrganizations.queryOptions(),
  ...cacheConfig,
});
// ...
<TeamSwitcher mode={mode} organizations={organizations} />
```

Since the data is already in cache from `AppLayout`'s prefetch, there is no perf difference. This is the most minimal change if the goal is simply to make `TeamSwitcher`'s rendering logic testable in isolation without mocking tRPC.

---

## Code References

- `apps/console/src/components/team-switcher.tsx:37-42` — `useSuspenseQuery` call
- `apps/console/src/components/team-switcher.tsx:60-62` — `currentOrg` derived from fetched list
- `apps/console/src/components/team-switcher-link.tsx` — already props-based, no tRPC
- `apps/console/src/components/app-sidebar.tsx:149` — consumer 1
- `apps/console/src/components/user-page-header.tsx:10` — consumer 2
- `apps/console/src/app/(app)/layout.tsx:13` — top-level prefetch (RSC)
- `apps/console/src/types/index.ts:83` — `RouterOutputs["organization"]["listUserOrganizations"][number]` type alias
- `api/console/src/router/user/organization.ts:22-44` — tRPC procedure definition

## Architecture Documentation

The current pattern (embedded `useSuspenseQuery` in leaf UI components) is consistent with how `WorkspaceSwitcher` is structured. Both components rely on the RSC `AppLayout` prefetch to ensure the React Query cache is warm before they render, avoiding any loading state. The `TeamSwitcherLink` child is already standalone (props-only). Separating the presentation layer from the data-fetching layer in `TeamSwitcher` would align it more closely with a container/presentational split without changing any runtime behavior.

## Open Questions

- Should `WorkspaceSwitcher` follow the same refactor once `TeamSwitcher` is updated?
- If `TeamSwitcherUI` is created, should it live in `@repo/ui` or stay in the console app?
