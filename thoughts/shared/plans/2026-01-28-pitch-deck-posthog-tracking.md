# Pitch Deck PostHog Tracking + HubSpot Integration Plan

## Quick Start Guide

This is a step-by-step how-to guide for implementing end-to-end investor tracking:

| Phase | What You'll Do | Estimated Effort |
|-------|---------------|------------------|
| **1** | Create tracking hook (`usePitchDeckTracking`) | ~20 mins |
| **2** | Create Suspense wrapper provider | ~10 mins |
| **3** | Wire up tracking to pitch deck component | ~30 mins |
| **4** | Add preface toggle tracking | ~10 mins |
| **5** | Configure PostHog → HubSpot pipeline | ~45 mins |

**Prerequisites:**
- PostHog account with Data Pipeline access (check your plan at us.posthog.com)
- HubSpot account (Free CRM works, Marketing Hub Professional for tracking URLs)
- Local dev environment running (`pnpm dev:www`)

---

## Overview

Implement PostHog event tracking for the pitch deck at `/pitch-deck` to capture slide-level engagement metrics, with HubSpot CRM integration for investor attribution and follow-up workflows. Uses UTM parameters for investor identification (generated via HubSpot Tracking URLs).

## Current State Analysis

### Existing Infrastructure
- PostHog is fully integrated in `apps/www` via `@vendor/analytics/posthog-client`
- Automatic pageview tracking is active via `PostHogPageView` component
- `usePosthogAnalytics()` hook available for custom events
- No custom event tracking currently implemented in the pitch deck
- No HubSpot integration exists yet

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
4. UTM parameters from HubSpot tracking URLs are attached to all events
5. Grid view and preface interactions are tracked
6. PostHog syncs engagement data to HubSpot contacts automatically
7. Investor engagement visible on HubSpot contact timeline

### End-to-End Workflow
```
HubSpot Contact → Generate Tracking URL → Send to Investor
                                              ↓
                         Investor opens pitch deck with UTM params
                                              ↓
                         PostHog captures events (with utm_content)
                                              ↓
                         PostHog → HubSpot sync (via Data Pipeline)
                                              ↓
                         HubSpot contact enriched with engagement data
```

### Verification
- Create test HubSpot tracking URL: `/pitch-deck?utm_source=email&utm_medium=pitch-deck&utm_campaign=series-a&utm_content=test-investor`
- Scroll through all slides
- Check PostHog dashboard for events with correct UTM properties
- Verify events sync to HubSpot contact timeline

## What We're NOT Doing

- Custom database schema for token management (using HubSpot instead)
- Admin UI for generating investor links (use HubSpot Tracking URL Builder)
- Time-spent-per-slide tracking (requires complex lifecycle management)
- Real-time Slack/email notifications (can be added via HubSpot workflows later)
- Custom engagement dashboard (use PostHog + HubSpot dashboards)

## MCP Automation Assessment

**Phase 5 must be done manually** - neither HubSpot MCP nor PostHog MCP expose admin/configuration APIs.

| Task | MCP Support | Method |
|------|-------------|--------|
| Create HubSpot properties | ❌ | Manual UI |
| Configure PostHog → HubSpot destination | ❌ | Manual UI |
| Set up tracking URLs | ❌ | Manual UI |
| Create HubSpot workflows | ❌ | Manual UI |

**Where MCPs CAN help (post-implementation):**
- **PostHog MCP**: Create analytics dashboards/insights programmatically (see "PostHog Dashboard Setup" section)
- **HubSpot MCP**: Create test contacts for end-to-end validation

Reference: `thoughts/shared/research/2026-01-28-hubspot-posthog-mcp-phase5-automation.md`

## Implementation Approach

**Code Changes (Phases 1-4):**
Create a dedicated tracking hook (`usePitchDeckTracking`) that:
1. Extracts UTM parameters on mount
2. Captures deck opened event with session metadata
3. Tracks slide views on scroll with deduplication
4. Captures deck completed event when all slides viewed
5. Tracks grid view and preface interactions

