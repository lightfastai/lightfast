# Pitch Deck Mobile Sheet Navigation Implementation Plan

## Overview

Add a sheet-based mobile navigation to the pitch-deck page that provides better mobile UX than the current dropdown menu. The mobile nav will slide in from the left and include site navigation links plus the Contact action.

## Current State Analysis

### Existing Implementation
- `pitch-deck-navbar.tsx` uses `NavigationMenu` dropdown with "MENU" trigger button
- Layout uses 3-column grid on `md:` breakpoint: Logo/Toggle | Menu | Download/Contact
- Menu items: Home, Pricing, Blog, Changelog, Docs
- No mobile-specific navigation - dropdown works but has limited touch usability

### Key Files
- `apps/www/src/app/(app)/(internal)/pitch-deck/layout.tsx:25-50` - Header structure
- `apps/www/src/app/(app)/(internal)/pitch-deck/_components/pitch-deck-navbar.tsx` - Current menu
- Reference: `apps/chat/src/components/layouts/authenticated-mobile-nav.tsx` - Pattern to follow

## Desired End State

- Mobile users (< 768px) see a hamburger icon on the right side of the header
- Tapping the hamburger opens a full-screen sheet sliding in from the left
- Sheet contains: Close button, navigation links (Home, Pricing, Blog, Changelog, Docs, Contact)
- No footer section in the sheet
- Download button remains always visible in the header
- Desktop users (≥ 768px) continue to see the current dropdown menu
- Sheet closes automatically when navigating to a link

### Verification
1. On mobile viewport (< 768px): Hamburger icon visible, dropdown hidden
2. On desktop viewport (≥ 768px): Dropdown visible, hamburger hidden
3. Sheet opens/closes with smooth left-slide animation
4. All navigation links work and close the sheet
5. Download button visible at all viewport sizes

## What We're NOT Doing

- Not adding pitch-deck-specific navigation (jump to slides) in the mobile menu
- Not duplicating Download button in the sheet
- Not adding a footer section to the sheet
- Not changing the desktop navigation behavior
- Not modifying the existing `PitchDeckNavbar` component (just hiding it on mobile)

## Implementation Approach

Create a new `PitchDeckMobileNav` client component that uses the Sheet primitive pattern from the chat app. Update the layout to conditionally show mobile nav on small screens and desktop nav on larger screens.

---

## Phase 1: Create PitchDeckMobileNav Component

### Overview
Create a new client component for the mobile sheet navigation.

### Changes Required:

#### 1. Create new component file
**File**: `apps/www/src/app/(app)/(internal)/pitch-deck/_components/pitch-deck-mobile-nav.tsx`
**Changes**: New file with Sheet-based mobile navigation

```tsx
"use client";

import * as React from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { Button } from "@repo/ui/components/ui/button";
import {
  Sheet,
  SheetTrigger,
  SheetPrimitive,
} from "@repo/ui/components/ui/sheet";
import { ScrollArea } from "@repo/ui/components/ui/scroll-area";

const MENU_ITEMS = [
  { title: "Home", href: "/" },
  { title: "Pricing", href: "/pricing" },
  { title: "Blog", href: "/blog" },
  { title: "Changelog", href: "/changelog" },
  { title: "Docs", href: "/docs/get-started/overview" },
  { title: "Contact", href: "mailto:jp@lightfast.ai" },
];

export function PitchDeckMobileNav() {
  const [open, setOpen] = React.useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetPrimitive.Portal>
        <SheetPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <SheetPrimitive.Content className="fixed inset-y-0 left-0 z-50 flex h-full w-screen flex-col bg-background/95 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left data-[state=closed]:duration-300 data-[state=open]:duration-500">
          <SheetPrimitive.Title className="sr-only">
            Navigation Menu
          </SheetPrimitive.Title>

          {/* Header with close button */}
          <div className="flex items-center justify-between p-6 pb-4">
            <SheetPrimitive.Close className="flex items-center gap-2 text-foreground hover:opacity-70 transition-opacity">
              <X className="h-5 w-5" />
              <span className="text-lg font-medium">Menu</span>
            </SheetPrimitive.Close>
          </div>

          {/* Navigation links */}
          <ScrollArea className="flex-1 overflow-hidden">
            <div className="px-6">
              <nav className="space-y-1">
                {MENU_ITEMS.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="block text-2xl font-medium py-3 text-foreground hover:text-muted-foreground transition-colors"
                  >
                    {item.title}
                  </Link>
                ))}
              </nav>
            </div>
          </ScrollArea>
        </SheetPrimitive.Content>
      </SheetPrimitive.Portal>
    </Sheet>
  );
}
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compilation passes: `pnpm typecheck`
- [x] Linting passes: `pnpm lint`
- [x] Build succeeds: `pnpm build:www`

#### Manual Verification:
- [ ] Component renders without errors when imported

**Implementation Note**: After completing this phase and all automated verification passes, proceed to Phase 2.

---

## Phase 2: Update Layout Header

### Overview
Modify the pitch-deck layout to show mobile nav on small screens and desktop nav on larger screens.

### Changes Required:

#### 1. Update layout imports
**File**: `apps/www/src/app/(app)/(internal)/pitch-deck/layout.tsx`
**Changes**: Add import for PitchDeckMobileNav

```tsx
// Add to imports (after line 8)
import { PitchDeckMobileNav } from "./_components/pitch-deck-mobile-nav";
```

#### 2. Update header structure
**File**: `apps/www/src/app/(app)/(internal)/pitch-deck/layout.tsx`
**Changes**: Restructure the right section to include mobile nav trigger

Current (lines 40-49):
```tsx
{/* Right: Download + Contact */}
<div className="flex items-center gap-4 md:justify-self-end">
  <DownloadButton />
  <a
    href="mailto:jp@lightfast.ai"
    className="text-sm text-foreground hover:text-muted-foreground transition-colors"
  >
    CONTACT
  </a>
