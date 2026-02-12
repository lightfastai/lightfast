# Marketing Mobile Navigation Implementation Plan

## Overview

Add a Sheet-based mobile navigation to the marketing pages (`apps/www/(marketing)/`) that appears on screens below 1024px (lg breakpoint). The current desktop navigation simply disappears on mobile - this plan adds a hamburger menu that slides in from the left with all navigation items, search, login, and social links.

## Current State Analysis

**What exists:**
- `AppNavbar` (server component) - Three-column header with logo, nav, and actions
- `AppNavMenu` (client component) - Desktop navigation with `hidden md:flex` (hidden below 768px)
- No mobile navigation exists - users only see Logo + Search + Log In on mobile

**Key files:**
- `apps/www/src/components/app-navbar.tsx:11-58` - Main navbar component
- `apps/www/src/components/app-nav-menu.tsx:19-102` - Desktop nav menu
- `apps/www/src/config/nav.ts` - Navigation configuration

**Reference implementation:**
- `apps/chat/src/components/layouts/unauthenticated-mobile-nav.tsx` - Sheet-based mobile nav pattern

## Desired End State

On screens below 1024px (lg breakpoint):
- Desktop `AppNavMenu` is hidden
- A hamburger menu icon appears in the right actions area
- Clicking it opens a full-screen Sheet from the left containing:
  - **Header**: Close button (X + "Menu") and Log In button
  - **Content**: Search link, Features section (4 items), Resources section (2 items), top-level nav (Pricing, Early Access, Docs)
  - **Footer**: Social links (X, GitHub, Discord)

**Verification:**
1. Resize browser below 1024px - hamburger icon appears, desktop nav hides
2. Click hamburger - sheet slides in from left
3. All nav items are clickable and close the sheet
4. Search link navigates to /search
5. Log In button navigates to /sign-in
6. Social links open in new tabs

## What We're NOT Doing

- Not modifying the pitch-deck navigation (separate implementation)
- Not changing the desktop navigation behavior
- Not adding authentication state handling (always show Log In, not user info)
- Not implementing search functionality within the sheet (just a link to /search)

## Implementation Approach

1. Create a new `AppMobileNav` client component with Sheet-based navigation
2. Update `AppNavbar` to include the mobile nav trigger on the right side
3. Update `AppNavMenu` breakpoint from `md:` to `lg:` to match mobile nav

## Phase 1: Create AppMobileNav Component

### Overview
Create the new mobile navigation component that uses the Sheet pattern from the chat app.

### Changes Required:

#### 1. Create new component
**File**: `apps/www/src/components/app-mobile-nav.tsx`
**Changes**: Create new file

