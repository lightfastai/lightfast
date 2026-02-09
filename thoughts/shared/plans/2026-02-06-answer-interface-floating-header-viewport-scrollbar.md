# Answer Interface Floating Header & Viewport Scrollbar Implementation Plan

## Overview

Fix two layout bugs in the answer interface:
1. **Floating header**: The header should overlay the content at full-viewport height, not consume space in the layout
2. **Viewport-edge scrollbar**: The scrollbar should appear at the right edge of the viewport, not in the middle of the page

These fixes apply **only to the answer interface page** (`/[slug]/[workspaceName]`), not globally to all org pages.

## Current State Analysis

### Bug 1: Scrollbar in Middle of Page
**Root cause**: The scroll container is constrained to `max-w-7xl` (1280px) and centered with `mx-auto`. The `Conversation` component's `overflow-y-auto` scrollbar renders at the right edge of this constrained container, appearing in the middle on wide viewports.

**Current layout chain** (`[slug]/layout.tsx:63-64`):
```
SidebarInset (flex-1, flex-col, relative)
  └─ content wrapper (flex-1, h-full, min-h-0, overflow-auto)
      └─ max-w-7xl container (max-w-7xl, mx-auto, px-4)
          └─ children
              └─ Conversation (overflow-y-auto)  ← scrollbar here
```

### Bug 2: Header Consumes Vertical Space
**Root cause**: The `h-14` header is a static flex child in `SidebarInset`, consuming 56px before the content wrapper gets its height.

**Current structure** (`[slug]/layout.tsx:58-69`):
```tsx
<SidebarInset>
  <div className="h-14 flex items-center px-4 bg-background">
    <AppHeader />
  </div>
  <div className="flex flex-col flex-1 h-full min-h-0 overflow-auto">
    {/* content */}
  </div>
</SidebarInset>
```

The answer interface gets `100vh - 56px` available height, not full `100vh`.

## Desired End State

### On Answer Page Only (`/[slug]/[workspaceName]`)

1. **Header floats** absolutely over the content area, sitting at the top with `z-index` above content
2. **Content spans full height** from 0vh to 100vh of the viewport
3. **Scrollbar appears at viewport edge** — the scroll container spans the full `SidebarInset` width, so the `Conversation` component's scrollbar sits at the right edge
4. **Header remains readable** — backdrop blur or semi-transparent background so text doesn't get lost over scrolling content
5. **Other org pages unaffected** — static header behavior unchanged on search pages, settings, etc.

### Verification

- Answer interface fills entire viewport height (0vh to 100vh)
- Scrollbar appears at the right edge of the visible viewport (or at `SidebarInset` right edge)
- Header is readable over content as user scrolls
- Search page and other org routes still display with static header (56px consumed)

## What We're NOT Doing

- Changing the org layout globally — only the answer page route gets special handling
- Removing the `max-w-7xl` constraint from content width — keeping it for visual centering, just not for scroll container width
- Changing the sidebar or root app layout structure
- Modifying the header component itself — reusing `AppHeader` in both contexts

## Implementation Approach

**Strategy**: Use conditional rendering in `[slug]/layout.tsx` to detect when rendering the answer page and apply a different layout structure. This avoids global changes and keeps all special handling localized to the answer page context.

The key insight is that the answer page route has both `slug` and the children rendered from `[workspaceName]/page.tsx`. We can render different structures based on this context:
- **Answer page route**: Floating header + full-height content + full-width scroll container
- **Other routes**: Static header + content below + max-w-7xl scroll container

---

## Phase 1: Add Conditional Answer Page Layout in Org Layout

### Overview

Modify `[slug]/layout.tsx` to detect when it's rendering the answer interface page and use a special layout with floating header. For other routes, keep the current static header layout.

### Changes Required

#### File: `apps/console/src/app/(app)/(org)/[slug]/layout.tsx`

**Key change**: Wrap the answer page's children to provide a floating header layout instead of static header layout.

