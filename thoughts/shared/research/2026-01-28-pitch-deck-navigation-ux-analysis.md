---
date: 2026-01-28T18:15:00+08:00
researcher: Claude
git_commit: f1113fb08265fbb7a8e9073838e8ec9f23260789
branch: feat/pitch-deck-page
repository: lightfastai/lightfast
topic: "Pitch Deck Navigation UX Analysis - Current State and Patterns"
tags: [research, pitch-deck, ux, navigation, scroll-indicators, accessibility]
status: complete
last_updated: 2026-01-28
last_updated_by: Claude
---

# Research: Pitch Deck Navigation UX Analysis

**Date**: 2026-01-28T18:15:00+08:00
**Researcher**: Claude
**Git Commit**: f1113fb08265fbb7a8e9073838e8ec9f23260789
**Branch**: feat/pitch-deck-page
**Repository**: lightfastai/lightfast

## Research Question

Consider UI/UX issues in the pitch-deck directory. Specifically:
1. Need for next/prev slide buttons if users don't realize they need to scroll
2. Scroll indicator pattern (like the "SCROLL" text with animated diamond indicator shown in the reference image)
3. Optimal positioning for navigation controls
4. Other potential UX issues

## Summary

The current pitch-deck implementation uses a **scroll-driven presentation** with keyboard navigation support and a right-side line indicator. However, it lacks explicit visual cues for first-time users who may not realize they need to scroll. The reference image shows a centered "SCROLL" indicator with an animated diamond chevron—a common pattern for scroll-driven presentations.

## Current Implementation State

### Navigation Controls Inventory

| Control | Location | Implementation |
|---------|----------|----------------|
| **SlideIndicator** | Right edge, vertically centered | Animated horizontal lines that expand/fade based on scroll position |
| **Keyboard Navigation** | Global listener | ArrowDown/Space/PageDown (next), ArrowUp/PageUp (prev), Home/End |
| **Grid Item Click** | Grid view overlay | Clicking a thumbnail scrolls to that slide |
| **Indicator Line Click** | Right edge | Clicking a line scrolls to that slide |
| **"Back to Home" Link** | Bottom center | Link to "/" (fades out in grid view) |

### File Locations

- `apps/www/src/app/(app)/(internal)/pitch-deck/_components/pitch-deck.tsx:44-71` - Keyboard navigation implementation
- `apps/www/src/app/(app)/(internal)/pitch-deck/_components/pitch-deck.tsx:223-290` - SlideIndicator component
- `apps/www/src/app/(app)/(internal)/pitch-deck/_components/pitch-deck.tsx:113-127` - "Back to Home" link

### Keyboard Navigation Details

```typescript
// pitch-deck.tsx:44-71
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
      window.scrollTo({
        top: document.body.scrollHeight,
        behavior: "smooth",
      });
    }
  };

  window.addEventListener("keydown", handleKeyDown);
  return () => window.removeEventListener("keydown", handleKeyDown);
}, []);
```

**Supported Keys**:
- `ArrowDown`, `Space`, `PageDown` → Next slide
- `ArrowUp`, `PageUp` → Previous slide
- `Home` → First slide
- `End` → Last slide (triggers grid view)

### SlideIndicator Component

```typescript
// pitch-deck.tsx:223-254
function SlideIndicator({
  totalSlides,
  scrollProgress,
  isGridView,
  onDotClick,
}: {...}) {
  return (
    <motion.div
      className="fixed right-6 top-1/2 -translate-y-1/2 z-50 flex flex-col items-end gap-2"
      animate={{
        opacity: isGridView ? 0 : 1,
        pointerEvents: isGridView ? "none" : "auto",
      }}
      transition={{ duration: 0.2 }}
    >
      {Array.from({ length: totalSlides }).map((_, index) => (
        <IndicatorLine
          key={index}
          index={index}
          totalSlides={totalSlides}
          scrollProgress={scrollProgress}
          onClick={() => onDotClick(index)}
        />
      ))}
    </motion.div>
  );
}
```

**Visual Behavior**:
- Lines expand from 24px to 40px when active
- Opacity transitions from 0.3 (inactive) to 1 (active)
- Positioned `fixed right-6 top-1/2 -translate-y-1/2`
- Hidden during grid view

## What's Missing

### 1. No Scroll Affordance for First-Time Users

There is no visual indication that users should scroll to navigate. Users unfamiliar with scroll-driven presentations may:
- Not realize the content is navigable
- Try clicking on the slide expecting navigation
- Look for explicit buttons

**Reference Pattern (from provided image)**:
```
        SCROLL
          │
          ◇   ← Animated diamond/chevron
          │
          ⋮   ← Dotted line suggesting direction
```

### 2. No Next/Previous Buttons

While keyboard navigation exists, there are no visible clickable buttons for:
- Users who prefer mouse interaction
- Mobile users who may not think to swipe
- Accessibility users who may need visible controls

### 3. No Keyboard Shortcut Hints

The keyboard shortcuts (arrows, space, etc.) are not communicated to users anywhere in the UI.

### 4. No Progress Feedback Beyond Indicator Lines

The only visual progress indicator is the right-side lines. There is no:
- Slide counter (e.g., "3 / 10")
- Horizontal progress bar
- Current slide title display

## Industry Patterns for Scroll-Driven Presentations

### Scroll Hint Indicators

**Common Implementations**:

