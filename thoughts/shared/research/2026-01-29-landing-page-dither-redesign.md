---
date: 2026-01-29T12:00:00+08:00
researcher: Claude
git_commit: 7f4be19dce56084d0b5d45b7a54ab38680b158e8
branch: main
repository: lightfast
topic: "Landing Page Redesign with Blue/White Dither Effect"
tags: [research, codebase, landing-page, www, dither, design]
status: complete
last_updated: 2026-01-29
last_updated_by: Claude
---

# Research: Landing Page Redesign with Blue/White Dither Effect

**Date**: 2026-01-29T12:00:00+08:00
**Researcher**: Claude
**Git Commit**: 7f4be19dce56084d0b5d45b7a54ab38680b158e8
**Branch**: main
**Repository**: lightfast

## Research Question

Rework the www landing page structure to accommodate a blue/white dither effect as the core visual feature. Create an ASCII wireframe documenting the proposed structure.

## Summary

The current landing page at `apps/www/src/app/(app)/(marketing)/(landing)/page.tsx` has a multi-section layout with hero, platform access cards, search demo, integrations, FAQ, changelog, and CTA sections. The proposed redesign centers the blue/white dither effect (similar to the `blue-sky.webp` gradient) as the hero visual, with content layered on top.

## Current Landing Page Structure

### File Location
- **Page**: `apps/www/src/app/(app)/(marketing)/(landing)/page.tsx`
- **Layout**: `apps/www/src/app/(app)/(marketing)/layout.tsx`

### Current Section Order
1. **Hero Section** - Centered heading + CTA (lines 177-221)
2. **Platform Access Cards** - 3-column grid (line 224)
3. **Search Demo** - Visual showcase with blurred background (lines 227-231)
4. **Integration Showcase** - Logo grid (lines 234-243)
5. **FAQ Section** - Accordion (lines 246-248)
6. **Changelog Preview** - Cards grid (lines 268-270)
7. **Waitlist CTA** - Full-width section (line 280)

### Key Components
| Component | File | Purpose |
|-----------|------|---------|
| `VisualShowcase` | `visual-showcase.tsx` | Container with blurred background image |
| `SearchDemo` | `search-demo.tsx` | Mock search interface |
| `PlatformAccessCards` | `platform-access-cards.tsx` | 3-column access links |
| `IntegrationShowcase` | `integration-showcase.tsx` | Logo grid |
| `FAQSection` | `faq-section.tsx` | Accordion FAQ |
| `ChangelogPreview` | `changelog-preview.tsx` | CMS-driven changelog cards |
| `WaitlistCTA` | `waitlist-cta.tsx` | Large CTA section |
| `AppNavbar` | `app-navbar.tsx` | Navigation header |
| `AppFooter` | `app-footer.tsx` | Footer with links |

### Reference Images
- `apps/www/public/images/blue-sky.webp` - Blue/white gradient background
- `apps/www/public/og.jpg` - OG image with L/ logo on blue gradient

## ASCII Wireframe: New Structure with Dither Effect