```tsx
// Add a wrapper component for the answer page that handles floating header
const AnswerPageLayout = ({ children }: { children: React.ReactNode }) => (
  <div className="relative flex flex-col h-full w-full min-h-0 flex-1">
    {/* Floating header absolutely positioned over content */}
    <div className="absolute top-0 left-0 right-0 h-14 flex items-center px-4 bg-background/80 backdrop-blur-sm z-40 border-b border-border/50">
      <AppHeader />
    </div>

    {/* Content spans full height, scrollbar at viewport edge */}
    <div className="flex flex-col flex-1 h-full min-h-0 overflow-auto pt-14">
      {/* Remove max-w-7xl constraint on scroll container, only apply to inner content */}
      <div className="flex flex-col flex-1 h-full min-h-0 w-full">
        {children}
      </div>
    </div>
  </div>
);

// Standard org layout with static header (for non-answer pages)
const StandardOrgLayout = ({ children }: { children: React.ReactNode }) => (
  <SidebarInset>
    <div className="h-14 flex items-center px-4 bg-background">
      <AppHeader />
    </div>
    <div className="flex flex-col flex-1 h-full min-h-0 overflow-auto">
      <div className="flex flex-col flex-1 h-full min-h-0 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {children}
      </div>
    </div>
  </SidebarInset>
);

export default async function OrgLayout({ children, params }: OrgLayoutProps) {
  const { slug } = await params;

  // ... existing org access check ...

  return (
    <HydrateClient>
      <OrgPageErrorBoundary orgSlug={slug}>
        <SidebarProvider className="h-full min-h-0">
          <AppSidebar />
          {/* Check if children indicates this is an answer page (nested in [workspaceName]) */}
          {/* For now, use AnswerPageLayout as default - will refine detection if needed */}
          <AnswerPageLayout>{children}</AnswerPageLayout>
        </SidebarProvider>
      </OrgPageErrorBoundary>
    </HydrateClient>
  );
}
```

**Key styling details:**
- `bg-background/80 backdrop-blur-sm` — Semi-transparent background with blur for readability
- `z-40` — Sits above content (content is z-0 by default)
- `border-b border-border/50` — Subtle separator line below header
- `pt-14` — Padding-top on content to account for floating header height
- Removed `max-w-7xl mx-auto` from scroll container wrapper — let it span full width
- Content inside still needs `max-w-7xl` centering if desired (handled by AnswerInterface or AskLightfast)

**Consideration**: Right now this applies AnswerPageLayout globally. We need to detect if it's actually the answer page route. Option A: Check if children is from `[workspaceName]` (requires prop drilling). Option B: Use a Context/Context provider to signal this. Option C: Keep it simple and test visually, refining detection if other routes break.

### Success Criteria

#### Automated Verification
- [ ] TypeScript compiles without errors: `pnpm typecheck`
- [ ] No linting issues: `pnpm lint`
- [ ] Layout accepts children without breaking React constraints

#### Manual Verification
- [ ] Answer interface page loads without errors
- [ ] Header displays floating over content area
- [ ] Header text is readable (backdrop blur sufficient) while scrolling
- [ ] Scrollbar position check — appears at viewport right edge or SidebarInset right edge
- [ ] Search page (if accessible) still displays with static header (verify no layout regression)
- [ ] Header height is still 56px (h-14)

**Implementation Note**: After this phase completes and manual verification succeeds with visual inspection, pause here before Phase 2. The scrollbar position may already be at the viewport edge once the scroll container is full-width, or Phase 2 adjustments may be needed.

---

## Phase 2: Optimize Scroll Container & Content Layout

### Overview

Ensure the answer interface and its content width constraints don't interfere with the scrollbar position. Verify the scrollbar sits at the correct viewport edge.

### Changes Required

#### File: `apps/console/src/components/answer-interface.tsx`

**Current empty state** (line 88):
```tsx
<div className="h-full flex flex-col items-center justify-center bg-background">
  <div className="w-full max-w-3xl px-1.5 md:px-3 lg:px-6 xl:px-10">
    {/* content */}
  </div>
</div>
```

**Current conversation view** (line 117):
```tsx
<div className="flex flex-col h-full bg-background pb-4">
  <AnswerMessages messages={messages} status={status} />
  <div className="relative">
    <div className="max-w-3xl mx-auto px-1.5 md:px-3 lg:px-6 xl:px-10">
      {/* input area */}
    </div>
  </div>
</div>
```

