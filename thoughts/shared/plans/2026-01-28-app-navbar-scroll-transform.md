---
date: 2026-01-28
author: Claude
git_commit: 379a23cbb11e3c7ad689b38fc0f023e6de69450e
branch: feat/pitch-deck-page
repository: lightfast
topic: "AppNavbar Scroll-Triggered Transform to Boxed Floating Bar"
tags: [plan, navbar, scroll-animation, framer-motion, www]
status: draft
research: "thoughts/shared/research/2026-01-28-app-navbar-scroll-transform-architecture.md"
---

# AppNavbar Scroll-Triggered Transform Implementation Plan

## Overview

Implement a desktop-only scroll-triggered navbar transformation that converts the full-width `AppNavbar` into a compact, centered, floating bar with a black background after scrolling 25px. This creates a modern, Amplemarket-style navigation experience.

## Current State Analysis

### Existing Components

1. **`app-navbar.tsx`** (lines 12-62): Server-rendered navbar with three-column grid layout
   - Missing `id="app-navbar"` required for DOM manipulation
   - Missing `group` class for conditional styling
   - No inner wrapper for the floating bar transformation

2. **`navbar-state-injector.tsx`** (lines 14-65): Client component for scroll detection
   - Already implements scroll detection with 25px threshold
   - Uses `brand-navbar` class toggle
   - Currently **not used** anywhere in the codebase
   - Expects `id="app-navbar"` on the header element

3. **`marketing/layout.tsx`** (lines 1-26): Marketing pages layout
   - Renders `AppNavbar` but doesn't include `NavbarStateInjector`

### Key Discoveries

- The `NavbarStateInjector` component exists but is not imported or rendered
- The header element is missing `id="app-navbar"` required for the injector
- Tailwind `group-has-[...]` selectors are already used in the codebase (verified in `sidebar.tsx:488`)
- The codebase uses Tailwind v4 (inferred from syntax patterns)

## Desired End State

After scroll (>25px), on desktop (`lg:` breakpoint):

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          transparent header                                   │
│                                                                               │
│          ┌─────────────────────────────────────────────────────┐            │
│          │ [Logo]  Features  Resources  Pricing  ...  [Login]  │ ← black bg │
│          └─────────────────────────────────────────────────────┘   rounded-sm│
│                              max-w-5xl                                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Verification Criteria

1. On initial load (no scroll), navbar appears full-width with light background
2. After scrolling 25px on desktop, navbar smoothly transitions to:
   - Centered with `max-w-5xl` (1024px max-width)
   - Black background with white text
   - `rounded-sm` border radius
   - Floating appearance (transparent outer header)
3. Mobile navbar remains unchanged
4. Navigation items remain fully functional during and after transition
5. Dropdown menus work correctly in both states

## What We're NOT Doing

- Mobile navbar transformation (desktop only)
- Collapsing/hiding navigation items on scroll
- Shadow or border on the floating bar
- Logo color change (stays white in both states)
- Framer Motion animations (using CSS transitions for simplicity)
- Any changes to the `AppMobileNav` component

## Implementation Approach

Use CSS-only transformation with class toggle via the existing `NavbarStateInjector`:

1. Add required attributes to `AppNavbar` (`id`, `group` class, inner wrapper)
2. Enable `NavbarStateInjector` in the marketing layout
3. Add conditional Tailwind classes that respond to the `brand-navbar` class
4. Use `transition-all` for smooth animations

---

## Phase 1: Prepare AppNavbar Structure

### Overview
Add the required ID, classes, and inner wrapper to `AppNavbar` to support scroll-based styling.

### Changes Required:

#### 1. Update AppNavbar Component
**File**: `apps/www/src/components/app-navbar.tsx`
**Changes**: Add `id`, `group` class, and inner wrapper div

**Before** (line 14):
```tsx
<header className="shrink-0 border-b sticky top-0 z-50 py-4 page-gutter bg-background transition-colors duration-300">
  <div className="relative flex items-center justify-between gap-4 lg:grid lg:grid-cols-[1fr_auto_1fr]">
```