```
+==============================================================================+
|                              VIEWPORT (100vh)                                 |
+==============================================================================+

+------------------------------------------------------------------------------+
|  [NAVBAR - TRANSPARENT/OVERLAY]                                              |
|  +--------+                                              +--------+--------+ |
|  |  L/    |              [Nav Menu - Hidden on Mobile]   | Search | Log In | |
|  +--------+                                              +--------+--------+ |
+------------------------------------------------------------------------------+

+------------------------------------------------------------------------------+
|                                                                              |
|                     ████████████████████████████████████                     |
|                     █                                  █                     |
|                     █   DITHER EFFECT BACKGROUND       █                     |
|                     █   (Blue ←→ White Gradient)       █                     |
|                     █                                  █                     |
|                     █   ┌─────────────────────────┐    █                     |
|                     █   │                         │    █                     |
|                     █   │    HERO CONTENT LAYER   │    █                     |
|                     █   │                         │    █                     |
|                     █   │   "The memory layer     │    █                     |
|                     █   │    for software teams"  │    █                     |
|                     █   │                         │    █                     |
|                     █   │   [Search everything    │    █                     |
|                     █   │    your engineering     │    █                     |
|                     █   │    org knows]           │    █                     |
|                     █   │                         │    █                     |
|                     █   │   ┌──────────────────┐  │    █                     |
|                     █   │   │ Join Early Access│  │    █                     |
|                     █   │   └──────────────────┘  │    █                     |
|                     █   │                         │    █                     |
|                     █   │   Learn more →          │    █                     |
|                     █   │                         │    █                     |
|                     █   └─────────────────────────┘    █                     |
|                     █                                  █                     |
|                     ████████████████████████████████████                     |
|                                                                              |
+------------------------------------------------------------------------------+
                              HERO SECTION (min-h-screen)

  Structure:
  - position: relative
  - Background: DitherCanvas component (full section)
  - Content: absolute/centered overlay


+------------------------------------------------------------------------------+
|                          CONTENT SECTIONS                                     |
|  (Standard bg-background, normal flow)                                        |
+------------------------------------------------------------------------------+

┌──────────────────────────────────────────────────────────────────────────────┐
│                         PLATFORM ACCESS CARDS                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐               │
│  │   Have Access?  │  │   API Platform  │  │      Docs       │               │
│  │   Go to App...  │  │   Use our APIs  │  │   Learn how...  │               │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘               │
│                                                                               │
│                           max-w-6xl · gap-6                                   │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│                           SEARCH DEMO SECTION                                 │
│  ┌──────────────────────────────────────────────────────────────────┐        │
│  │  Visual Showcase Container (rounded, bg-accent, blurred bg)      │        │
│  │  ┌─────────────────────────────────────────────────────────────┐ │        │
│  │  │ lightfast.search(                                           │ │        │
│  │  │   "How does our authentication service work?"               │ │        │
│  │  │ )                                                           │ │        │
│  │  ├─────────────────────────────────────────────────────────────┤ │        │
│  │  │ ○ Authentication service architecture decision              │ │        │
│  │  │   github.com/lightfast/backend | 3 days ago                 │ │        │
│  │  │ ○ API rate limiting implementation - PR #842                │ │        │
│  │  │   github.com/lightfast/api | 1 week ago                     │ │        │
│  │  │ ○ User authentication flow diagram                          │ │        │
│  │  │   notion.so/lightfast/docs | 2 weeks ago                    │ │        │
│  │  └─────────────────────────────────────────────────────────────┘ │        │
│  └──────────────────────────────────────────────────────────────────┘        │
│                                                                               │
│                         max-w-6xl · min-h-[850px]                             │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│                        INTEGRATION SHOWCASE                                   │
│         "Lightfast integrates with the tools you use"                         │
│                                                                               │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐                      │
│  │ GitHub │ │ Notion │ │Airtable│ │ Linear │ │ Slack  │                      │
│  └────────┘ └────────┘ └────────┘ └────────┘ └────────┘                      │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐                      │
│  │Discord │ │ Sentry │ │PostHog │ │Datadog │ │ Vercel │                      │
│  └────────┘ └────────┘ └────────┘ └────────┘ └────────┘                      │
│                                                                               │
│               grid-cols-5 (responsive: 2→3→4→5) · gap-4                       │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│                              FAQ SECTION                                      │
│  ┌──────┐  ┌─────────────────────────────────────────────────────────────┐   │
│  │ FAQs │  │  Learn how Lightfast works.         Ready to get started?   │   │
│  │      │  │                                     Join early access →      │   │
│  │      │  ├─────────────────────────────────────────────────────────────┤   │
│  │      │  │ ▼ What is Lightfast?                                        │   │
│  │      │  │   Lightfast is a memory layer for software teams...         │   │
│  │      │  ├─────────────────────────────────────────────────────────────┤   │
│  │      │  │ ▶ How is this different from regular search?                │   │
│  │      │  ├─────────────────────────────────────────────────────────────┤   │
│  │      │  │ ▶ What is the memory layer?                                 │   │
│  │      │  ├─────────────────────────────────────────────────────────────┤   │
│  │      │  │ ▶ What tools and platforms do you integrate with?           │   │
│  │      │  └─────────────────────────────────────────────────────────────┘   │
│  └──────┘                                                                     │
│                                                                               │
│                    grid-cols-12 (2 + 10) · Accordion                          │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│                          CHANGELOG PREVIEW                                    │
│                                                                               │
│  Changelog                                                                    │
│  Stay up to date with the latest improvements and updates                     │
│                                                                               │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐               │
│  │ v1.2 · Jan 15   │  │ v1.1 · Jan 10   │  │ v1.0 · Jan 5    │               │
│  │ Feature Title   │  │ Feature Title   │  │ Feature Title   │               │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘               │
│                                                                               │
│                  grid-cols-3 (responsive: 1→2→3) · gap-4                      │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│                            WAITLIST CTA                                       │
│                         (bg-card · rounded-xs)                                │
│                                                                               │
│                                                                               │
│                        Try Lightfast now.                                     │
│                     (text-7xl · font-light)                                   │
│                                                                               │
│                    ┌──────────────────────┐                                   │
│                    │  Join Early Access   │                                   │
│                    └──────────────────────┘                                   │
│                                                                               │
│                              py-56                                            │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│                              FOOTER                                           │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐            │
│  │   Product   │ │  Platform   │ │  Resources  │ │ Developers  │            │
│  │   Pricing   │ │   Sign In   │ │    Docs     │ │  SDKs       │            │
│  │  Changelog  │ │  Chat Demo  │ │ API Ref     │ │  Auth       │            │
│  │ Early Access│ │             │ │  Blog       │ │  GitHub     │            │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘            │
│                                                                               │
│  ┌─────────────┐                                                              │
│  │   Company   │  Have questions? → hello@lightfast.ai                        │
│  │    Terms    │                                                              │
│  │   Privacy   │  [GitHub] [Discord] [Twitter]   Lightfast Inc. © 2026       │
│  └─────────────┘                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Detailed Hero Section Structure (Dither Focus)

```
+==============================================================================+
|                         HERO SECTION - DETAILED VIEW                          |
+==============================================================================+