**Configuration (Phase 5):**
Set up PostHog → HubSpot data pipeline destination (no code required).

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
  // UTM parameters for HubSpot/CRM correlation
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string; // Key field: investor identifier from HubSpot
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
- [ ] TypeScript compiles: `pnpm typecheck`
- [ ] Linting passes: `pnpm lint`

#### Manual Verification:
- [ ] Hook file exists and exports correctly

**Implementation Note**: After completing this phase, proceed to Phase 2.

---

## Phase 2: Create Tracking Provider with Suspense

### Overview
Wrap the tracking hook in a Suspense boundary (required because `useSearchParams()` can cause client-side rendering de-optimization).

### Changes Required:

#### 1. New Tracking Provider
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

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles: `pnpm typecheck`
- [ ] Linting passes: `pnpm lint`

#### Manual Verification:
- [ ] Provider file exists and exports correctly

**Implementation Note**: After completing this phase, proceed to Phase 3.

---

## Phase 3: Integrate Tracking into Layout and PitchDeck

### Overview
Wire up the tracking provider to the layout and add tracking calls to the pitch deck component.

### Changes Required:

#### 1. Update Layout to Include Tracking Provider
**File**: `apps/www/src/app/(app)/(internal)/pitch-deck/layout.tsx`

Add import at top:
```typescript
import { PitchDeckTrackingProvider } from "./_components/pitch-deck-tracking-provider";
```

Wrap children with tracking provider (inside PitchDeckProvider). The structure should be:
```typescript
<PitchDeckProvider defaultPrefaceExpanded={defaultPrefaceExpanded}>
  <PitchDeckTrackingProvider>
    {/* existing header and content */}
  </PitchDeckTrackingProvider>
</PitchDeckProvider>
```

#### 2. Update PitchDeck Component
**File**: `apps/www/src/app/(app)/(internal)/pitch-deck/_components/pitch-deck.tsx`

Add import at top:
```typescript
import { useTracking } from "./pitch-deck-tracking-provider";
```

Update imports to include `useRef`:
```typescript
import { useRef, useEffect } from "react";
```

Inside `PitchDeck` function, after `const { isGridView, setIsGridView } = usePitchDeck();` add:
```typescript
const { trackSlideView, trackGridView, trackGridItemClick } = useTracking();

// Track current slide for change detection
const previousSlideRef = useRef<number>(-1);
```