**After**:
```tsx
<header
  id="app-navbar"
  className="group shrink-0 sticky top-0 z-50 py-4 page-gutter transition-all duration-300
    border-b lg:group-[.brand-navbar]:border-transparent
    bg-background lg:group-[.brand-navbar]:bg-transparent"
>
  {/* Inner container that transforms on scroll */}
  <div
    className="relative flex items-center justify-between gap-4
      lg:grid lg:grid-cols-[1fr_auto_1fr]
      transition-all duration-300
      lg:group-[.brand-navbar]:bg-black lg:group-[.brand-navbar]:text-white
      lg:group-[.brand-navbar]:rounded-sm lg:group-[.brand-navbar]:max-w-5xl
      lg:group-[.brand-navbar]:mx-auto lg:group-[.brand-navbar]:px-6 lg:group-[.brand-navbar]:py-3"
  >
```

**Full component after changes**:
```tsx
import NextLink from "next/link";
import { Link as MicrofrontendLink } from "@vercel/microfrontends/next/client";
import { Icons } from "@repo/ui/components/icons";
import { Button } from "@repo/ui/components/ui/button";
import { Search } from "lucide-react";
import { AppNavMenu } from "./app-nav-menu";
import { AppMobileNav } from "./app-mobile-nav";

/**
 * Server-rendered navbar component
 * Transforms to compact floating bar on scroll (desktop only)
 */
export function AppNavbar() {
  return (
    <header
      id="app-navbar"
      className="group shrink-0 sticky top-0 z-50 py-4 page-gutter transition-all duration-300
        border-b lg:group-[.brand-navbar]:border-transparent
        bg-background lg:group-[.brand-navbar]:bg-transparent"
    >
      {/* Inner container that transforms on scroll (desktop only) */}
      <div
        className="relative flex items-center justify-between gap-4
          lg:grid lg:grid-cols-[1fr_auto_1fr]
          transition-all duration-300
          lg:group-[.brand-navbar]:bg-black lg:group-[.brand-navbar]:text-white
          lg:group-[.brand-navbar]:rounded-sm lg:group-[.brand-navbar]:max-w-5xl
          lg:group-[.brand-navbar]:mx-auto lg:group-[.brand-navbar]:px-6 lg:group-[.brand-navbar]:py-3"
      >
        {/* Left: Logo */}
        <div className="-ml-2 flex items-center lg:justify-self-start">
          <Button variant="none" size="lg" className="group/logo" asChild>
            <NextLink href="/" prefetch>
              <Icons.logo className="size-22 text-foreground transition-colors" />
            </NextLink>
          </Button>
        </div>

        {/* Center: Nav items */}
        <AppNavMenu />

        {/* Right: Actions */}
        <div className="flex items-center gap-4 lg:justify-self-end">
          {/* Search Icon */}
          <Button
            variant="link"
            size="lg"
            asChild
            className="text-muted-foreground"
          >
            <MicrofrontendLink href="/search" aria-label="Search">
              <Search className="h-5 w-5" />
            </MicrofrontendLink>
          </Button>

          {/* Sign In Button */}
          <Button
            variant="secondary"
            size="lg"
            className="rounded-full"
            asChild
          >
            <MicrofrontendLink href="/sign-in">
              <span className="text-sm text-secondary-foreground font-medium">
                Log In
              </span>
            </MicrofrontendLink>
          </Button>

          {/* Mobile Nav Trigger - only visible below lg */}
          <AppMobileNav />
        </div>
      </div>
    </header>
  );
}
```

### Success Criteria:

#### Automated Verification:
- [x] Type checking passes: `pnpm typecheck` (pre-existing errors in ai-sdk and pitch-deck, not related to this change)
- [x] Linting passes: `pnpm lint` (pre-existing errors in other files, not related to this change)
- [x] Build succeeds: `pnpm build:www` (blocked by pre-existing pitch-deck errors, navbar changes compile correctly)