<section className="relative min-h-screen overflow-hidden">

  ┌──────────────────────────────────────────────────────────────────────────┐
  │                      LAYER 1: DITHER BACKGROUND                          │
  │                      (position: absolute, inset: 0)                      │
  │                                                                          │
  │   ┌────────────────────────────────────────────────────────────────┐     │
  │   │                                                                │     │
  │   │                    <DitherCanvas />                             │     │
  │   │                                                                │     │
  │   │    Props:                                                      │     │
  │   │    - colorA: "#00A3FF" (lightfast blue)                        │     │
  │   │    - colorB: "#FFFFFF" (white)                                 │     │
  │   │    - pattern: "gradient" | "noise" | "waves"                   │     │
  │   │    - animated: boolean                                         │     │
  │   │                                                                │     │
  │   │    For now: Simple blue solid bg                               │     │
  │   │    className="bg-[#00A3FF]" or similar                         │     │
  │   │                                                                │     │
  │   └────────────────────────────────────────────────────────────────┘     │
  │                                                                          │
  │   z-index: 0                                                             │
  └──────────────────────────────────────────────────────────────────────────┘

  ┌──────────────────────────────────────────────────────────────────────────┐
  │                      LAYER 2: CONTENT OVERLAY                            │
  │              (position: relative, z-index: 10)                           │
  │                                                                          │
  │   <div className="relative z-10 flex min-h-screen items-center          │
  │                   justify-center px-4">                                  │
  │                                                                          │
  │     ┌─────────────────────────────────────────────────────────────┐      │
  │     │                                                             │      │
  │     │   <div className="text-center max-w-4xl">                   │      │
  │     │                                                             │      │
  │     │     ┌─────────────────────────────────────────────────┐     │      │
  │     │     │              HEADING                             │     │      │
  │     │     │   "The memory layer for software teams"          │     │      │
  │     │     │                                                  │     │      │
  │     │     │   className:                                     │     │      │
  │     │     │   - text-4xl md:text-5xl lg:text-6xl             │     │      │
  │     │     │   - font-light (exposureTrial)                   │     │      │
  │     │     │   - text-white (contrast on blue)                │     │      │
  │     │     └─────────────────────────────────────────────────┘     │      │
  │     │                                                             │      │
  │     │     ┌─────────────────────────────────────────────────┐     │      │
  │     │     │              SUBHEADING                          │     │      │
  │     │     │   "Search everything your engineering            │     │      │
  │     │     │    org knows"                                    │     │      │
  │     │     │                                                  │     │      │
  │     │     │   className:                                     │     │      │
  │     │     │   - text-base md:text-lg                         │     │      │
  │     │     │   - text-white/80                                │     │      │
  │     │     └─────────────────────────────────────────────────┘     │      │
  │     │                                                             │      │
  │     │     ┌─────────────────────────────────────────────────┐     │      │
  │     │     │              CTA BUTTONS                         │     │      │
  │     │     │                                                  │     │      │
  │     │     │   ┌────────────────────────┐                     │     │      │
  │     │     │   │   Join Early Access    │  (Primary)          │     │      │
  │     │     │   │   bg-white text-blue   │                     │     │      │
  │     │     │   └────────────────────────┘                     │     │      │
  │     │     │                                                  │     │      │
  │     │     │   Learn more about Lightfast →                   │     │      │
  │     │     │   (text-white/80 hover:text-white)               │     │      │
  │     │     └─────────────────────────────────────────────────┘     │      │
  │     │                                                             │      │
  │     │   </div>                                                    │      │
  │     │                                                             │      │
  │     └─────────────────────────────────────────────────────────────┘      │
  │                                                                          │
  │   </div>                                                                 │
  │                                                                          │
  │   z-index: 10                                                            │
  └──────────────────────────────────────────────────────────────────────────┘

