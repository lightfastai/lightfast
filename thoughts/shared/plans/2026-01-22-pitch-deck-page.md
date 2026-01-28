# Pitch Deck Page Implementation Plan

## Overview

Create an interactive pitch deck page at `/pitch-deck` in `apps/www` featuring a scroll-driven card stacking animation. As users scroll, slides emerge from below and stack on top of previous slides, which scale down and move backward. The effect simulates flipping through a physical pitch deck.

## Current State Analysis

**Existing patterns in apps/www:**
- Next.js 15 App Router with route groups
- Tailwind CSS with OKLch color system
- `framer-motion` installed but not actively used
- Existing navbar/footer components available
- `@repo/ui` components (Button, NavigationMenu, etc.)
- Dark theme by default with `bg-background` (#1a1a1a)

**Key discoveries:**
- Marketing layout at `apps/www/src/app/(app)/(marketing)/layout.tsx:4-26`
- Navbar component at `apps/www/src/components/app-navbar.tsx:11-58`
- Card styling pattern: `rounded-xs bg-card border border-transparent`
- Animation keyframes defined in `globals.css:84-98`

## Desired End State

A `/pitch-deck` page with:
1. Custom minimal navbar (logo left, menu center, contact right)
2. Full-viewport slide container with dark background
3. Scroll-driven stacking animation where:
   - Current slide is full-size in center
   - Previous slides stack behind (scaled down, moved up)
   - 3 slides visible maximum (4th causes first to disappear)
   - Reverse scrolling works identically
4. Slide content following VC pitch deck structure from research

### Verification:
- Page loads at `http://localhost:4101/pitch-deck`
- Scroll animation is smooth (60fps)
- Slides stack correctly (scale, translate, opacity)
- Navigation menu opens with dropdown
- Contact link sends email to `jp@jeevanpillay.com`
- Works on mobile and desktop

## What We're NOT Doing

- No CMS integration for slide content (hardcoded initially)
- No PDF export functionality
- No slide editing/customization
- No presenter mode or keyboard navigation (future enhancement)
- No progress indicator on first pass (can add later)
- No slide transitions other than scroll-stacking

## Implementation Approach

Use framer-motion's scroll-linked animations with a sticky container. Each slide will be positioned absolutely within a sticky viewport, with transforms calculated based on scroll progress.

**Animation mechanics:**
```
Scroll Progress: 0% -------- 33% -------- 66% -------- 100%
                 |            |            |            |
Slide 1:      [FRONT]   [MID-BACK]    [FAR-BACK]    [GONE]
Slide 2:      [HIDDEN]    [FRONT]    [MID-BACK]   [FAR-BACK]
Slide 3:      [HIDDEN]   [HIDDEN]     [FRONT]    [MID-BACK]
Slide 4:      [HIDDEN]   [HIDDEN]    [HIDDEN]     [FRONT]
```

Each slide position has:
- **FRONT**: `scale(1) translateY(0) opacity(1)`
- **MID-BACK**: `scale(0.95) translateY(-30px) opacity(0.8)`
- **FAR-BACK**: `scale(0.90) translateY(-50px) opacity(0.5)`
- **GONE**: `scale(0.85) translateY(-60px) opacity(0)`

---

## Phase 1: Page Structure & Custom Navbar

### Overview
Create the pitch deck page route with a custom navbar component (different from main site navbar).

### Changes Required:

#### 1. Create pitch deck page route
**File**: `apps/www/src/app/(app)/(internal)/pitch-deck/page.tsx`
**Changes**: New page with metadata and basic structure

```tsx
import { Metadata } from "next";
import { PitchDeck } from "~/components/pitch-deck/pitch-deck";
import { PitchDeckNavbar } from "~/components/pitch-deck/pitch-deck-navbar";

export const metadata: Metadata = {
  title: "Pitch Deck | Lightfast",
  description: "Lightfast - The memory layer for software teams",
  openGraph: {
    title: "Pitch Deck | Lightfast",
    description: "Lightfast - The memory layer for software teams",
    type: "website",
  },
};

export default function PitchDeckPage() {
  return (
    <div className="min-h-screen bg-background">
      <PitchDeckNavbar />
      <PitchDeck />
    </div>
  );
}
```

#### 2. Create pitch deck custom layout
**File**: `apps/www/src/app/(app)/(internal)/pitch-deck/layout.tsx`
**Changes**: Custom layout without standard navbar/footer

```tsx
export default function PitchDeckLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen flex flex-col bg-background">
      {children}
    </div>
  );
}
```

#### 3. Create custom navbar component
**File**: `apps/www/src/components/pitch-deck/pitch-deck-navbar.tsx`
**Changes**: Custom navbar with logo, dropdown menu, and contact

```tsx
"use client";

import { useState } from "react";
import NextLink from "next/link";
import { Icons } from "@repo/ui/components/icons";
import { Button } from "@repo/ui/components/ui/button";
import { X } from "lucide-react";
import { cn } from "@repo/ui/lib/utils";

const MENU_ITEMS = {
  features: [
    { title: "Memory", href: "/features/memory" },
    { title: "Agents", href: "/features/agents" },
    { title: "Connectors", href: "/features/connectors" },
    { title: "Timeline", href: "/features/timeline" },
  ],
  more: [
    { title: "Pricing", href: "/pricing" },
    { title: "Blog", href: "/blog" },
    { title: "Changelog", href: "/changelog" },
    { title: "Docs", href: "/docs/get-started/overview" },
  ],
};

export function PitchDeckNavbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 py-4 px-6">
        <div className="flex items-center justify-between">
          {/* Left: Logo */}
          <NextLink href="/" className="text-foreground">
            <Icons.logo className="h-6 w-auto" />
          </NextLink>

          {/* Center: Menu Toggle */}
          <Button
            variant="ghost"
            className="bg-card/80 backdrop-blur-sm rounded-full px-6 py-2 flex items-center gap-3"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            <span className="text-sm text-foreground">MENU</span>
            <div className="flex items-center gap-1">
              <span className="w-5 h-0.5 bg-foreground" />
              <span className="w-5 h-0.5 bg-foreground" />
            </div>
            {isMenuOpen && (
              <X className="w-5 h-5 ml-2" />
            )}
          </Button>

          {/* Right: Contact */}
          <a
            href="mailto:jp@jeevanpillay.com"
            className="text-sm text-foreground hover:text-muted-foreground transition-colors"
          >
            CONTACT
          </a>
        </div>
      </header>

      {/* Dropdown Menu */}
      {isMenuOpen && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 w-full max-w-md">
          <div className="bg-card/95 backdrop-blur-md rounded-lg p-6 mx-4">
            {/* Features Section */}
            <div className="mb-6">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">
                FEATURES
              </p>
              <div className="flex flex-col gap-2">
                {MENU_ITEMS.features.map((item) => (
                  <NextLink
                    key={item.href}
                    href={item.href}
                    className="text-2xl font-light text-foreground hover:text-muted-foreground transition-colors"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    {item.title}
                  </NextLink>
                ))}
              </div>
            </div>

            <div className="border-t border-border my-4" />

            {/* More Section */}
            <div className="mb-6">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">
                MORE
              </p>
              <div className="flex flex-col gap-2">
                {MENU_ITEMS.more.map((item) => (
                  <NextLink
                    key={item.href}
                    href={item.href}
                    className="text-lg text-foreground hover:text-muted-foreground transition-colors"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    {item.title}
                  </NextLink>
                ))}
              </div>
            </div>

            {/* Contact Button */}
            <Button
              variant="outline"
              className="w-full rounded-full mt-4"
              asChild
            >
              <a href="mailto:jp@jeevanpillay.com">CONTACT</a>
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `pnpm --filter www typecheck`
- [x] Linting passes: `pnpm --filter www lint` (pitch-deck files lint clean)
- [ ] Page route exists and renders: Check `/pitch-deck` returns 200

#### Manual Verification:
- [ ] Logo links to homepage
- [ ] Menu button opens dropdown
- [ ] Dropdown links navigate correctly
- [ ] Contact sends email to `jp@jeevanpillay.com`
- [ ] Navbar is fixed and stays on top during scroll

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to the next phase.

---

## Phase 2: Scroll-Stacking Animation Component

### Overview
Create the core pitch deck component with framer-motion scroll animations.

### Changes Required:

#### 1. Create pitch deck container
**File**: `apps/www/src/components/pitch-deck/pitch-deck.tsx`
**Changes**: Main component with scroll-driven animation logic

```tsx
"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { cn } from "@repo/ui/lib/utils";
import { PITCH_SLIDES } from "./pitch-deck-data";

export function PitchDeck() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  return (
    <div
      ref={containerRef}
      className="relative"
      style={{ height: `${(PITCH_SLIDES.length + 1) * 100}vh` }}
    >
      <div className="sticky top-0 h-screen flex items-center justify-center overflow-hidden">
        <div className="relative w-full max-w-5xl mx-auto px-6">
          {PITCH_SLIDES.map((slide, index) => (
            <PitchSlide
              key={slide.id}
              slide={slide}
              index={index}
              totalSlides={PITCH_SLIDES.length}
              scrollProgress={scrollYProgress}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

interface PitchSlideProps {
  slide: (typeof PITCH_SLIDES)[number];
  index: number;
  totalSlides: number;
  scrollProgress: ReturnType<typeof useScroll>["scrollYProgress"];
}

function PitchSlide({ slide, index, totalSlides, scrollProgress }: PitchSlideProps) {
  // Calculate when this slide should animate
  // Each slide gets an equal portion of the scroll
  const slideStart = index / totalSlides;
  const slideEnd = (index + 1) / totalSlides;

  // Transform values based on scroll position
  // When slide is current: scale=1, y=0, opacity=1
  // When slide is 1 behind: scale=0.95, y=-30, opacity=0.8
  // When slide is 2 behind: scale=0.90, y=-50, opacity=0.5
  // When slide is 3+ behind: scale=0.85, y=-60, opacity=0

  const y = useTransform(
    scrollProgress,
    [
      slideStart - 0.3,  // Start coming in from below
      slideStart,        // Arrive at center
      slideEnd,          // Start moving back
      slideEnd + 0.1,    // Move further back
      slideEnd + 0.2,    // Move even further
      slideEnd + 0.3,    // Fade out
    ],
    [
      "100%",   // Below viewport
      "0%",     // At center
      "-3%",    // Slightly up (1 behind)
      "-5%",    // More up (2 behind)
      "-6%",    // Even more (3 behind)
      "-6%",    // Stay there while fading
    ]
  );

  const scale = useTransform(
    scrollProgress,
    [
      slideStart - 0.3,
      slideStart,
      slideEnd,
      slideEnd + 0.1,
      slideEnd + 0.2,
      slideEnd + 0.3,
    ],
    [1, 1, 0.95, 0.90, 0.85, 0.85]
  );

  const opacity = useTransform(
    scrollProgress,
    [
      slideStart - 0.3,
      slideStart - 0.1,
      slideStart,
      slideEnd + 0.1,
      slideEnd + 0.2,
      slideEnd + 0.3,
    ],
    [0, 1, 1, 0.8, 0.5, 0]
  );

  const zIndex = useTransform(
    scrollProgress,
    [slideStart, slideEnd, slideEnd + 0.01],
    [totalSlides - index, totalSlides - index, totalSlides - index - 1]
  );

  return (
    <motion.div
      style={{
        y,
        scale,
        opacity,
        zIndex,
      }}
      className="absolute inset-0 will-change-transform"
    >
      <div
        className={cn(
          "w-full aspect-[16/10] rounded-2xl overflow-hidden shadow-2xl",
          slide.bgColor
        )}
      >
        <div className="h-full p-8 sm:p-12 flex flex-col justify-between">
          {/* Slide content will be rendered based on slide.type */}
          <SlideContent slide={slide} />
        </div>
      </div>
    </motion.div>
  );
}

function SlideContent({ slide }: { slide: (typeof PITCH_SLIDES)[number] }) {
  switch (slide.type) {
    case "title":
      return (
        <>
          <div className="flex-1 flex items-center justify-center">
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-center">
              {slide.title}
            </h1>
          </div>
          {slide.subtitle && (
            <p className="text-sm text-center opacity-70">{slide.subtitle}</p>
          )}
        </>
      );
    case "content":
      return (
        <>
          <h2 className="text-2xl sm:text-3xl font-light">{slide.title}</h2>
          <div className="flex-1 flex flex-col justify-end">
            <div className="grid grid-cols-2 gap-8">
              {slide.leftText && (
                <p className="text-xs uppercase tracking-wider opacity-70">
                  {slide.leftText}
                </p>
              )}
              {slide.rightText && (
                <div className="space-y-4">
                  {Array.isArray(slide.rightText) ? (
                    slide.rightText.map((text, i) => (
                      <p key={i} className="text-sm border-b border-current/20 pb-2">
                        {text}
                      </p>
                    ))
                  ) : (
                    <p className="text-sm">{slide.rightText}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      );
    default:
      return null;
  }
}
```

#### 2. Create slide data file
**File**: `apps/www/src/components/pitch-deck/pitch-deck-data.ts`
**Changes**: Slide content based on VC research

```ts
export const PITCH_SLIDES = [
  {
    id: "title",
    type: "title" as const,
    title: "LIGHTFAST",
    subtitle: "Pitch deck 2026 —",
    bgColor: "bg-[#8B3A3A]", // Terracotta red like the reference
  },
  {
    id: "intro",
    type: "content" as const,
    title: "Hi, we are Lightfast.",
    leftText: "HERE'S HOW WE GOT FROM 0 TO 30",
    rightText: [
      "The memory layer for software teams.",
      "We help engineering teams search, discover, and trace context across their entire codebase and tooling.",
    ],
    bgColor: "bg-[#F5F5F0]", // Light cream/white
    textColor: "text-foreground",
  },
  {
    id: "problem",
    type: "content" as const,
    title: "The Problem.",
    leftText: "CONTEXT IS SCATTERED",
    rightText: [
      "Engineers spend 30% of their time searching for context",
      "Knowledge lives in Slack, GitHub, Notion, Linear—disconnected",
      "When engineers leave, institutional knowledge walks out the door",
      "AI agents can't access the context they need to be effective",
    ],
    bgColor: "bg-[#F5F5F0]",
    textColor: "text-foreground",
  },
  {
    id: "solution",
    type: "content" as const,
    title: "Our Solution.",
    leftText: "A UNIFIED MEMORY LAYER",
    rightText: [
      "Connect all your engineering tools in minutes",
      "Semantic search across your entire knowledge base",
      "Trace any decision back to its source",
      "Give AI agents the context they need",
    ],
    bgColor: "bg-[#F5F5F0]",
    textColor: "text-foreground",
  },
  {
    id: "traction",
    type: "content" as const,
    title: "Early Traction.",
    leftText: "SIGNALS OF PRODUCT-MARKET FIT",
    rightText: [
      "500+ engineers on waitlist",
      "3 design partners in active pilots",
      "40% week-over-week search volume growth",
      "NPS of 72 from pilot users",
    ],
    bgColor: "bg-[#F5F5F0]",
    textColor: "text-foreground",
  },
  {
    id: "team",
    type: "content" as const,
    title: "The Team.",
    leftText: "FOUNDERS WITH DEEP EXPERIENCE",
    rightText: [
      "Previously built developer tools at scale",
      "Combined 15+ years in AI/ML infrastructure",
      "Deep technical background with product sensibility",
      "Network across Australian and global tech ecosystem",
    ],
    bgColor: "bg-[#F5F5F0]",
    textColor: "text-foreground",
  },
  {
    id: "ask",
    type: "content" as const,
    title: "The Ask.",
    leftText: "RAISING $1.5M SEED",
    rightText: [
      "12-18 months runway",
      "Expand engineering team (2 → 5)",
      "Launch public beta",
      "Reach $50K MRR milestone",
    ],
    bgColor: "bg-[#F5F5F0]",
    textColor: "text-foreground",
  },
  {
    id: "vision",
    type: "title" as const,
    title: "Every team deserves a perfect memory.",
    subtitle: "jp@jeevanpillay.com",
    bgColor: "bg-[#8B3A3A]",
  },
] as const;
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `pnpm --filter www typecheck`
- [x] Linting passes: `pnpm --filter www lint` (pitch-deck files lint clean)

#### Manual Verification:
- [ ] Scroll down triggers slides to stack
- [ ] Scroll up reverses the animation smoothly
- [ ] Maximum 3 slides visible at any time
- [ ] First slide disappears when 4th arrives
- [ ] Animation is smooth (60fps, no jank)
- [ ] Slide content is readable and properly styled

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to the next phase.

---

## Phase 3: Visual Polish & Responsive Design

### Overview
Add visual refinements, progress indicator, and ensure responsive behavior.

### Changes Required:

#### 1. Add slide progress indicator
**File**: `apps/www/src/components/pitch-deck/pitch-deck.tsx`
**Changes**: Add vertical dots indicator on the right side

```tsx
// Add inside PitchDeck component, after the slides container
function SlideIndicator({
  totalSlides,
  scrollProgress
}: {
  totalSlides: number;
  scrollProgress: ReturnType<typeof useScroll>["scrollYProgress"];
}) {
  return (
    <div className="fixed right-8 top-1/2 -translate-y-1/2 z-50 flex flex-col gap-2">
      {Array.from({ length: totalSlides }).map((_, index) => {
        const slideStart = index / totalSlides;
        const slideEnd = (index + 1) / totalSlides;

        const isActive = useTransform(
          scrollProgress,
          [slideStart - 0.05, slideStart, slideEnd - 0.05, slideEnd],
          [0, 1, 1, 0]
        );

        return (
          <motion.div
            key={index}
            style={{ opacity: isActive }}
            className="w-0.5 h-4 bg-foreground/30"
          >
            <motion.div
              className="w-full bg-foreground"
              style={{ height: isActive }}
            />
          </motion.div>
        );
      })}
    </div>
  );
}
```

#### 2. Improve slide styling
**File**: `apps/www/src/components/pitch-deck/pitch-deck.tsx`
**Changes**: Add grid pattern to title slides, improve text contrast

```tsx
// Update SlideContent for title type
case "title":
  return (
    <>
      {/* Grid pattern overlay for title slides */}
      <div
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: `
            linear-gradient(to right, currentColor 1px, transparent 1px),
            linear-gradient(to bottom, currentColor 1px, transparent 1px)
          `,
          backgroundSize: '80px 80px',
        }}
      />
      <div className="relative flex-1 flex items-center justify-center">
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-center tracking-tight">
          {slide.title}
          {slide.id === "title" && (
            <span className="inline-block w-3 h-8 bg-current ml-2 animate-pulse" />
          )}
        </h1>
      </div>
      {slide.subtitle && (
        <p className="relative text-sm opacity-70">{slide.subtitle}</p>
      )}
    </>
  );
```

#### 3. Add responsive breakpoints
**File**: `apps/www/src/components/pitch-deck/pitch-deck.tsx`
**Changes**: Ensure proper sizing on mobile

```tsx
// Update the main container
<div className="relative w-full max-w-5xl mx-auto px-4 sm:px-6">
  {/* Update slide card */}
  <div
    className={cn(
      "w-full aspect-[4/3] sm:aspect-[16/10] rounded-xl sm:rounded-2xl overflow-hidden shadow-2xl",
      slide.bgColor
    )}
  >
    <div className="h-full p-6 sm:p-8 md:p-12 flex flex-col justify-between">
      <SlideContent slide={slide} />
    </div>
  </div>
</div>
```

#### 4. Update navbar for mobile
**File**: `apps/www/src/components/pitch-deck/pitch-deck-navbar.tsx`
**Changes**: Responsive menu positioning

```tsx
// Update the header for mobile
<header className="fixed top-0 left-0 right-0 z-50 py-3 sm:py-4 px-4 sm:px-6">
  {/* Hide CONTACT on mobile, show in menu instead */}
  <a
    href="mailto:jp@jeevanpillay.com"
    className="hidden sm:block text-sm text-foreground hover:text-muted-foreground transition-colors"
  >
    CONTACT
  </a>
</header>
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `pnpm --filter www typecheck`
- [x] Linting passes: `pnpm --filter www lint`

#### Manual Verification:
- [ ] Progress indicator shows current slide position
- [ ] Grid pattern visible on title slides
- [ ] Text is readable on all slide types
- [ ] Mobile view maintains aspect ratio and readability
- [ ] Navbar menu works on mobile
- [ ] Animation performance is smooth on mobile

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to the next phase.

---

## Phase 4: Edge Cases & Accessibility

### Overview
Handle keyboard navigation, screen reader support, and edge cases.

### Changes Required:

#### 1. Add keyboard navigation
**File**: `apps/www/src/components/pitch-deck/pitch-deck.tsx`
**Changes**: Arrow keys to navigate slides

```tsx
"use client";

import { useRef, useEffect, useCallback } from "react";

// Inside PitchDeck component
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    const scrollAmount = window.innerHeight;

    if (e.key === "ArrowDown" || e.key === " " || e.key === "PageDown") {
      e.preventDefault();
      window.scrollBy({ top: scrollAmount, behavior: "smooth" });
    }
    if (e.key === "ArrowUp" || e.key === "PageUp") {
      e.preventDefault();
      window.scrollBy({ top: -scrollAmount, behavior: "smooth" });
    }
    if (e.key === "Home") {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    if (e.key === "End") {
      e.preventDefault();
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
    }
  };

  window.addEventListener("keydown", handleKeyDown);
  return () => window.removeEventListener("keydown", handleKeyDown);
}, []);
```

#### 2. Add ARIA labels and semantic HTML
**File**: `apps/www/src/components/pitch-deck/pitch-deck.tsx`
**Changes**: Improve accessibility

```tsx
// Wrap slides in proper semantic structure
<main aria-label="Pitch Deck Presentation">
  <div
    ref={containerRef}
    className="relative"
    style={{ height: `${(PITCH_SLIDES.length + 1) * 100}vh` }}
  >
    <div
      className="sticky top-0 h-screen flex items-center justify-center overflow-hidden"
      role="region"
      aria-label="Slide viewer"
    >
      {/* slides */}
    </div>
  </div>
</main>

// Each slide should have
<motion.article
  aria-label={`Slide ${index + 1} of ${totalSlides}: ${slide.title}`}
  aria-hidden={/* when not visible */}
>
```

#### 3. Handle menu escape key
**File**: `apps/www/src/components/pitch-deck/pitch-deck-navbar.tsx`
**Changes**: Close menu on Escape key

```tsx
useEffect(() => {
  const handleEscape = (e: KeyboardEvent) => {
    if (e.key === "Escape" && isMenuOpen) {
      setIsMenuOpen(false);
    }
  };

  window.addEventListener("keydown", handleEscape);
  return () => window.removeEventListener("keydown", handleEscape);
}, [isMenuOpen]);
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `pnpm --filter www typecheck`
- [x] Linting passes: `pnpm --filter www lint`

#### Manual Verification:
- [ ] Arrow Down / Space advances to next slide
- [ ] Arrow Up goes to previous slide
- [ ] Home goes to first slide
- [ ] End goes to last slide
- [ ] Escape closes the menu
- [ ] Screen reader announces slide changes
- [ ] Tab navigation works through interactive elements

**Implementation Note**: After completing this phase, perform final end-to-end testing.

---

## Testing Strategy

### Unit Tests:
- Not required for this visual component (framer-motion animations are difficult to unit test)

### Integration Tests:
- Not required for initial implementation

### Manual Testing Steps:
1. Navigate to `/pitch-deck` and verify initial slide loads
2. Scroll down slowly and verify smooth stacking animation
3. Scroll to end and verify all slides displayed correctly
4. Scroll back up and verify reverse animation works
5. Test keyboard navigation (Arrow keys, Space, Home, End)
6. Test on mobile viewport (Chrome DevTools device mode)
7. Test menu open/close and navigation
8. Test Contact link opens email client
9. Verify no console errors during interaction

## Performance Considerations

- Use `will-change-transform` on animated elements
- Limit to 3 visible slides to reduce DOM complexity
- Use `opacity: 0` to hide off-screen slides (better than `display: none` for animations)
- Consider using `useTransform` with output range clamping to prevent unnecessary recalculations

## Migration Notes

N/A - New page with no existing data to migrate.

## References

- Original research: `thoughts/shared/research/2026-01-22-web-analysis-seed-pitch-deck-vc-guidance.md`
- Reference design: Flabbergast portfolio (screenshots provided)
- Framer Motion scroll animations: https://www.framer.com/motion/scroll-animations/
- Existing navbar pattern: `apps/www/src/components/app-navbar.tsx:11-58`
- Existing card styling: `apps/www/src/components/platform-access-cards.tsx:39-74`