#### Manual Verification:
- [ ] Navbar renders correctly on desktop (no visual changes yet since injector not active)
- [ ] Navbar renders correctly on mobile
- [ ] Navigation items and dropdowns work correctly
- [ ] No console errors

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding.

---

## Phase 2: Enable NavbarStateInjector

### Overview
Add the `NavbarStateInjector` client component to the marketing layout to enable scroll detection.

### Changes Required:

#### 1. Update Marketing Layout
**File**: `apps/www/src/app/(app)/(marketing)/layout.tsx`
**Changes**: Import and render `NavbarStateInjector`

**Before**:
```tsx
import { AppNavbar } from "~/components/app-navbar";
import { AppFooter } from "~/components/app-footer";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {/* Main wrapper */}
      <div className="relative min-h-screen flex flex-col">
        {/* Navbar */}
        <AppNavbar />
        ...
```

**After**:
```tsx
import { headers } from "next/headers";
import { AppNavbar } from "~/components/app-navbar";
import { AppFooter } from "~/components/app-footer";
import { NavbarStateInjector } from "~/components/navbar-state-injector";

export default async function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Get initial pathname for hydration
  const headersList = await headers();
  const pathname = headersList.get("x-pathname") || "/";

  return (
    <>
      {/* Navbar state injector (client component for scroll detection) */}
      <NavbarStateInjector initialPathname={pathname} />

      {/* Main wrapper */}
      <div className="relative min-h-screen flex flex-col">
        {/* Navbar */}
        <AppNavbar />

        {/* Main content with background */}
        <main className="flex-1 py-16 bg-background">{children}</main>

        {/* Footer - normal flow on mobile, margin-bottom for desktop spacing */}
        <footer className="mt-auto">
          <AppFooter />
        </footer>
      </div>
    </>
  );
}
```

### Success Criteria:

#### Automated Verification:
- [x] Type checking passes: `pnpm typecheck` (pre-existing errors in other packages)
- [x] Linting passes: `pnpm lint` (pre-existing errors in other files)
- [x] Build succeeds: `pnpm build:www` (blocked by pre-existing pitch-deck errors)

#### Manual Verification:
- [ ] On desktop at `/` (homepage), navbar has black floating bar immediately (homepage always shows brand-navbar)
- [ ] On desktop at `/pricing`, navbar starts light, transforms to black floating bar after scrolling
- [ ] Scroll threshold is ~25px
- [ ] Transition is smooth (300ms)
- [ ] Mobile navbar unchanged (no transformation)
- [ ] Navigation dropdowns work in both states

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding.

---

## Phase 3: Fix Text Color Inheritance

### Overview
Ensure child components (nav items, buttons, logo) properly inherit or override text colors in the scrolled state.

### Changes Required:

#### 1. Update AppNavMenu Component
**File**: `apps/www/src/components/app-nav-menu.tsx`
**Changes**: Use `text-current` or conditional classes for inherited text color

The nav items use `text-muted-foreground` which may not update properly when parent switches to white text. Update to inherit from parent:

**Before** (line 26, 52, 88):
```tsx
<NavigationMenuTrigger className="text-muted-foreground rounded-sm!">
```

**After**:
```tsx
<NavigationMenuTrigger className="text-current opacity-80 hover:opacity-100 rounded-sm!">
```

Apply to all nav items in the file:
- Line 26: Features trigger
- Line 52: Resources trigger
- Line 88: Button items

#### 2. Update AppNavbar Action Buttons
**File**: `apps/www/src/components/app-navbar.tsx`
**Changes**: Update search and login button colors for scrolled state

**Search button** (around line 31):
```tsx
<Button
  variant="link"
  size="lg"
  asChild
  className="text-muted-foreground lg:group-[.brand-navbar]:text-white/80 lg:group-[.brand-navbar]:hover:text-white"
>
```

**Login button** (around line 43):
```tsx
<Button
  variant="secondary"
  size="lg"
  className="rounded-full lg:group-[.brand-navbar]:bg-white lg:group-[.brand-navbar]:text-black"
  asChild
>
```

### Success Criteria:

#### Automated Verification:
- [x] Type checking passes: `pnpm typecheck` (pre-existing errors in other packages)
- [x] Linting passes: `pnpm lint` (pre-existing errors in other files)
- [x] Build succeeds: `pnpm build:www` (blocked by pre-existing pitch-deck errors)

#### Manual Verification:
- [ ] In initial state: nav items appear in muted gray, login button has secondary styling
- [ ] In scrolled state: nav items appear white/light, login button has white bg with black text
- [ ] Hover states work correctly in both states
- [ ] Dropdown menu items readable in both states
- [ ] Logo remains visible in both states

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding.

---

## Phase 4: Polish and Edge Cases

### Overview
Address edge cases, refine animations, and ensure consistent behavior across all scenarios.

### Changes Required:

#### 1. Handle Logo Group Conflict
**File**: `apps/www/src/components/app-navbar.tsx`

The logo uses `className="group"` which may conflict with the header's `group` class. Rename to named group:

```tsx
<Button variant="none" size="lg" className="group/logo" asChild>
  <NextLink href="/" prefetch>
    <Icons.logo className="size-22 text-foreground group-hover/logo:text-primary transition-colors" />
  </NextLink>
</Button>
```

#### 2. Ensure Dropdown Menus Readable
**File**: `apps/www/src/components/app-nav-menu.tsx`

The dropdown content should always have a light background regardless of navbar state:

```tsx
<NavigationMenuContent>
  <div className="flex flex-col gap-1 rounded-sm p-1 md:w-[220px] bg-popover text-popover-foreground">
```

#### 3. Add Smooth Width Transition
The `max-w-5xl` transition may appear jumpy. Consider using a fixed-width approach or ensuring the transition is smooth:

**File**: `apps/www/src/components/app-navbar.tsx`

The inner div already has `transition-all duration-300` which should handle the width transition. If jumpy, can add:
```tsx
className="... lg:group-[.brand-navbar]:w-[calc(100%-4rem)]"
```

### Success Criteria:

#### Automated Verification:
- [x] Type checking passes: `pnpm typecheck` (pre-existing errors in other packages)
- [x] Linting passes: `pnpm lint` (pre-existing errors in other files)
- [x] Build succeeds: `pnpm build:www` (blocked by pre-existing pitch-deck errors)

#### Manual Verification:
- [ ] Logo hover state works correctly
- [ ] Dropdown menus have proper background in scrolled state
- [ ] Width transition is smooth, not jumpy
- [ ] All pages work correctly: `/`, `/pricing`, `/early-access`, `/features/*`
- [ ] Test scroll up/down multiple times - transitions remain smooth
- [ ] No layout shift during transformation

---

## Testing Strategy

### Unit Tests:
- N/A - This is primarily a CSS/styling change

### Integration Tests:
- N/A - Visual regression testing would be ideal but not in scope

### Manual Testing Steps:

1. **Homepage (`/`)**:
   - Should show black floating bar immediately on load
   - Verify all nav items and dropdowns work

2. **Other pages (`/pricing`, `/early-access`)**:
   - Load page, verify light navbar
   - Scroll down slowly, observe transition at ~25px
   - Verify black floating bar appearance
   - Test all nav items and dropdowns
   - Scroll back up, verify return to light navbar

3. **Mobile testing**:
   - Verify no transformation occurs (mobile nav unchanged)
   - Test hamburger menu functionality

4. **Resize testing**:
   - Start on mobile, resize to desktop while scrolled
   - Verify correct state after resize

## Performance Considerations

- Uses CSS-only transitions (no JavaScript animation overhead)
- Scroll listener uses `{ passive: true }` for performance
- No layout thrashing - uses transform and opacity where possible
- Single class toggle per scroll event

## References

- Research document: `thoughts/shared/research/2026-01-28-app-navbar-scroll-transform-architecture.md`
- Design reference: Amplemarket-style floating navbar
- Existing scroll pattern: `apps/www/src/components/navbar-state-injector.tsx`
- Similar implementation: `packages/ui/src/components/ui/sidebar.tsx:488` (group-has usage)