</div>
```

New:
```tsx
{/* Right: Download + Contact (desktop) + Mobile Nav */}
<div className="flex items-center gap-4 md:justify-self-end">
  <DownloadButton />
  <a
    href="mailto:jp@lightfast.ai"
    className="hidden md:block text-sm text-foreground hover:text-muted-foreground transition-colors"
  >
    CONTACT
  </a>
  <PitchDeckMobileNav />
</div>
```

#### 3. Hide desktop navbar on mobile
**File**: `apps/www/src/app/(app)/(internal)/pitch-deck/layout.tsx`
**Changes**: Add responsive class to PitchDeckNavbar

Current (line 38):
```tsx
<PitchDeckNavbar />
```

New:
```tsx
<div className="hidden md:block">
  <PitchDeckNavbar />
</div>
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compilation passes: `pnpm typecheck`
- [x] Linting passes: `pnpm lint`
- [x] Build succeeds: `pnpm build:www`

#### Manual Verification:
- [ ] On mobile (< 768px): Hamburger icon visible in right section, "MENU" dropdown hidden, "CONTACT" text hidden
- [ ] On desktop (≥ 768px): "MENU" dropdown visible in center, "CONTACT" text visible, hamburger hidden
- [ ] Download button visible at all viewport sizes
- [ ] Sheet opens when tapping hamburger icon
- [ ] Sheet slides in from left with smooth animation
- [ ] All navigation links in sheet are functional
- [ ] Sheet closes when clicking a navigation link
- [ ] Sheet closes when clicking the X button
- [ ] Sheet closes when clicking the overlay

**Implementation Note**: After completing this phase and all verification passes, the feature is complete.

---

## Testing Strategy

### Manual Testing Steps:
1. Open pitch-deck page at `/pitch-deck`
2. Resize browser to mobile width (< 768px)
3. Verify hamburger icon appears on right, dropdown menu disappears
4. Click hamburger icon - sheet should slide in from left
5. Verify all 6 links are visible: Home, Pricing, Blog, Changelog, Docs, Contact
6. Click "Home" - should navigate and close sheet
7. Reopen sheet, click Contact - should open email client and close sheet
8. Reopen sheet, click X button - sheet should close
9. Reopen sheet, click overlay - sheet should close
10. Resize to desktop width (≥ 768px)
11. Verify dropdown menu reappears in center, hamburger disappears
12. Verify CONTACT text link reappears next to Download button

### Edge Cases:
- Test on actual mobile device (touch interactions)
- Test with keyboard navigation (Tab, Enter, Escape)
- Verify sheet works correctly in both light and dark modes

## Performance Considerations

- Sheet component is lazy-loaded (only renders portal when open)
- No additional bundle impact beyond existing Sheet component already in use
- ScrollArea ensures smooth scrolling on devices with many navigation items

## References

- Research document: `thoughts/shared/research/2026-01-28-pitch-deck-mobile-sheet-navigation.md`
- Reference implementation: `apps/chat/src/components/layouts/authenticated-mobile-nav.tsx`
- Sheet component: `packages/ui/src/components/ui/sheet.tsx`