1. **Animated Chevron Pattern**
   - Position: Fixed, bottom center (`bottom: 4-5vh`, `left: 50%`)
   - Animation: Two-phase (fade-in, then pulse/bounce)
   - Behavior: Disappears after first scroll
   - Example CSS:
   ```css
   .scroll-hint {
     position: fixed;
     bottom: 5vh;
     left: 50%;
     transform: translateX(-50%);
     animation:
       fadeSlideUp 1s ease-out 2s forwards,
       pulse 2s ease-in-out 3s infinite;
   }
   ```

2. **"SCROLL" Text with Arrow**
   - Uppercase text label
   - Animated arrow/chevron below
   - Often with subtle bouncing animation

3. **Mouse Icon with Scroll Wheel**
   - Animated scroll wheel movement
   - More common on marketing sites

### Navigation Controls

**fullpage.js Pattern**:
- Vertical dots on right side (similar to current implementation)
- Optional control arrows for explicit navigation
- Keyboard support enabled by default

**reveal.js Pattern**:
- Corner-positioned navigation arrows
- Slide counter display
- ESC for overview mode

### Accessibility Considerations

- `prefers-reduced-motion` media query support
- ARIA labels on navigation controls
- Focus management when navigating
- Skip links for keyboard users

## Current Layout Structure

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Header (fixed z-50)                                                          │
│ [LOGO] [⊏]          [MENU ▾]          [↓] CONTACT                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────┐   ┌────────────────────────────────────────────┐      │
│  │                  │   │                                            │  │   │
│  │  Founder's Note  │   │                                            │  │   │
│  │  (30% width)     │   │           Slide Content                    │  ─   │
│  │                  │   │           (70% width)                      │  ─   │ ← SlideIndicator
│  │                  │   │                                            │  ─   │   (right-6)
│  │                  │   │                                            │  │   │
│  └──────────────────┘   └────────────────────────────────────────────┘      │
│                                                                              │
│                              [Back to Home]                                  │
│                              (bottom center)                                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Available Positions for New Controls**:

1. **Bottom Center** - Currently has "Back to Home" link, could add scroll hint above it
2. **Bottom Right** - Empty, good for next/prev buttons
3. **Bottom Left** - Empty in main slide area
4. **Top of Slide** - Could show slide counter

## Mobile Considerations

The context provider includes mobile detection:

```typescript
// pitch-deck-context.tsx:43-58
const isMobile = useIsMobile();

// On mobile, default to collapsed preface
React.useEffect(() => {
  if (isMobile) {
    _setPrefaceExpanded(false);
  }
}, [isMobile]);
```

Mobile users:
- Get collapsed preface by default (full-width slides)
- May expect swipe gestures (not explicitly implemented beyond native scroll)
- May not discover keyboard shortcuts

## Code References

- `apps/www/src/app/(app)/(internal)/pitch-deck/_components/pitch-deck.tsx:44-71` - Keyboard navigation
- `apps/www/src/app/(app)/(internal)/pitch-deck/_components/pitch-deck.tsx:223-290` - SlideIndicator component
- `apps/www/src/app/(app)/(internal)/pitch-deck/_components/pitch-deck.tsx:113-127` - Back to Home link
- `apps/www/src/app/(app)/(internal)/pitch-deck/_components/pitch-deck-context.tsx:43-58` - Mobile detection
- `apps/www/src/app/(app)/(internal)/pitch-deck/layout.tsx:24-51` - Header layout structure

## Architecture Documentation

### Context Provider Pattern

The `PitchDeckProvider` manages:
- `prefaceExpanded` - Controls the 30%/70% split layout
- `isGridView` - Toggles between scroll view and grid overview
- `isMobile` - Detects mobile devices for responsive behavior

### Scroll-Driven Animation

Uses Framer Motion's `useScroll` hook:
- `scrollYProgress` tracks 0-1 scroll progress
- Each slide transforms based on its position in the scroll range
- Grid view triggers at 92% scroll progress (`GRID_THRESHOLD = 0.92`)

### State Management Flow

```
User Scrolls → scrollYProgress updates →
  → PitchSlide transforms (y, scale, opacity, zIndex)
  → IndicatorLine animations (opacity, width)
  → Grid view trigger (if >= 0.92)
```

## Historical Context (from thoughts/)

Related research documents:
- `thoughts/shared/research/2026-01-28-pitch-deck-controls-positioning.md` - Analysis of control placement
- `thoughts/shared/research/2026-01-23-pitch-deck-flabbergast-comparison.md` - Comparison with Flabbergast design

## Identified UX Patterns to Consider

### 1. Scroll Hint Component

**Position**: Bottom center, above "Back to Home" link
**Behavior**:
- Appears after 2s delay on first slide
- Animates with pulse/bounce
- Fades out on first scroll or after timeout
- Uses `prefers-reduced-motion` for accessibility

**Visual Design** (matching reference image):
```
      SCROLL
        │
        ◇
        ⋮
```

### 2. Navigation Arrows

**Position**: Bottom right corner
**Design**:
- Up/Down or Left/Right chevrons
- Click to advance/retreat one slide
- Disabled state at boundaries (first/last slide)
- Semi-transparent, more visible on hover

### 3. Slide Counter

**Position**: Near indicator or in header
**Format**: "3 / 10" or "Slide 3 of 10"
**Behavior**: Updates with scroll progress

### 4. Keyboard Hints

**Option A**: Tooltip on first visit
**Option B**: Small hint text near navigation controls
**Option C**: Help overlay accessible via "?" key

## Open Questions

1. Should the scroll hint persist or disappear after first interaction?
2. Should navigation arrows be always visible or appear on hover?
3. Should there be a slide counter, and where should it be positioned?
4. How should mobile touch/swipe behavior be communicated?
5. Should the "Back to Home" link be replaced with or accompanied by navigation controls?