Replace the `useMotionValueEvent` handler (lines 30-35) with:
```typescript
useMotionValueEvent(scrollYProgress, "change", (latest) => {
  const shouldBeGrid = latest >= GRID_THRESHOLD;

  // Track grid view state change
  if (shouldBeGrid !== isGridView) {
    setIsGridView(shouldBeGrid);
    trackGridView(shouldBeGrid);
  }

  // Track slide views based on scroll progress
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

Update `handleGridItemClick` function (lines 64-67) to:
```typescript
const handleGridItemClick = (index: number) => {
  trackGridItemClick(index);
  const scrollTarget = index * window.innerHeight;
  window.scrollTo({ top: scrollTarget, behavior: "smooth" });
};
```

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles: `pnpm typecheck`
- [ ] Linting passes: `pnpm lint`
- [ ] Dev server starts without errors: `pnpm dev:www`

#### Manual Verification:
- [ ] Open `/pitch-deck` and scroll through slides
- [ ] Open browser Network tab, filter for "ingest"
- [ ] Verify `pitch_deck_opened` event fires on load
- [ ] Verify `pitch_slide_viewed` events fire as you scroll
- [ ] Verify no duplicate events when scrolling back
- [ ] Verify `pitch_deck_completed` fires when all slides viewed
- [ ] Verify `pitch_deck_grid_toggled` fires when entering grid view

**Implementation Note**: After completing this phase and manual verification passes, proceed to Phase 4.

---

## Phase 4: Add Preface Toggle Tracking

### Overview
Track when users toggle the founder's preface panel.

### Changes Required:

#### 1. Update Preface Toggle Component
**File**: `apps/www/src/app/(app)/(internal)/pitch-deck/_components/preface-toggle.tsx`

First read the file to understand current implementation, then:

Add import:
```typescript
import { useTracking } from "./pitch-deck-tracking-provider";
```

Inside the component, get tracking function:
```typescript
const { trackPrefaceToggle } = useTracking();
```

In the click handler, add tracking before or after the toggle:
```typescript
// When toggling, track the NEW state (what it will become)
onClick={() => {
  trackPrefaceToggle(!prefaceExpanded);
  togglePreface();
}}
```

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles: `pnpm typecheck`
- [ ] Linting passes: `pnpm lint`

#### Manual Verification:
- [ ] Click preface toggle button
- [ ] Verify `pitch_deck_preface_toggled` event fires
- [ ] Verify `preface_expanded` property is correct (true/false)

**Implementation Note**: After completing this phase, proceed to Phase 5 (HubSpot configuration).

---

## Phase 5: Configure PostHog → HubSpot Integration

### Overview
Set up the PostHog Data Pipeline destination to sync pitch deck events to HubSpot contacts. **This phase requires no code changes** - it's all dashboard configuration.

### Prerequisites Checklist
- [ ] PostHog account with Data Pipeline access (check: us.posthog.com → Data Pipeline tab visible?)
- [ ] HubSpot account (Free CRM tier minimum)
- [ ] HubSpot Marketing Hub Professional (for Tracking URL Builder feature)
- [ ] Admin access to both platforms

---

### Step 1: Create HubSpot Contact Properties (Do This First)

Before connecting PostHog, create the custom properties in HubSpot that will store engagement data.

**Navigate to:** HubSpot → Settings (⚙️ gear icon) → Data Management → Properties

**Create these contact properties:**

| Property Name | Internal Name | Field Type | Group | Description |
|--------------|---------------|------------|-------|-------------|
| Pitch Deck Views | `pitch_deck_views` | Number | Contact Information | Total times deck was opened |
| Pitch Deck Completed | `pitch_deck_completed` | Single checkbox | Contact Information | Has viewed all 8 slides |
| Pitch Deck Last Viewed | `pitch_deck_last_viewed` | Date picker | Contact Information | Most recent view timestamp |
| Pitch Deck Max Slides | `pitch_deck_max_slides` | Number | Contact Information | Highest slide count reached |
| Pitch Deck Session ID | `pitch_deck_session_id` | Single-line text | Contact Information | PostHog session identifier |

**How to create each property:**
1. Click **Create property** button
2. Select **Contact** as the object type
3. Enter the Label (e.g., "Pitch Deck Views")
4. The Internal name auto-generates (verify it matches table above)
5. Select Field type from dropdown
6. Choose "Contact Information" as the group
7. Click **Create**

---

### Step 2: Enable HubSpot Destination in PostHog

**Navigate to:** PostHog → Data Pipeline → Destinations → + Create destination

**Configuration Steps:**

1. **Search and Select HubSpot**
   - Type "HubSpot" in the search box
   - Click on the HubSpot card

2. **Authorize OAuth Connection**
   - Click "Connect to HubSpot"
   - Log in to HubSpot if prompted
   - Authorize PostHog to access your HubSpot account
   - Select the correct HubSpot portal if you have multiple

3. **Configure Destination Settings**

   **Name:** `Pitch Deck → HubSpot`

   **Events to sync:** Use a filter to only sync pitch deck events:
   ```
   Event name contains "pitch_deck"
   ```

   Or select specific events:
   - `pitch_deck_opened`
   - `pitch_slide_viewed`
   - `pitch_deck_completed`
   - `pitch_deck_grid_toggled`
   - `pitch_deck_preface_toggled`

4. **Property Mapping Configuration**

   Map PostHog properties to HubSpot contact properties:

   | PostHog Property | HubSpot Property | Notes |
   |-----------------|------------------|-------|
   | `$distinct_id` | `email` | If you identify users by email |
   | `utm_content` | `hs_lead_status` | Or create custom field |
   | `session_id` | `pitch_deck_session_id` | Links events together |
   | `slides_viewed_count` | `pitch_deck_max_slides` | Use MAX aggregation |

5. **Click "Create & Enable"**

---

### Step 3: Set Up HubSpot Tracking URLs

HubSpot's Tracking URL Builder creates unique UTM-tagged URLs for each investor.

**Navigate to:** HubSpot → Settings → Tracking & Analytics → Tracking URLs

**Create a template for investor outreach:**

1. Click **Create tracking URL**

2. Fill in the form:
   - **Original URL:** `https://lightfast.ai/pitch-deck`
   - **UTM campaign:** `series-a-2026` (your round name)
   - **UTM source:** `email`
   - **UTM medium:** `pitch-deck`
   - **UTM term:** (leave empty or use deal stage)
   - **UTM content:** `{investor-identifier}` (e.g., `sequoia-roelof`)

