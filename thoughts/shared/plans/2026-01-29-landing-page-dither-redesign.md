# Landing Page Redesign with Blue/White Dither Effect - Implementation Plan

## Overview

Rework the www landing page to feature a full-viewport blue/white dither effect as the hero visual, with the navbar overlaying the hero transparently. The hero section becomes the central visual statement while other sections remain largely unchanged below.

## Current State Analysis

**Current Landing Page** (`apps/www/src/app/(app)/(marketing)/(landing)/page.tsx`):
- Hero section is text-only with `max-w-7xl` container (lines 177-221)
- Standard `bg-background` throughout
- Navbar is sticky with solid `bg-background` via layout

**Current Layout** (`apps/www/src/app/(app)/(marketing)/layout.tsx`):
- `AppNavbar` at line 14 with `sticky top-0 z-50 bg-background`
- Main content wrapped with `py-16` padding

**Existing Patterns to Leverage**:
- `VisualShowcase` component shows 3-layer approach: background → blur overlay → content
- Early-access page shows fixed background with transparent navbar pattern
- Grid-based layering using `grid-cols-1 grid-rows-1` with `col-span-full row-span-full`
- **`AppNavbarV2`** (`apps/www/src/components/app-navbar-v2.tsx`) - CSS group-based navbar that transforms based on parent class (`.brand-navbar`). We'll extend this pattern with a `.hero-mode` class for the landing page

## Desired End State

1. **Hero Section**: Full-viewport (`min-h-screen`) with blue background/dither effect
2. **Navbar**: Transparent overlay on hero, transitions to solid on scroll
3. **Hero Content**: White text centered over blue background with CTA buttons
4. **Remaining Sections**: Unchanged, normal flow below hero

**Verification**:
- Landing page loads with blue full-screen hero
- Text is white and readable over blue background
- Navbar is transparent on hero, solid when scrolling to content sections
- All existing sections render correctly below hero

## What We're NOT Doing

- Implementing complex WebGL canvas dither animation (placeholder solid blue for now)
- Modifying any section components except hero
- Changing the section order or content below hero
- Adding new dependencies

## Implementation Approach

Create a new hero section component with layered structure, modify the marketing layout to support transparent navbar over hero, and adjust the page to use the new hero structure.

---

## Phase 1: Create Hero Section Component with Blue Background

### Overview
Create a self-contained hero section component that handles the full-viewport layout with blue background and white text content overlay.

### Changes Required:

#### 1. Create Hero Section Component
**File**: `apps/www/src/components/landing/hero-section.tsx` (NEW)
**Purpose**: Encapsulates the hero with blue background and content

```tsx
import Link from "next/link";
import { Button } from "@repo/ui/components/ui/button";
import { ArrowRight } from "lucide-react";
import { exposureTrial } from "~/lib/fonts";

export function HeroSection() {
  return (
    <section className="relative min-h-screen overflow-hidden">
      {/* Blue Background Layer */}
      <div className="absolute inset-0 z-0 bg-[#00A3FF]" />

      {/* Content Overlay */}
      <div className="relative z-10 flex min-h-screen items-center justify-center px-4">
        <div className="max-w-4xl text-center">
          {/* Heading */}
          <h1
            className={`text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-light text-white text-balance ${exposureTrial.className}`}
          >
            The memory layer for software teams
          </h1>

          {/* Description */}
          <p className="mt-6 text-lg md:text-xl text-white/80">
            Search everything your engineering org knows
          </p>

          {/* CTA Buttons */}
          <div className="mt-10 flex flex-col items-center justify-center gap-6 sm:flex-row">
            <Button
              asChild
              size="lg"
              className="rounded-full bg-white text-[#00A3FF] hover:bg-white/90"
            >
              <Link href="/early-access">Join Early Access</Link>
            </Button>

            <Link
              href="/docs/get-started/overview"
              className="group inline-flex items-center text-sm font-medium text-white/80 transition-colors hover:text-white"
            >
              <span>Learn more about Lightfast</span>
              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `pnpm --filter @lightfast/www typecheck`
- [x] Lint passes: `pnpm --filter @lightfast/www lint`
- [x] Component file exists at `apps/www/src/components/landing/hero-section.tsx`

#### Manual Verification:
- [x] N/A - component not yet integrated

---

## Phase 2: Modify Marketing Layout for Transparent Navbar

### Overview
Update the marketing layout to support navbar that is transparent over hero content but solid when scrolling to other sections. This requires making the navbar position fixed (not sticky) and removing the main padding.

### Changes Required:

#### 1. Update Marketing Layout
**File**: `apps/www/src/app/(app)/(marketing)/layout.tsx`
**Changes**: Remove py-16 padding from main, keep navbar solid for now (Phase 3 handles transparency)

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

        {/* Main content - removed py-16 to allow hero to go edge-to-edge */}
        <main className="flex-1 bg-background">{children}</main>

        {/* Footer */}
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
- [x] TypeScript compiles: `pnpm --filter @lightfast/www typecheck`
- [x] Lint passes: `pnpm --filter @lightfast/www lint`

#### Manual Verification:
- [ ] Layout loads without visual regressions on other marketing pages

---

## Phase 3: Create Transparent Navbar Variant

### Overview
Create a client component that wraps the navbar and handles scroll-based transparency. On the landing page, navbar will be transparent over the hero and transition to solid when scrolling.

### Changes Required:

#### 1. Create Hero Navbar Wrapper
**File**: `apps/www/src/components/landing/hero-navbar.tsx` (NEW)
**Purpose**: Client component that makes navbar transparent and handles scroll

```tsx
"use client";