```tsx
"use client";

import * as React from "react";
import NextLink from "next/link";
import { Link as MicrofrontendLink } from "@vercel/microfrontends/next/client";
import { Menu, X, Search } from "lucide-react";
import { Button } from "@repo/ui/components/ui/button";
import {
  Sheet,
  SheetTrigger,
  SheetPrimitive,
} from "@repo/ui/components/ui/sheet";
import { ScrollArea } from "@repo/ui/components/ui/scroll-area";
import { Icons } from "@repo/ui/components/icons";
import {
  FEATURES_NAV,
  INTERNAL_NAV,
  RESOURCES_NAV,
  SOCIAL_NAV,
} from "~/config/nav";

export function AppMobileNav() {
  const [open, setOpen] = React.useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          aria-label="Toggle Menu"
        >
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetPrimitive.Portal>
        <SheetPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <SheetPrimitive.Content className="fixed inset-y-0 left-0 z-50 h-full w-screen bg-background/95 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left data-[state=closed]:duration-300 data-[state=open]:duration-500">
          {/* Visually hidden title for accessibility */}
          <SheetPrimitive.Title className="sr-only">
            Navigation Menu
          </SheetPrimitive.Title>

          {/* Header */}
          <div className="flex items-center justify-between p-6 pb-4">
            <SheetPrimitive.Close className="flex items-center gap-2 text-foreground hover:opacity-70 transition-opacity">
              <X className="h-5 w-5" />
              <span className="text-lg font-medium">Menu</span>
            </SheetPrimitive.Close>
            <Button variant="secondary" size="lg" className="rounded-full" asChild>
              <MicrofrontendLink
                href="/sign-in"
                onClick={() => setOpen(false)}
              >
                <span className="text-sm text-secondary-foreground font-medium">
                  Log In
                </span>
              </MicrofrontendLink>
            </Button>
          </div>

          {/* Content */}
          <div className="flex flex-col h-[calc(100vh-5rem)]">
            <ScrollArea className="flex-1 overflow-hidden">
              <div className="px-6 space-y-6">
                {/* Search */}
                <MicrofrontendLink
                  href="/search"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 text-lg font-medium text-foreground hover:text-muted-foreground transition-colors"
                >
                  <Search className="h-5 w-5" />
                  Search
                </MicrofrontendLink>

                {/* Features section */}
                <div className="space-y-3">
                  <div className="text-sm text-muted-foreground uppercase tracking-wide">
                    Features
                  </div>
                  <div className="space-y-1">
                    {FEATURES_NAV.map((item) => (
                      <NextLink
                        key={item.href}
                        href={item.href}
                        prefetch
                        onClick={() => setOpen(false)}
                        className="block text-lg font-medium py-1 text-foreground hover:text-muted-foreground transition-colors"
                      >
                        {item.title}
                      </NextLink>
                    ))}
                  </div>
                </div>

                {/* Resources section */}
                <div className="space-y-3">
                  <div className="text-sm text-muted-foreground uppercase tracking-wide">
                    Resources
                  </div>
                  <div className="space-y-1">
                    {RESOURCES_NAV.map((item) => (
                      <NextLink
                        key={item.href}
                        href={item.href}
                        prefetch
                        onClick={() => setOpen(false)}
                        className="block text-lg font-medium py-1 text-foreground hover:text-muted-foreground transition-colors"
                      >
                        {item.title}
                      </NextLink>
                    ))}
                  </div>
                </div>

                {/* Top-level nav items */}
                <div className="space-y-3">
                  <div className="text-sm text-muted-foreground uppercase tracking-wide">
                    More
                  </div>
                  <div className="space-y-1">
                    {INTERNAL_NAV.filter((i) => i.href !== "/features").map(
                      (item) =>
                        item.microfrontend ? (
                          <MicrofrontendLink
                            key={item.href}
                            href={item.href}
                            onClick={() => setOpen(false)}
                            className="block text-lg font-medium py-1 text-foreground hover:text-muted-foreground transition-colors"
                          >
                            {item.title}
                          </MicrofrontendLink>
                        ) : (
                          <NextLink
                            key={item.href}
                            href={item.href}
                            prefetch
                            onClick={() => setOpen(false)}
                            className="block text-lg font-medium py-1 text-foreground hover:text-muted-foreground transition-colors"
                          >
                            {item.title}
                          </NextLink>
                        )
                    )}
                  </div>
                </div>
              </div>
            </ScrollArea>

            {/* Footer with social links */}
            <div className="border-t p-6 flex items-center justify-center gap-6">
              {SOCIAL_NAV.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={item.title}
                >
                  {item.icon === "twitter" && (
                    <Icons.twitter className="h-5 w-5" />
                  )}
                  {item.icon === "gitHub" && (
                    <Icons.gitHub className="h-5 w-5" />
                  )}
                  {item.icon === "discord" && (
                    <Icons.discord className="h-5 w-5" />
                  )}
                </a>
              ))}
            </div>
          </div>
        </SheetPrimitive.Content>
      </SheetPrimitive.Portal>
    </Sheet>
  );
}
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles without errors: `pnpm --filter @lightfast/www typecheck`
- [x] Linting passes: `pnpm --filter @lightfast/www lint`
- [x] Build succeeds: `pnpm build:www`

#### Manual Verification:
- [x] File exists at correct path
- [x] Component exports correctly

**Implementation Note**: After completing this phase and all automated verification passes, proceed to Phase 2.

---

## Phase 2: Update AppNavbar to Include Mobile Nav

### Overview
Modify the navbar to render the mobile navigation trigger on the right side.

### Changes Required:

#### 1. Update AppNavbar
**File**: `apps/www/src/components/app-navbar.tsx`
**Changes**:
- Import AppMobileNav
- Add mobile nav trigger in the right actions area

```tsx
// Add import at top (after existing imports)
import { AppMobileNav } from "./app-mobile-nav";

// In the Right: Actions div, add AppMobileNav before or after the Search button
// The hamburger will only show on mobile (lg:hidden), Search icon hides on mobile (hidden lg:flex)
```

**Specific changes to `app-navbar.tsx`:**

1. Add import after line 6:
```tsx
import { AppMobileNav } from "./app-mobile-nav";
```

2. Update the Right: Actions section (lines 27-54) to:
```tsx
{/* Right: Actions */}
<div className="flex items-center gap-4 md:justify-self-end">
  {/* Mobile Nav Trigger - only visible below lg */}
  <AppMobileNav />

  {/* Search Icon - hidden on mobile, visible on lg+ */}
  <Button
    variant="link"
    size="lg"
    asChild
    className="hidden lg:flex text-muted-foreground"
  >
    <MicrofrontendLink href="/search" aria-label="Search">
      <Search className="h-5 w-5" />
    </MicrofrontendLink>
  </Button>

  {/* Sign In Button - hidden on mobile, visible on lg+ */}
  <Button
    variant="secondary"
    size="lg"
    className="hidden lg:flex rounded-full"
    asChild
  >
    <MicrofrontendLink href="/sign-in">
      <span className="text-sm text-secondary-foreground font-medium">
        Log In
      </span>
    </MicrofrontendLink>
  </Button>
</div>
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles without errors: `pnpm --filter @lightfast/www typecheck`
- [x] Linting passes: `pnpm --filter @lightfast/www lint`
- [x] Build succeeds: `pnpm build:www`

