---
date: 2026-01-28T22:15:00+08:00
researcher: Claude
git_commit: 379a23cbb11e3c7ad689b38fc0f023e6de69450e
branch: feat/pitch-deck-page
repository: lightfast
topic: "AppNavbar scroll-triggered transform to boxed floating bar"
tags: [research, codebase, navbar, scroll-animation, framer-motion, www]
status: complete
last_updated: 2026-01-28
last_updated_by: Claude
last_updated_note: "Added final specification after discussion"
---

# Research: AppNavbar Scroll-Triggered Transform Architecture

**Date**: 2026-01-28T22:15:00+08:00
**Researcher**: Claude
**Git Commit**: 379a23cbb11e3c7ad689b38fc0f023e6de69450e
**Branch**: feat/pitch-deck-page
**Repository**: lightfast

## Research Question

Document the current AppNavbar implementation and related components to understand:
1. Current navbar structure and components
2. Existing scroll-based animation patterns in the codebase
3. How a scroll-triggered transform (standard → boxed floating bar) could be achieved

Reference: Amplemarket-style navbar that transforms from full-width to a compact boxed/floating bar with black background after scroll.

## Summary

The current `AppNavbar` is a server-rendered component with a simple sticky header layout. The codebase already has a `NavbarStateInjector` client component that handles scroll-based class toggling. The pitch-deck feature has extensive framer-motion scroll patterns that could be adapted for navbar transformation animations.

## Detailed Findings

### Current AppNavbar Structure

**File**: `apps/www/src/components/app-navbar.tsx`

The navbar is a server-rendered component with three main sections:

```
┌─────────────────────────────────────────────────────────────────────┐
│ header (sticky top-0 z-50 py-4 page-gutter bg-background)          │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ div (grid: 1fr auto 1fr on lg)                                  │ │
│ │ ┌─────────┐ ┌──────────────────┐ ┌───────────────────────────┐ │ │
│ │ │ Logo    │ │ AppNavMenu       │ │ Search | Login | Mobile   │ │ │
│ │ │ (left)  │ │ (center, lg only)│ │ (right actions)           │ │ │
│ │ └─────────┘ └──────────────────┘ └───────────────────────────┘ │ │
│ └─────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

**Current classes on header** (line 14):
- `shrink-0` - Prevents flexbox shrinking
- `border-b` - Bottom border separator
- `sticky top-0` - Sticks to top on scroll
- `z-50` - High z-index for layering
- `py-4` - Vertical padding
- `page-gutter` - Horizontal padding utility
- `bg-background` - Background color
- `transition-colors duration-300` - Color transitions

**Key components**:
1. **Logo** (lines 17-23): Lightfast logo with link to home
2. **AppNavMenu** (line 26): Desktop navigation, hidden below lg breakpoint
3. **Actions** (lines 29-58): Search, Login button, and AppMobileNav trigger

### AppNavMenu Component

**File**: `apps/www/src/components/app-nav-menu.tsx`

Client component (`"use client"`) with:
- Two dropdown menus: Features and Resources
- Top-level links: Pricing, Early Access, Docs
- Hidden below `lg` breakpoint via `hidden lg:flex`
- Uses Radix UI NavigationMenu with `viewport={false}`
- Mix of NextLink and MicrofrontendLink based on `item.microfrontend` property

**Navigation items from `config/nav.ts`**:
- FEATURES_NAV: Memory, For Agents, Connectors, Timeline
- RESOURCES_NAV: Changelog, Blog
- INTERNAL_NAV: Features, Pricing, Early Access, Docs

### AppMobileNav Component

**File**: `apps/www/src/components/app-mobile-nav.tsx`

Full-screen sheet drawer for mobile:
- Trigger visible only below lg breakpoint (`lg:hidden`)
- Slides in from left with SheetPrimitive
- Contains same nav items organized in sections
- Social links in footer
- Closes on navigation via `onClick={() => setOpen(false)}`

### Existing Scroll Detection

**File**: `apps/www/src/components/navbar-state-injector.tsx`

Already implements scroll-based navbar state changes:

```typescript
const updateNavbarState = () => {
  const scrollY = window.scrollY;
  const isScrolled = scrollY > 25;
  const isHomePage = pathname === "/";
  const showBrandNavbar = isHomePage || isScrolled;

  if (showBrandNavbar) {
    navbarElement.classList.add("brand-navbar");
    // ... add dark mode classes
  } else {
    navbarElement.classList.remove("brand-navbar");
    // ... remove dark mode classes
  }
};
```

**Key aspects**:
- Uses `window.scrollY` with 25px threshold
- Direct DOM manipulation via `document.getElementById("app-navbar")`
- Toggles CSS classes and inline styles
- Uses `{ passive: true }` for performance
- Reacts to pathname changes

### Scroll Animation Patterns in Codebase

The pitch-deck feature has extensive scroll-based animations:

**Pattern 1: Framer Motion useScroll** (`pitch-deck.tsx:38-66`)
```typescript
const { scrollYProgress } = useScroll({
  target: containerRef,
  offset: ["start start", "end end"],
});

