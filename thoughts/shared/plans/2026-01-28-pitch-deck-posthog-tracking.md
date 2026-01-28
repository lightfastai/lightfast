# Pitch Deck PostHog Tracking Implementation Plan

## Overview

Implement PostHog event tracking for the pitch deck at `/pitch-deck` to capture slide-level engagement metrics. Uses UTM parameters for investor attribution (compatible with external CRM link tracking). No database changes required.

## Current State Analysis

### Existing Infrastructure
- PostHog is fully integrated in `apps/www` via `@vendor/analytics/posthog-client`
- Automatic pageview tracking is active via `PostHogPageView` component
- `usePosthogAnalytics()` hook available for custom events
- No custom event tracking currently implemented in the pitch deck

### Pitch Deck Implementation
- 8 scroll-driven slides using Framer Motion (`apps/www/src/app/(app)/(internal)/pitch-deck/_components/pitch-deck.tsx`)
- Scroll progress tracked via `useMotionValueEvent(scrollYProgress, "change", ...)` at line 30
- State management via React Context (`pitch-deck-context.tsx`)
- Keyboard navigation, indicator dots, and grid view overlay

### Key Integration Points
- `pitch-deck.tsx:30-35` - Scroll progress change handler (slide tracking)
- `pitch-deck.tsx:64-67` - Grid item click handler
- `pitch-deck-context.tsx:66-68` - Preface toggle handler
- `page.tsx` - URL searchParams access for UTM extraction

## Desired End State

After implementation:
1. PostHog captures `pitch_deck_opened` when page loads with session metadata
2. PostHog captures `pitch_slide_viewed` when each slide comes into view
3. PostHog captures `pitch_deck_completed` when all slides are viewed
4. UTM parameters from URL are attached to all events for CRM correlation
5. Grid view and preface interactions are tracked

### Verification
- Open pitch deck at `/pitch-deck?utm_source=test&utm_campaign=demo`
- Scroll through all slides
- Check PostHog dashboard for events with correct UTM properties
- Verify slide view sequence matches scroll behavior

## What We're NOT Doing

- Database schema for token management (use CRM instead)
- Admin UI for generating investor links
- Time-spent-per-slide tracking (requires complex lifecycle management)
- Real-time notifications (Slack/email alerts)
- Custom engagement dashboard (use PostHog dashboards directly)

## Implementation Approach

Create a dedicated tracking hook (`usePitchDeckTracking`) that:
1. Extracts UTM parameters on mount
2. Captures deck opened event with session metadata
3. Tracks slide views on scroll with deduplication
4. Captures deck completed event when all slides viewed
5. Tracks grid view and preface interactions

---

## Phase 1: Create Tracking Hook

### Overview
Create a custom hook that encapsulates all PostHog tracking logic for the pitch deck.

### Changes Required:

#### 1. New Tracking Hook
**File**: `apps/www/src/app/(app)/(internal)/pitch-deck/_components/use-pitch-deck-tracking.ts` (new file)