#### Manual Verification:
- [ ] Hamburger icon appears on screens < 1024px
- [ ] Hamburger icon hidden on screens >= 1024px
- [ ] Search and Log In buttons hidden on screens < 1024px
- [ ] Search and Log In buttons visible on screens >= 1024px

**Implementation Note**: After completing this phase and all automated verification passes, proceed to Phase 3.

---

## Phase 3: Update AppNavMenu Breakpoint

### Overview
Change the desktop nav menu to hide at the lg breakpoint (1024px) instead of md (768px) to match the mobile nav trigger.

### Changes Required:

#### 1. Update AppNavMenu
**File**: `apps/www/src/components/app-nav-menu.tsx`
**Changes**: Update line 21 from `hidden md:flex` to `hidden lg:flex`

```tsx
// Line 21: Change from
<nav className="hidden md:flex items-center md:justify-self-center">

// To
<nav className="hidden lg:flex items-center lg:justify-self-center">
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles without errors: `pnpm --filter @lightfast/www typecheck`
- [x] Linting passes: `pnpm --filter @lightfast/www lint`
- [x] Build succeeds: `pnpm build:www`

#### Manual Verification:
- [ ] Desktop nav hidden on screens < 1024px
- [ ] Desktop nav visible on screens >= 1024px
- [ ] No gap between when mobile nav hides and desktop nav shows

**Implementation Note**: After completing this phase and all automated verification passes, proceed to Phase 4.

---

## Phase 4: Update AppNavbar Grid Breakpoint

### Overview
Update the grid layout breakpoint in AppNavbar to match the lg breakpoint for consistency.

### Changes Required:

#### 1. Update AppNavbar grid classes
**File**: `apps/www/src/components/app-navbar.tsx`
**Changes**: Update line 14 and line 16 to use `lg:` instead of `md:`

```tsx
// Line 14: Change from
<div className="relative flex items-center justify-between gap-4 md:grid md:grid-cols-[1fr_auto_1fr]">

// To
<div className="relative flex items-center justify-between gap-4 lg:grid lg:grid-cols-[1fr_auto_1fr]">

// Line 16: Change from
<div className="-ml-2 flex items-center md:justify-self-start">

// To
<div className="-ml-2 flex items-center lg:justify-self-start">

// Line 28: The justify-self-end is already handled in Phase 2
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles without errors: `pnpm --filter @lightfast/www typecheck`
- [x] Linting passes: `pnpm --filter @lightfast/www lint`
- [x] Build succeeds: `pnpm build:www`

#### Manual Verification:
- [ ] Header uses flexbox on screens < 1024px
- [ ] Header uses grid on screens >= 1024px
- [ ] Layout looks correct at all screen sizes

**Implementation Note**: After completing this phase and all automated verification passes, pause for final manual testing.

---

## Testing Strategy

### Unit Tests:
- No unit tests required - this is a presentational component

### Integration Tests:
- No integration tests required - visual verification is sufficient

### Manual Testing Steps:

1. **Desktop (>= 1024px)**:
   - [ ] Desktop nav menu visible in center
   - [ ] Search icon visible on right
   - [ ] Log In button visible on right
   - [ ] No hamburger menu icon visible

2. **Tablet/Mobile (< 1024px)**:
   - [ ] Desktop nav menu hidden
   - [ ] Hamburger menu icon visible on right
   - [ ] Search icon hidden
   - [ ] Log In button hidden
   - [ ] Click hamburger → Sheet opens from left
   - [ ] Sheet shows: Close button, Log In button in header
   - [ ] Sheet shows: Search link
   - [ ] Sheet shows: Features section with 4 items
   - [ ] Sheet shows: Resources section with 2 items
   - [ ] Sheet shows: More section with Pricing, Early Access, Docs
   - [ ] Sheet shows: Social icons in footer
   - [ ] Click any nav item → navigates and closes sheet
   - [ ] Click Log In → navigates to /sign-in and closes sheet
   - [ ] Click Search → navigates to /search and closes sheet
   - [ ] Click X/close → closes sheet
   - [ ] Click overlay → closes sheet

3. **Breakpoint Transition (around 1024px)**:
   - [ ] Resize from 1023px to 1025px - smooth transition
   - [ ] No overlap of mobile/desktop elements
   - [ ] No flash of unstyled content

## Performance Considerations

- The mobile nav component is client-side rendered but the trigger button is minimal
- Sheet content is lazily rendered (only when open)
- No additional API calls or data fetching

## Migration Notes

- No data migration required
- No breaking changes to existing functionality
- Backward compatible - desktop experience unchanged

## References

- Research document: `thoughts/shared/research/2026-01-28-marketing-layout-navigation.md`
- Reference implementation: `apps/chat/src/components/layouts/unauthenticated-mobile-nav.tsx`
- Sheet component: `packages/ui/src/components/ui/sheet.tsx`
- Nav config: `apps/www/src/config/nav.ts`