These already use `max-w-3xl` (768px), which is narrower than the scroll container. The scrollbar should have room to sit at the right edge.

**If scrollbar is still not at viewport edge**, apply these changes:

```tsx
// Wrapper that spans full width for scroll context
<div className="flex flex-col h-full bg-background w-full">

  // Messages area - full width, content inside is constrained
  <AnswerMessages messages={messages} status={status} />

  // Input area - full width, content inside is constrained
  <div className="relative w-full">
    <div className="max-w-3xl mx-auto px-1.5 md:px-3 lg:px-6 xl:px-10">
      {/* input area */}
    </div>
  </div>
</div>
```

Ensure outer divs are `w-full` so they don't constrain the scroll container.

### Success Criteria

#### Automated Verification
- [ ] TypeScript compiles: `pnpm typecheck`
- [ ] Linting passes: `pnpm lint`
- [ ] No console errors when viewing answer interface

#### Manual Verification
- [ ] Scrollbar appears at the right edge of the viewport (or `SidebarInset` edge, depending on inset variant)
- [ ] Content is still centered within `max-w-3xl` constraints
- [ ] Messages and input area are readable and properly aligned
- [ ] Scrolling behavior is smooth with no jank
- [ ] On narrow viewports (mobile), layout still works correctly

**Implementation Note**: After completing both phases, visual testing is critical. The user will provide feedback on scrollbar position and header visibility. Based on that feedback, we may need minor adjustments to `z-index`, blur amounts, or width constraints.

---

## Testing Strategy

### Manual Testing Steps

1. **Navigate to answer interface page**
   - Go to `/[org-slug]/[workspace-name]`
   - Should load with floating header

2. **Verify floating header**
   - Header visible at top of viewport
   - Text readable (backdrop blur is sufficient)
   - Header doesn't disappear when scrolling

3. **Verify scrollbar position**
   - Open browser DevTools
   - Inspect the scrollbar element
   - Check if it's at `SidebarInset` right edge or viewport right edge
   - Scrollbar should NOT be in the middle of the page

4. **Test interaction**
   - Send a message in the answer interface
   - Verify scrollbar appears and is positioned correctly
   - Scroll up to see previous messages
   - Use "scroll to bottom" button to verify scrolling works

5. **Regression testing** (if applicable)
   - Test any other org pages (search, settings, etc.)
   - Verify they still display with static header (56px consumed at top)
   - Ensure sidebar and layout are unaffected

## Edge Cases & Considerations

1. **Very narrow viewports (mobile)**: The floating header may overlap content on mobile. This is acceptable for now — we can add responsive adjustments later if needed.

2. **Header visibility on dark backgrounds**: The `backdrop-blur-sm` and `bg-background/80` should be sufficient, but if text is still hard to read over dark content, we can increase the blur or opacity.

3. **Scrollbar styling**: The custom `scrollbar-thin` class is already applied to `Conversation`, so the scrollbar should match existing styling. No changes needed there.

4. **Z-index stacking**: Header is `z-40`, content is default (z-0). This should prevent any overlap issues. If other UI elements (modals, dropdowns) appear under the header, we can adjust z-index.

5. **SidebarInset inset variant**: On desktop, `SidebarInset` has `m-2 rounded-xl` applied from the inset variant. The scrollbar will sit at the right edge of this inset container, not the viewport. This is acceptable — the important fix is moving it from "middle of page" to "right edge of the content area."

## References

- Research document: `thoughts/shared/research/2026-02-06-answer-interface-layout-scroll-positioning.md`
- Org layout: `apps/console/src/app/(app)/(org)/[slug]/layout.tsx`
- Answer interface: `apps/console/src/components/answer-interface.tsx`
- Answer messages: `apps/console/src/components/answer-messages.tsx`
- SidebarInset: `packages/ui/src/components/ui/sidebar.tsx:316-328`
- Conversation component: `packages/ui/src/components/ai-elements/conversation.tsx:12-20`