useMotionValueEvent(scrollYProgress, "change", (latest) => {
  // React to scroll progress
});
```

**Pattern 2: useTransform for Scroll-Driven Animations** (`pitch-deck.tsx:467-505`)
```typescript
const y = useTransform(scrollProgress, [0, 0.5, 1], ["0%", "-30px", "-60px"]);
const scale = useTransform(scrollProgress, [0, 0.5, 1], [1, 0.95, 0.85]);
```

**Pattern 3: Window Scroll Event** (`navbar-state-injector.tsx:22-49`)
```typescript
window.addEventListener("scroll", updateNavbarState, { passive: true });
```

**Pattern 4: CSS Sticky/Fixed Positioning**
- `sticky top-0` - Current navbar
- `fixed top-0 left-0 right-0` - Pitch deck header
- `fixed bottom-0 left-0 right-0` - Mobile bottom bar

## Code References

- `apps/www/src/components/app-navbar.tsx:12-62` - Main navbar component
- `apps/www/src/components/app-nav-menu.tsx:19-100` - Desktop navigation menu
- `apps/www/src/components/app-mobile-nav.tsx:22-159` - Mobile navigation drawer
- `apps/www/src/components/navbar-state-injector.tsx:14-65` - Scroll state management
- `apps/www/src/config/nav.ts:10-59` - Navigation configuration
- `apps/www/src/app/(app)/(internal)/pitch-deck/_components/pitch-deck.tsx:38-96` - Scroll animation patterns

## Architecture Documentation

### Current Component Hierarchy

```
AppNavbar (server component)
├── Logo (NextLink + Icons.logo)
├── AppNavMenu (client component, lg+ only)
│   ├── Features NavigationMenu
│   ├── Resources NavigationMenu
│   └── Top-level links (Pricing, Early Access, Docs)
└── Actions
    ├── Search Button (MicrofrontendLink)
    ├── Log In Button (MicrofrontendLink)
    └── AppMobileNav (client component, <lg only)
        └── Sheet with full navigation
```

### Existing Styling Patterns

**Backdrop blur for floating elements**:
- `backdrop-blur-sm` or `backdrop-blur-md`
- `bg-background/80` or `bg-background/95` for transparency

**Animation transitions**:
- `transition-colors duration-300` - Color transitions
- framer-motion for complex animations
- Custom easing: `[0.25, 0.1, 0.25, 1]` (cubic-bezier)

**Fixed/sticky patterns**:
- `sticky top-0 z-50` for headers
- `fixed inset-0 z-40` for overlays

## Design Reference Analysis

Based on the Amplemarket reference provided:

**Initial State** (no scroll):
- Full-width navbar spanning edge to edge
- Standard white/light background
- All elements in single row: Logo | Nav Items | CTAs

**Scrolled State** (after ~25-50px scroll):
- Transforms to compact boxed/floating bar
- Black/dark background
- Centered with rounded corners
- Elements compact together with reduced padding
- Possibly shadow or subtle border

**Transition Elements**:
- Width: Full → Auto/Max-width
- Background: Light → Dark (black)
- Border-radius: None → Rounded
- Position: Sticky → Floating (with margin)
- Padding: Standard → Compact
- Shadow: None → Subtle

## Final Specification

Based on discussion, the following decisions were made:

### Scope
- **Desktop only** (`lg:` breakpoint and above)
- Mobile navbar remains unchanged

### Visual Design

```
INITIAL STATE (no scroll):
┌──────────────────────────────────────────────────────────────────────────────┐
│ [Logo]        Features ▾  Resources ▾  Pricing  Early Access  [Search] [Login] │
└──────────────────────────────────────────────────────────────────────────────┘
← ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ full width, light bg ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ →

SCROLLED STATE (>25px scroll):
┌─────────────────────────────────────────────────────────────────────────────┐
│                          transparent header                                   │
│                                                                               │
│          ┌─────────────────────────────────────────────────────┐            │
│          │ [Logo]  Features  Resources  Pricing  ...  [Login]  │ ← black bg │
│          └─────────────────────────────────────────────────────┘   rounded-sm│
│                              max-w-5xl                                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Confirmed Properties

| Property | Initial State | Scrolled State |
|----------|---------------|----------------|
| Scope | Desktop only (`lg:`) | Desktop only (`lg:`) |
| Scroll threshold | - | 25px |
| Max-width | `100%` (full) | `max-w-5xl` (1024px) |
| Border-radius | None | `rounded-sm` |
| Background (inner) | Light/transparent | Black (`bg-black`) |
| Background (outer) | Light | Transparent |
| Text color | Current | White (on black) |
| Animation duration | - | 300ms |
| Logo | White | White (no change) |
| Nav items | All visible | All visible (no collapse) |

### Implementation Approach

**Strategy**: CSS-only with class toggle (extends existing `NavbarStateInjector`)

1. **`app-navbar.tsx`**: Add inner wrapper div for the transforming container
2. **`navbar-state-injector.tsx`**: Add `scrolled-navbar` class toggle (or reuse `brand-navbar`)
3. **Tailwind classes**: Style the transformation with group selectors

**Structural change**:
```tsx
<header className="sticky top-0 z-50 py-4 page-gutter group" id="app-navbar">
  <div className="navbar-inner transition-all duration-300
    lg:group-[.scrolled]:bg-black lg:group-[.scrolled]:text-white
    lg:group-[.scrolled]:rounded-sm lg:group-[.scrolled]:max-w-5xl
    lg:group-[.scrolled]:mx-auto lg:group-[.scrolled]:px-6">
    {/* Logo | NavMenu | Actions */}
  </div>
</header>
```

### Files to Modify

1. `apps/www/src/components/app-navbar.tsx` - Add inner container wrapper
2. `apps/www/src/components/navbar-state-injector.tsx` - Toggle `scrolled` class
3. Possibly `tailwind.config.ts` - If custom variants needed