3. Click **Create**

**Output Example:**
```
https://lightfast.ai/pitch-deck?utm_source=email&utm_medium=pitch-deck&utm_campaign=series-a-2026&utm_content=sequoia-roelof
```

**Best Practices for UTM Content:**
- Use format: `{firm}-{partner}` (e.g., `a16z-marc`)
- Or use HubSpot contact ID: `contact-{hubspot_id}`
- Keep lowercase, use hyphens not spaces
- Be consistent across all outreach

---

### Step 4: Create HubSpot Workflows for Automated Follow-ups

**Workflow 1: High Engagement Alert**

**Navigate to:** HubSpot → Automation → Workflows → Create workflow

**Setup:**
- **Type:** Contact-based
- **Name:** "Pitch Deck - High Engagement Alert"

**Enrollment Trigger:**
- Contact property `pitch_deck_completed` is equal to `True`

**Actions:**
1. Send internal notification email to you
2. Create a task: "Follow up with engaged investor - viewed full deck"
3. Update contact property: `hs_lead_status` = "Hot Lead"

---

**Workflow 2: Re-engagement for Partial Views**

**Setup:**
- **Name:** "Pitch Deck - Re-engagement Sequence"

**Enrollment Trigger:**
- Contact property `pitch_deck_views` is greater than `0`
- AND contact property `pitch_deck_completed` is NOT equal to `True`
- AND at least 3 days have passed since `pitch_deck_last_viewed`

**Actions:**
1. Wait 3 days
2. Send follow-up email: "Did you get a chance to finish reviewing?"
3. Update contact property: `hs_lead_status` = "Warm - Needs Follow-up"

---

### Step 5: Verify End-to-End Integration

**Test the complete flow:**

1. **Create Test Contact in HubSpot**
   - Go to Contacts → Create contact
   - Email: `test@example.com` (or your test email)
   - Note the contact ID from the URL

2. **Generate Test Tracking URL**
   - Create URL with `utm_content=test-investor-{date}`
   - Example: `https://lightfast.ai/pitch-deck?utm_source=email&utm_medium=pitch-deck&utm_campaign=series-a-2026&utm_content=test-investor-jan28`

3. **Open Pitch Deck with Test URL**
   - Use incognito browser
   - Open the tracking URL
   - Scroll through all 8 slides
   - Toggle preface panel
   - Enter grid view

4. **Verify in PostHog** (wait 1-2 minutes)
   - Go to PostHog → Activity → Live Events
   - Filter by your test session
   - Verify events appear with correct UTM properties:
     - `utm_source: email`
     - `utm_medium: pitch-deck`
     - `utm_campaign: series-a-2026`
     - `utm_content: test-investor-jan28`

5. **Verify in HubSpot** (wait 5-10 minutes for sync)
   - Go to the test contact's timeline
   - Look for "Website Activity" or custom events
   - Verify contact properties updated:
     - `pitch_deck_views` incremented
     - `pitch_deck_completed` = True
     - `pitch_deck_last_viewed` = today

### Troubleshooting

| Issue | Check | Solution |
|-------|-------|----------|
| Events not appearing in PostHog | Browser console for errors | Check if PostHog initialized (look for `/ingest` requests) |
| UTM params missing from events | Network tab for request payload | Verify `useSearchParams` hook working |
| HubSpot not receiving events | PostHog Data Pipeline status | Check destination shows "Active", review error logs |
| Contact not enriched | HubSpot contact timeline | Verify contact identified in PostHog with matching email/ID |
| Workflow not triggering | Workflow enrollment history | Check trigger conditions match contact state |

### Success Criteria:

#### Manual Verification:
- [ ] PostHog HubSpot destination shows "Active" status
- [ ] Created test tracking URL in HubSpot
- [ ] Opened pitch deck with test URL in incognito
- [ ] Scrolled through all 8 slides
- [ ] PostHog Live Events shows all 6 event types
- [ ] All events include correct `utm_content` property
- [ ] HubSpot contact timeline shows synced events (within 10 mins)
- [ ] HubSpot contact properties updated correctly
- [ ] Workflow enrollment triggered (if configured)

---

## Events Reference

| Event | Trigger | Key Properties |
|-------|---------|----------------|
| `pitch_deck_opened` | Page load | session_id, utm_*, device_type, referrer, total_slides |
| `pitch_slide_viewed` | Scroll to new slide | slide_id, slide_index, slide_title, slide_type, slides_viewed_count |
| `pitch_deck_completed` | All 8 slides viewed | total_slides, time_to_complete_ms |
| `pitch_deck_grid_toggled` | Enter/exit grid view | grid_enabled, slides_viewed_at_toggle |
| `pitch_deck_grid_item_clicked` | Click grid thumbnail | slide_id, slide_index, slide_title |
| `pitch_deck_preface_toggled` | Toggle founder note | preface_expanded |

---

## Testing Strategy

### Unit Tests:
Not required for Phase 1-4 - tracking is observational and PostHog handles event delivery.

### Integration Tests:
None needed - this is analytics instrumentation.

### Manual Testing Checklist:

#### PostHog Events:
1. Open `/pitch-deck` in incognito mode
2. Open browser Network tab, filter for "ingest"
3. Verify `pitch_deck_opened` event fires on load
4. Scroll down slowly - verify `pitch_slide_viewed` for slides 0, 1, 2...
5. Scroll back up - verify no duplicate events
6. Continue to end - verify `pitch_deck_completed` fires once
7. Toggle grid view - verify `pitch_deck_grid_toggled`
8. Click grid item - verify `pitch_deck_grid_item_clicked`
9. Toggle preface - verify `pitch_deck_preface_toggled`

#### UTM Parameter Tracking:
10. Add UTM params: `/pitch-deck?utm_source=email&utm_medium=pitch-deck&utm_campaign=series-a&utm_content=test-investor`
11. Verify all events include UTM properties in PostHog

#### HubSpot Integration:
12. Create a test contact in HubSpot
13. Generate tracking URL with `utm_content=test-contact`
14. Open pitch deck with tracking URL
15. View all slides
16. Check HubSpot contact timeline for synced events

---

## PostHog Dashboard Setup (Post-Implementation)

Create a PostHog dashboard with:
- **Funnel**: Deck opened → Slide 1 → ... → Deck completed
- **Retention**: Investors who viewed multiple times
- **Breakdown**: Views by `utm_content` (investor identifier)
- **Time chart**: Views over time by `utm_campaign`
- **Table**: Most engaged investors (by slides viewed, completion)

---

## HubSpot Reports (Post-Implementation)

Create HubSpot reports:
- **List**: Contacts who completed pitch deck (for priority follow-up)
- **List**: Contacts who opened but didn't complete (for re-engagement)
- **Dashboard**: Pitch deck engagement by campaign

---

## Performance Considerations

- **Deduplication**: Slide views are deduplicated per session to avoid event spam
- **No DOM reads**: Tracking happens on scroll events already being monitored
- **Async**: PostHog events are non-blocking
- **Minimal bundle**: Uses existing PostHog client, no new dependencies
- **HubSpot sync**: Async via PostHog CDP, no latency impact

---

## Migration Notes

None - this is new functionality with no existing data to migrate.

---

## References

- Research document: `thoughts/shared/research/2026-01-28-pitch-deck-posthog-tracking-strategy.md`
- PostHog provider: `vendor/analytics/src/providers/posthog/client.tsx`
- Pitch deck component: `apps/www/src/app/(app)/(internal)/pitch-deck/_components/pitch-deck.tsx`
- Slide configuration: `apps/www/src/config/pitch-deck-data.ts`
- PostHog HubSpot Destination: https://posthog.com/docs/cdp/destinations/hubspot
- HubSpot Tracking URLs: https://knowledge.hubspot.com/settings/how-do-i-create-a-tracking-url
