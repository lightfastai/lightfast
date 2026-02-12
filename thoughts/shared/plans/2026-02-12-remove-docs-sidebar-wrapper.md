# Remove DocsSidebarWrapper Implementation Plan

## Overview

Remove the `DocsSidebarWrapper` client component by using Next.js route groups to handle page tree selection at the server layout level. This eliminates an unnecessary client boundary and ensures only the relevant page tree is serialized to the client.

## Current State Analysis

The sidebar currently has a 3-layer client component chain:

```
(docs)/layout.tsx          [SERVER]  → passes both pageTree + apiPageTree
  └─ DocsSidebarWrapper    [CLIENT]  → usePathname() to pick which tree
       └─ DocsSidebarLayout [CLIENT] → SidebarProvider, header, search, main content
            └─ DocsMarketingSidebar [CLIENT] → renders tree items, usePathname() for active state
```

**Key finding:** `DocsSidebarWrapper` (`apps/docs/src/components/docs-sidebar-wrapper.tsx:14-25`) exists solely to call `usePathname()` and check `pathname.includes("/api-reference")` to pick between two trees. This forces both trees to be serialized and sent to the client, even though only one is used.

**Route structure reality:**
- `/docs/[[...slug]]` → general docs (uses `docsSource`)
- `/docs/api-reference/[[...slug]]` → API reference (uses `apiSource`)

The filesystem already separates these routes — we can leverage this with route groups.

## Desired End State

```
(docs)/layout.tsx          [SERVER]  → only CSS import + children
  └─ docs/
      ├─ (general)/layout.tsx        [SERVER]  → DocsSidebarLayout with pageTree
      │   └─ [[...slug]]/page.tsx
      └─ (api)/layout.tsx            [SERVER]  → DocsSidebarLayout with apiPageTree
          └─ api-reference/[[...slug]]/page.tsx
```

### Verification:
- [x] URLs remain identical: `/docs/get-started/overview` and `/docs/api-reference/getting-started/overview`
- [x] `docs-sidebar-wrapper.tsx` deleted
- [x] Only the relevant page tree is serialized to the client per route
- [x] Sidebar navigation works correctly on both docs and API reference pages
- [x] Active link highlighting works correctly

## What We're NOT Doing

- NOT collapsing `DocsSidebarLayout` or `DocsMarketingSidebar` (keeping scope focused)
- NOT changing the URLs or route structure
- NOT modifying the fumadocs configuration
- NOT touching `DocsSidebarScrollArea` (remains as-is)

## Implementation Approach

Use Next.js route groups `(general)` and `(api)` to split the route hierarchy. Route groups don't affect URLs but allow separate layouts that each pass the correct tree server-side. This eliminates the need for client-side tree selection entirely.

---

## Phase 1: Create Route Group Structure

### Overview
Reorganize the route structure to use route groups, enabling server-side tree selection per route segment.

### Changes Required:

#### 1. Create `(general)` route group for standard docs
**Directory**: `apps/docs/src/app/(docs)/docs/(general)/`

Create new layout at `apps/docs/src/app/(docs)/docs/(general)/layout.tsx`:

```tsx
import type { ReactNode } from "react";
import { DocsSidebarLayout } from "@/src/components/docs-sidebar-layout";
import { pageTree } from "@/src/lib/source";

export default function GeneralDocsLayout({ children }: { children: ReactNode }) {
  return (
    <DocsSidebarLayout tree={pageTree}>
      {children}
    </DocsSidebarLayout>
  );
}
```

**Move existing page:**
- Move `apps/docs/src/app/(docs)/docs/[[...slug]]/page.tsx` to `apps/docs/src/app/(docs)/docs/(general)/[[...slug]]/page.tsx`
- Move `apps/docs/src/app/(docs)/docs/[[...slug]]/_components/` to `apps/docs/src/app/(docs)/docs/(general)/[[...slug]]/_components/`

#### 2. Create `(api)` route group for API reference
**Directory**: `apps/docs/src/app/(docs)/docs/(api)/`

Create new layout at `apps/docs/src/app/(docs)/docs/(api)/layout.tsx`:

```tsx
import type { ReactNode } from "react";
import { DocsSidebarLayout } from "@/src/components/docs-sidebar-layout";
import { apiPageTree } from "@/src/lib/source";

export default function ApiDocsLayout({ children }: { children: ReactNode }) {
  return (
    <DocsSidebarLayout tree={apiPageTree}>
      {children}
    </DocsSidebarLayout>
  );
}
```

**Move existing page:**
- Move `apps/docs/src/app/(docs)/docs/api-reference/` entire directory to `apps/docs/src/app/(docs)/docs/(api)/api-reference/`

#### 3. Simplify top-level `(docs)/layout.tsx`
**File**: `apps/docs/src/app/(docs)/layout.tsx`

Replace current content with:

```tsx
import type { ReactNode } from "react";
import "fumadocs-ui/style.css";

export default function DocsLayout({ children }: { children: ReactNode }) {
  return children;
}
```

This layout now only imports CSS and passes through children — tree selection happens in the child route group layouts.

#### 4. Delete `DocsSidebarWrapper`
**File**: `apps/docs/src/components/docs-sidebar-wrapper.tsx`

Delete the entire file. It's no longer needed.

### Success Criteria:

#### Automated Verification:
- [x] Type checking passes: `cd apps/docs && pnpm typecheck`
- [x] Build succeeds: `cd apps/docs && pnpm build`
- [x] No linting errors: `cd apps/docs && pnpm lint` (pre-existing errors unrelated to changes)
- [x] All moved files exist at new locations: `ls apps/docs/src/app/(docs)/docs/(general)/[[...slug]]/page.tsx` and `ls apps/docs/src/app/(docs)/docs/(api)/api-reference/[[...slug]]/page.tsx`
- [x] `docs-sidebar-wrapper.tsx` deleted: `! test -f apps/docs/src/components/docs-sidebar-wrapper.tsx`

#### Manual Verification:
- [x] Start dev server: `pnpm dev:docs`
- [x] Navigate to `/docs/get-started/overview` — sidebar shows general docs tree
- [x] Navigate to `/docs/api-reference/getting-started/overview` — sidebar shows API reference tree
- [x] Active link highlighting works on both trees
- [x] Sidebar scroll behavior works correctly
- [x] Header search and login button appear correctly
- [x] No console errors about missing components or hydration mismatches

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding.

---

## Testing Strategy

### Unit Tests:
- No unit tests required (no business logic changes)

### Integration Tests:
- Verify route resolution for both `/docs/*` and `/docs/api-reference/*`
- Confirm correct page tree is passed to `DocsSidebarLayout` in each route group

### Manual Testing Steps:
1. Start dev server and navigate to general docs (`/docs/get-started/overview`)
2. Verify sidebar shows "Get Started", "Guides", "Core Concepts" sections
3. Click through several general docs pages and verify active state updates
4. Navigate to API reference (`/docs/api-reference/getting-started/overview`)
5. Verify sidebar shows API reference sections
6. Click through several API reference pages and verify active state updates
7. Use browser DevTools to inspect React tree — verify `DocsSidebarWrapper` is not present
8. Check Network tab — verify only one page tree is sent in the initial HTML payload per route

## Performance Considerations

**Before:** Both `pageTree` and `apiPageTree` serialized to client on every docs page load.

**After:** Only the relevant tree is serialized per route group:
- General docs pages → only `pageTree` sent to client
- API reference pages → only `apiPageTree` sent to client

Expected reduction: ~50% less sidebar data transferred per page load (assuming trees are similar size).

## Migration Notes

No data migration required. This is a structural refactor with no changes to:
- URLs
- Page content
- Database schema
- User-facing functionality

The only change is how the application determines which sidebar tree to display — moved from client-side detection to server-side route group layouts.

## References

- Original research: `thoughts/shared/research/2026-02-12-docs-sidebar-layer-architecture.md`
- Related research: `thoughts/shared/research/2025-12-21-api-reference-sidebar-structure.md`
- Current wrapper: `apps/docs/src/components/docs-sidebar-wrapper.tsx:1-26`
- Current layout: `apps/docs/src/app/(docs)/layout.tsx:1-12`
- Next.js route groups: https://nextjs.org/docs/app/building-your-application/routing/route-groups