```typescript
"use client";

import { useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { usePosthogAnalytics } from "@vendor/analytics/posthog-client";
import { PITCH_SLIDES } from "~/config/pitch-deck-data";

interface TrackingMetadata {
  // UTM parameters for CRM correlation
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  // Session info
  session_id: string;
  device_type: "mobile" | "desktop";
  referrer: string;
}

export function usePitchDeckTracking() {
  const posthog = usePosthogAnalytics();
  const searchParams = useSearchParams();

  // Generate stable session ID for grouping events
  const sessionIdRef = useRef<string>("");
  if (!sessionIdRef.current) {
    sessionIdRef.current = crypto.randomUUID();
  }

  // Track which slides have been viewed this session (for deduplication)
  const viewedSlidesRef = useRef<Set<string>>(new Set());
  const deckCompletedRef = useRef(false);
  const mountTimeRef = useRef<number>(Date.now());

  // Build tracking metadata from URL params
  const getMetadata = useCallback((): TrackingMetadata => {
    return {
      utm_source: searchParams.get("utm_source") ?? undefined,
      utm_medium: searchParams.get("utm_medium") ?? undefined,
      utm_campaign: searchParams.get("utm_campaign") ?? undefined,
      utm_content: searchParams.get("utm_content") ?? undefined,
      utm_term: searchParams.get("utm_term") ?? undefined,
      session_id: sessionIdRef.current,
      device_type: typeof window !== "undefined" && /Mobile|Android|iPhone/i.test(navigator.userAgent)
        ? "mobile"
        : "desktop",
      referrer: typeof document !== "undefined" ? document.referrer : "",
    };
  }, [searchParams]);

  // Track deck opened on mount
  useEffect(() => {
    mountTimeRef.current = Date.now();

    posthog?.capture("pitch_deck_opened", {
      ...getMetadata(),
      total_slides: PITCH_SLIDES.length,
    });
  }, [posthog, getMetadata]);

  // Track slide view (with deduplication)
  const trackSlideView = useCallback((slideIndex: number) => {
    const slide = PITCH_SLIDES[slideIndex];
    if (!slide) return;

    // Deduplicate: only track first view of each slide per session
    if (viewedSlidesRef.current.has(slide.id)) return;
    viewedSlidesRef.current.add(slide.id);

    posthog?.capture("pitch_slide_viewed", {
      ...getMetadata(),
      slide_index: slideIndex,
      slide_id: slide.id,
      slide_title: slide.title,
      slide_type: slide.type,
      slides_viewed_count: viewedSlidesRef.current.size,
    });

    // Check if all slides have been viewed
    if (viewedSlidesRef.current.size === PITCH_SLIDES.length && !deckCompletedRef.current) {
      deckCompletedRef.current = true;
      posthog?.capture("pitch_deck_completed", {
        ...getMetadata(),
        total_slides: PITCH_SLIDES.length,
        time_to_complete_ms: Date.now() - mountTimeRef.current,
      });
    }
  }, [posthog, getMetadata]);

  // Track grid view toggle
  const trackGridView = useCallback((enabled: boolean) => {
    posthog?.capture("pitch_deck_grid_toggled", {
      ...getMetadata(),
      grid_enabled: enabled,
      slides_viewed_at_toggle: viewedSlidesRef.current.size,
    });
  }, [posthog, getMetadata]);

  // Track preface toggle
  const trackPrefaceToggle = useCallback((expanded: boolean) => {
    posthog?.capture("pitch_deck_preface_toggled", {
      ...getMetadata(),
      preface_expanded: expanded,
    });
  }, [posthog, getMetadata]);

  // Track grid item click (navigation from grid)
  const trackGridItemClick = useCallback((slideIndex: number) => {
    const slide = PITCH_SLIDES[slideIndex];
    posthog?.capture("pitch_deck_grid_item_clicked", {
      ...getMetadata(),
      slide_index: slideIndex,
      slide_id: slide?.id,
      slide_title: slide?.title,
    });
  }, [posthog, getMetadata]);

  return {
    trackSlideView,
    trackGridView,
    trackPrefaceToggle,
    trackGridItemClick,
    sessionId: sessionIdRef.current,
  };
}
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `pnpm typecheck`
- [x] Linting passes: `pnpm lint`

#### Manual Verification:
- [ ] Hook file exists and exports correctly

---

## Phase 2: Integrate Tracking into Pitch Deck

### Overview
Wire up the tracking hook to the pitch deck component to capture scroll-based slide views.

### Changes Required:

#### 1. Update PitchDeck Component
**File**: `apps/www/src/app/(app)/(internal)/pitch-deck/_components/pitch-deck.tsx`

Add import at top:
```typescript
import { usePitchDeckTracking } from "./use-pitch-deck-tracking";
```

Inside `PitchDeck` function (after line 23, after `usePitchDeck()`):
```typescript
const { trackSlideView, trackGridView, trackGridItemClick } = usePitchDeckTracking();