import { useEffect, useState } from "react";
import NextLink from "next/link";
import { Link as MicrofrontendLink } from "@vercel/microfrontends/next/client";
import { Icons } from "@repo/ui/components/icons";
import { Button } from "@repo/ui/components/ui/button";
import { Search } from "lucide-react";
import { AppNavMenu } from "~/components/app-nav-menu";
import { AppMobileNav } from "~/components/app-mobile-nav";
import { cn } from "@repo/ui/lib/utils";

export function HeroNavbar() {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      // Transition at 100px scroll
      setIsScrolled(window.scrollY > 100);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll(); // Check initial state

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed top-0 left-0 right-0 z-50 py-4 page-gutter transition-all duration-300",
        isScrolled
          ? "bg-background border-b"
          : "bg-transparent border-transparent"
      )}
    >
      <div className="relative flex items-center justify-between gap-4 lg:grid lg:grid-cols-[1fr_auto_1fr]">
        {/* Left: Logo */}
        <div className="-ml-2 flex items-center lg:justify-self-start">
          <Button variant="none" size="lg" className="group" asChild>
            <NextLink href="/" prefetch>
              <Icons.logo
                className={cn(
                  "size-22 transition-colors",
                  isScrolled ? "text-foreground" : "text-white"
                )}
              />
            </NextLink>
          </Button>
        </div>

        {/* Center: Nav items - hidden on hero, visible when scrolled */}
        <div
          className={cn(
            "transition-opacity duration-300",
            isScrolled ? "opacity-100" : "opacity-0 pointer-events-none"
          )}
        >
          <AppNavMenu />
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-4 lg:justify-self-end">
          {/* Search Icon */}
          <Button
            variant="link"
            size="lg"
            asChild
            className={cn(
              "transition-colors",
              isScrolled ? "text-muted-foreground" : "text-white/80"
            )}
          >
            <MicrofrontendLink href="/search" aria-label="Search">
              <Search className="h-5 w-5" />
            </MicrofrontendLink>
          </Button>

          {/* Sign In Button */}
          <Button
            variant="secondary"
            size="lg"
            className={cn(
              "rounded-full transition-all",
              isScrolled
                ? "bg-secondary text-secondary-foreground"
                : "bg-white/20 text-white border border-white/30 hover:bg-white/30"
            )}
            asChild
          >
            <MicrofrontendLink href="/sign-in">
              <span className="text-sm font-medium">Log In</span>
            </MicrofrontendLink>
          </Button>

          {/* Mobile Nav - shown when scrolled */}
          <div
            className={cn(
              "transition-opacity duration-300",
              isScrolled ? "opacity-100" : "opacity-0 pointer-events-none"
            )}
          >
            <AppMobileNav />
          </div>
        </div>
      </div>
    </header>
  );
}
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `pnpm --filter @lightfast/www typecheck`
- [x] Lint passes: `pnpm --filter @lightfast/www lint`
- [x] Component file exists at `apps/www/src/components/landing/hero-navbar.tsx`

#### Manual Verification:
- [x] N/A - component not yet integrated into page

---

## Phase 4: Integrate Hero into Landing Page

### Overview
Update the landing page to use the new hero section and hero navbar, replacing the current inline hero markup.

### Changes Required:

#### 1. Create Landing Page Layout
**File**: `apps/www/src/app/(app)/(marketing)/(landing)/layout.tsx` (NEW)
**Purpose**: Override marketing layout to use transparent navbar for landing page only

```tsx
import { AppFooter } from "~/components/app-footer";
import { HeroNavbar } from "~/components/landing/hero-navbar";

export default function LandingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <div className="relative min-h-screen flex flex-col">
        {/* Transparent/Scroll-aware Navbar */}
        <HeroNavbar />

        {/* Main content - no padding, hero goes edge-to-edge */}
        <main className="flex-1">{children}</main>

        {/* Footer */}
        <footer className="mt-auto">
          <AppFooter />
        </footer>
      </div>
    </>
  );
}
```