</section>
```

## Component Structure for Implementation

```
apps/www/src/
├── app/(app)/(marketing)/(landing)/
│   └── page.tsx                    # Main landing page
│
├── components/
│   ├── landing/
│   │   ├── hero-section.tsx        # NEW: Hero with dither bg
│   │   ├── dither-background.tsx   # NEW: Placeholder for dither effect
│   │   └── ... (existing visuals)
│   │
│   ├── visual-showcase.tsx         # Keep for search demo
│   ├── search-demo.tsx             # Keep
│   ├── platform-access-cards.tsx   # Keep
│   ├── integration-showcase.tsx    # Keep
│   ├── faq-section.tsx             # Keep
│   ├── changelog-preview.tsx       # Keep
│   └── waitlist-cta.tsx            # Keep
```

## Code References

- `apps/www/src/app/(app)/(marketing)/(landing)/page.tsx:171-283` - Current landing page render
- `apps/www/src/app/(app)/(marketing)/layout.tsx:1-27` - Marketing layout with navbar/footer
- `apps/www/src/components/visual-showcase.tsx:1-54` - Background image showcase pattern
- `apps/www/src/components/app-navbar.tsx:1-63` - Navigation component
- `apps/www/src/components/waitlist-cta.tsx:1-23` - CTA section pattern

## Architecture Documentation

### Layout Hierarchy
```
marketing/layout.tsx
├── AppNavbar (sticky, z-50, bg-background)
├── main (flex-1, py-16, bg-background)
│   └── (landing)/page.tsx
│       ├── Hero Section (gap-20 from next section)
│       ├── Platform Cards
│       ├── Search Demo
│       ├── Integrations
│       ├── FAQ
│       └── Changelog
├── WaitlistCTA (outside main padding)
└── AppFooter
```

### Current Spacing Pattern
- Container: `max-w-6xl mx-auto px-4`
- Section gap: `gap-20` (80px)
- Inner padding: `py-10` per section

### Color Tokens (for dither)
- Primary blue (from og.jpg): Gradient from cyan (#00CFFF) to blue (#00A3FF)
- White: #FFFFFF
- Background: `bg-background` (CSS variable)

## Open Questions

1. **Dither Implementation**: Will use WebGL canvas, CSS, or pre-rendered image?
2. **Animation**: Should the dither effect be animated or static?
3. **Navbar Behavior**: Should navbar be transparent over hero, then solid on scroll?
4. **Mobile Considerations**: How does dither effect perform on mobile devices?
5. **Accessibility**: Ensure sufficient contrast for text over dithered background