// Track current slide based on scroll
const previousSlideRef = useRef<number>(-1);
```

Update the `useMotionValueEvent` handler (replace lines 30-35):
```typescript
useMotionValueEvent(scrollYProgress, "change", (latest) => {
  const shouldBeGrid = latest >= GRID_THRESHOLD;

  // Track grid view state change
  if (shouldBeGrid !== isGridView) {
    setIsGridView(shouldBeGrid);
    trackGridView(shouldBeGrid);
  }

  // Track slide views based on scroll progress
  // Calculate which slide is currently in view
  const currentSlideIndex = Math.min(
    Math.floor(latest * PITCH_SLIDES.length),
    PITCH_SLIDES.length - 1
  );

  if (currentSlideIndex !== previousSlideRef.current && currentSlideIndex >= 0) {
    previousSlideRef.current = currentSlideIndex;
    trackSlideView(currentSlideIndex);
  }
});
```

Update `handleGridItemClick` function (replace lines 64-67):
```typescript
const handleGridItemClick = (index: number) => {
  trackGridItemClick(index);
  const scrollTarget = index * window.innerHeight;
  window.scrollTo({ top: scrollTarget, behavior: "smooth" });
};
```

Add `useRef` to imports:
```typescript
import { useRef, useEffect } from "react";
```

#### 2. Update Context for Preface Tracking
**File**: `apps/www/src/app/(app)/(internal)/pitch-deck/_components/pitch-deck-context.tsx`

The tracking hook needs access to context, but context doesn't have access to the hook (circular). Instead, we'll emit a custom event that the hook can listen to, OR we pass a tracking callback into the provider.

**Simpler approach**: Just track preface directly in the layout where the toggle button lives.

**File**: `apps/www/src/app/(app)/(internal)/pitch-deck/_components/preface-toggle.tsx`

Read this file first to understand the current implementation, then add tracking.

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `pnpm typecheck`
- [x] Linting passes: `pnpm lint`
- [ ] Dev server starts without errors: `pnpm dev:www`

#### Manual Verification:
- [ ] Open `/pitch-deck` and check browser console for PostHog events
- [ ] Scroll through slides and verify `pitch_slide_viewed` events fire
- [ ] Verify deduplication: scrolling back to a slide doesn't re-fire the event
- [ ] Scroll to end and verify `pitch_deck_completed` fires once

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation that the tracking events appear correctly in PostHog before proceeding to Phase 3.

---

## Phase 3: Wrap Hook in Suspense

### Overview
The tracking hook uses `useSearchParams()` which requires Suspense boundary to prevent client-side rendering de-optimization.

### Changes Required:

#### 1. Create Tracking Provider Wrapper
**File**: `apps/www/src/app/(app)/(internal)/pitch-deck/_components/pitch-deck-tracking-provider.tsx` (new file)

```typescript
"use client";

import { Suspense, createContext, useContext } from "react";
import { usePitchDeckTracking } from "./use-pitch-deck-tracking";

type TrackingContextType = ReturnType<typeof usePitchDeckTracking>;

const TrackingContext = createContext<TrackingContextType | null>(null);

export function useTracking() {
  const context = useContext(TrackingContext);
  if (!context) {
    // Return no-op functions if not in provider (safe fallback)
    return {
      trackSlideView: () => {},
      trackGridView: () => {},
      trackPrefaceToggle: () => {},
      trackGridItemClick: () => {},
      sessionId: "",
    };
  }
  return context;
}

function TrackingProviderInner({ children }: { children: React.ReactNode }) {
  const tracking = usePitchDeckTracking();

  return (
    <TrackingContext.Provider value={tracking}>
      {children}
    </TrackingContext.Provider>
  );
}

export function PitchDeckTrackingProvider({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={null}>
      <TrackingProviderInner>
        {children}
      </TrackingProviderInner>
    </Suspense>
  );
}
```

#### 2. Update Layout to Include Tracking Provider
**File**: `apps/www/src/app/(app)/(internal)/pitch-deck/layout.tsx`

Add import:
```typescript
import { PitchDeckTrackingProvider } from "./_components/pitch-deck-tracking-provider";
```

Wrap the `PitchDeckProvider` children with the tracking provider (inside PitchDeckProvider):
```typescript
<PitchDeckProvider defaultPrefaceExpanded={defaultPrefaceExpanded}>
  <PitchDeckTrackingProvider>
    {/* existing content */}
  </PitchDeckTrackingProvider>