#### 2. Update Landing Page
**File**: `apps/www/src/app/(app)/(marketing)/(landing)/page.tsx`
**Changes**:
- Import and use `HeroSection` component
- Remove inline hero markup
- Adjust container structure for hero-first layout

```tsx
// Add import at top
import { HeroSection } from "~/components/landing/hero-section";

// In the return, replace the hero section:
return (
  <>
    {/* Structured data for SEO */}
    <JsonLd code={structuredData} />

    {/* Hero Section - Full viewport with blue background */}
    <HeroSection />

    {/* Content Sections - Below hero */}
    <div className="bg-background">
      <div className="flex w-full flex-col gap-20 overflow-x-clip py-20 pb-32 md:px-10">
        {/* Platform Access Cards */}
        <PlatformAccessCards />

        {/* Demo Section - Search Visual */}
        <div className="max-w-6xl px-4 mx-auto w-full py-10">
          <VisualShowcase>
            <SearchDemo />
          </VisualShowcase>
        </div>

        {/* Integration Showcase */}
        <div className="max-w-6xl mx-auto w-full px-4 py-10 space-y-8">
          <div className="text-center">
            <h2 className="text-sm">
              <span className="text-muted-foreground">
                Lightfast integrates with the tools you use
              </span>
            </h2>
          </div>
          <IntegrationShowcase />
        </div>

        {/* FAQ Section */}
        <div className="max-w-6xl mx-auto w-full px-4 py-10">
          <FAQSection />
        </div>

        {/* Changelog Preview */}
        <div className="max-w-6xl mx-auto w-full px-4">
          <ChangelogPreview />
        </div>
      </div>
    </div>

    {/* Waitlist CTA - Outside of padding container */}
    <WaitlistCTA />
  </>
);
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `pnpm --filter @lightfast/www typecheck`
- [x] Lint passes: `pnpm --filter @lightfast/www lint`
- [x] Layout file exists at `apps/www/src/app/(app)/(marketing)/(landing)/layout.tsx`

#### Manual Verification:
- [ ] Landing page shows full-viewport blue hero
- [ ] Hero text is white and readable
- [ ] "Join Early Access" button is white with blue text
- [ ] Navbar is transparent over hero
- [ ] Navbar transitions to solid when scrolling past hero
- [ ] All sections below hero render correctly
- [ ] Mobile layout works correctly
- [ ] Footer appears at bottom of page

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation that the landing page displays correctly before proceeding.

---

## Phase 5: Polish and Refinements

### Overview
Fine-tune spacing, animations, and visual details based on manual testing feedback.

### Potential Refinements:

1. **Scroll Indicator**: Add a subtle scroll-down arrow at bottom of hero
2. **Hero Animation**: Add subtle fade-in animation on load
3. **Navbar Transition**: Adjust transition timing/easing
4. **Mobile Navbar**: Add hamburger menu for mobile on hero
5. **Dither Placeholder**: Replace solid blue with gradient or pattern

### Changes Required:
(To be determined based on Phase 4 manual testing)

### Success Criteria:

#### Manual Verification:
- [ ] Animations feel smooth and intentional
- [ ] No layout shifts during scroll
- [ ] Mobile experience is polished
- [ ] Page feels cohesive and branded

---

## Testing Strategy

### Unit Tests:
- No new unit tests required (presentational components)

### Integration Tests:
- Verify SSR works correctly (no hydration mismatches from scroll listener)

### Manual Testing Steps:
1. Load landing page at `/` - verify hero displays correctly
2. Scroll down - verify navbar transitions from transparent to solid
3. Click "Join Early Access" - verify navigation works
4. Click "Learn more" - verify navigation works
5. Verify all sections below hero render correctly
6. Test on mobile viewport sizes
7. Test scroll behavior on mobile (touch scroll)
8. Verify no console errors

## Performance Considerations

- `HeroNavbar` scroll listener uses `{ passive: true }` for performance
- No heavy animations or WebGL yet (placeholder solid color)
- Hero image optimization not needed (solid color background)

## Migration Notes

N/A - No data migration required

## References

- Research document: `thoughts/shared/research/2026-01-29-landing-page-dither-redesign.md`
- Current landing page: `apps/www/src/app/(app)/(marketing)/(landing)/page.tsx:177-221`
- Visual showcase pattern: `apps/www/src/components/visual-showcase.tsx:24-53`
- Early access fixed navbar pattern: `apps/www/src/app/(app)/early-access/page.tsx:48-89`
- Blue sky background asset: `apps/www/public/images/blue-sky.webp`