</PitchDeckProvider>
```

#### 3. Update PitchDeck to Use Context
**File**: `apps/www/src/app/(app)/(internal)/pitch-deck/_components/pitch-deck.tsx`

Change import:
```typescript
// Remove: import { usePitchDeckTracking } from "./use-pitch-deck-tracking";
import { useTracking } from "./pitch-deck-tracking-provider";
```

Change usage:
```typescript
// Replace: const { trackSlideView, trackGridView, trackGridItemClick } = usePitchDeckTracking();
const { trackSlideView, trackGridView, trackGridItemClick } = useTracking();
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `pnpm typecheck`
- [x] Linting passes: `pnpm lint`
- [ ] Build succeeds: `pnpm build:www`

#### Manual Verification:
- [ ] No hydration warnings in console
- [ ] UTM parameters correctly captured: `/pitch-deck?utm_source=test&utm_campaign=demo`
- [ ] Check PostHog event properties include UTM fields

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation that UTM tracking works correctly before proceeding to Phase 4.

---

## Phase 4: Add Preface Toggle Tracking

### Overview
Track when users toggle the founder's preface panel.

### Changes Required:

#### 1. Read Preface Toggle Component
First read `apps/www/src/app/(app)/(internal)/pitch-deck/_components/preface-toggle.tsx` to understand the current implementation.

#### 2. Update Preface Toggle
**File**: `apps/www/src/app/(app)/(internal)/pitch-deck/_components/preface-toggle.tsx`

Add import:
```typescript
import { useTracking } from "./pitch-deck-tracking-provider";
```

Inside component, add tracking:
```typescript
const { trackPrefaceToggle } = useTracking();

// In the click handler (or wherever toggle happens):
const handleToggle = () => {
  const newState = !prefaceExpanded;
  togglePreface();
  trackPrefaceToggle(newState);
};
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `pnpm typecheck`
- [x] Linting passes: `pnpm lint`

#### Manual Verification:
- [ ] Click preface toggle button
- [ ] Verify `pitch_deck_preface_toggled` event in PostHog
- [ ] Verify `preface_expanded` property is correct (true/false)

---

## Testing Strategy

### Unit Tests:
Not required for Phase 1 - tracking is observational and PostHog handles event delivery.

### Integration Tests:
None needed - this is analytics instrumentation.

### Manual Testing Steps:
1. Open `/pitch-deck` in incognito mode
2. Open PostHog dashboard or browser Network tab
3. Verify `pitch_deck_opened` event fires on load
4. Scroll down slowly - verify `pitch_slide_viewed` for slides 0, 1, 2...
5. Scroll back up - verify no duplicate events
6. Continue to end - verify `pitch_deck_completed` fires once
7. Toggle grid view - verify `pitch_deck_grid_toggled`
8. Click grid item - verify `pitch_deck_grid_item_clicked`
9. Toggle preface - verify `pitch_deck_preface_toggled`
10. Add UTM params: `/pitch-deck?utm_source=investor&utm_campaign=series_a&utm_content=sequoia`
11. Verify all events include UTM properties

## PostHog Dashboard Setup (Post-Implementation)

After implementing, create a PostHog dashboard with:
- **Funnel**: Deck opened → Slide 1 → ... → Deck completed
- **Retention**: Investors who viewed multiple times
- **Breakdown**: Views by `utm_content` (investor identifier)
- **Time chart**: Views over time by `utm_campaign`

## Performance Considerations

- **Deduplication**: Slide views are deduplicated per session to avoid event spam
- **No DOM reads**: Tracking happens on scroll events already being monitored
- **Async**: PostHog events are non-blocking
- **Minimal bundle**: Uses existing PostHog client, no new dependencies

## Migration Notes

None - this is new functionality with no existing data to migrate.

## References

- Research document: `thoughts/shared/research/2026-01-28-pitch-deck-posthog-tracking-strategy.md`
- PostHog provider: `vendor/analytics/src/providers/posthog/client.tsx`
- Pitch deck component: `apps/www/src/app/(app)/(internal)/pitch-deck/_components/pitch-deck.tsx`
- Slide configuration: `apps/www/src/config/pitch-deck-data.ts`
