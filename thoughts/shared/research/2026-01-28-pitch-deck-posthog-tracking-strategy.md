---
date: 2026-01-28T10:30:00+11:00
researcher: Claude
git_commit: ff65906b78caead1463061e06a84630bc364f7a6
branch: feat/pitch-deck-page
repository: lightfastai/lightfast
topic: "Pitch Deck PostHog Tracking Strategy"
tags: [research, posthog, analytics, pitch-deck, investor-tracking]
status: complete
last_updated: 2026-01-28
last_updated_by: Claude
---

# Research: Pitch Deck PostHog Tracking Strategy

**Date**: 2026-01-28T10:30:00+11:00
**Researcher**: Claude
**Git Commit**: ff65906b78caead1463061e06a84630bc364f7a6
**Branch**: feat/pitch-deck-page
**Repository**: lightfastai/lightfast

## Research Question

How can we effectively track who has seen the pitch deck at `/apps/www/src/app/(app)/(internal)/pitch-deck/` using PostHog efficiently? What strategies exist for investor view tracking?

## Summary

The pitch deck is a scroll-driven presentation with 8 slides implemented using Framer Motion. PostHog is already fully integrated in the `apps/www` application with automatic pageview tracking. The current implementation provides a solid foundation for adding investor-specific tracking. Industry best practices recommend unique link generation per investor with comprehensive slide-level engagement analytics.

---

## Detailed Findings

### Current Pitch Deck Implementation

#### File Structure
```
apps/www/src/app/(app)/(internal)/pitch-deck/
├── page.tsx                          # Main page, imports PitchDeck component
├── layout.tsx                        # Header, preface panel, PitchDeckProvider
└── _components/
    ├── pitch-deck.tsx                # Main scroll-driven presentation
    ├── pitch-deck-context.tsx        # React context for state management
    ├── pitch-deck-layout-content.tsx # Split layout with animated preface
    ├── pitch-deck-navbar.tsx         # Navigation menu
    └── preface-toggle.tsx            # Toggle button for founder note
```

#### Slide Configuration
**File**: `apps/www/src/config/pitch-deck-data.ts`

8 slides configured:
1. `title` - "LIGHTFAST" (title slide)
2. `intro` - "Hi, we are Lightfast."
3. `problem` - "The Problem."
4. `solution` - "Our Solution."
5. `traction` - "Early Traction."
6. `team` - "The Team."
7. `ask` - "The Ask."
8. `vision` - "Every team deserves a perfect memory." (closing title)

#### Key Implementation Details

**Scroll-Based Animation** (`pitch-deck.tsx:16-122`):
- Uses `useScroll` from Framer Motion with `scrollYProgress`
- Container height: `(slides + 1) * 100vh` for extra scroll space
- Grid view triggered at 92% scroll progress
- Keyboard navigation: Arrow keys, Home, End, Page Up/Down

**State Management** (`pitch-deck-context.tsx`):
- `prefaceExpanded`: Controls left panel visibility (stored in cookie)
- `isGridView`: Toggles between stacking and grid views
- `isMobile`: Responsive behavior detection
- Keyboard shortcut: Cmd/Ctrl+B toggles preface

---

### Current PostHog Integration

#### Provider Setup
**File**: `vendor/analytics/src/providers/posthog/client.tsx`

```typescript
// Initialization (lines 18-25)
posthog.init(env.NEXT_PUBLIC_POSTHOG_KEY, {
  api_host: `${baseUrl}/ingest`,
  ui_host: "https://us.posthog.com",
  person_profiles: "identified_only",
  capture_pageview: false, // Manual tracking
});
```

**Key Configuration**:
- `person_profiles: "identified_only"` - Only identified users get profiles
- `capture_pageview: false` - Pageviews tracked manually via `PostHogPageView` component
- Reverse proxy through `/ingest` to bypass ad-blockers

#### Automatic Pageview Tracking
**File**: `vendor/analytics/src/providers/posthog/client.tsx:35-54`

```typescript
function PostHogPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const posthog = usePostHog();

  useEffect(() => {
    if (pathname && posthog) {
      const url = searchParams?.toString()
        ? `${pathname}?${searchParams.toString()}`
        : pathname;
      posthog.capture("$pageview", { $current_url: url });
    }
  }, [pathname, searchParams, posthog]);

  return null;
}
```

#### Server-Side Client
**File**: `vendor/analytics/src/providers/posthog/server.ts`

```typescript
export const analytics = new PostHog(posthogEnv.NEXT_PUBLIC_POSTHOG_KEY, {
  host: posthogEnv.NEXT_PUBLIC_POSTHOG_HOST,
  flushAt: 1,      // Immediate send
  flushInterval: 0, // No batching
});
```

#### Current Gaps
- No custom event tracking implemented
- No `posthog.identify()` calls for user identification
- No slide-level engagement tracking
- No investor attribution system

---

### Industry Best Practices

#### Key Metrics to Track

Based on Papermark's analysis of ~3000 pitch decks:

| Metric | Benchmark | Purpose |
|--------|-----------|---------|
| Total View Time | 3.2 minutes average | Engagement quality |
| First Slide Time | 23 seconds | First impression hook |
| Per-Slide Time | 15 seconds average | Content engagement |
| Completion Rate | % of slides viewed | Interest depth |
| Revisit Patterns | Slides returned to | High-interest areas |

#### Viewer Identification Strategies

**Option 1: Unique Link Per Investor**
```
URL Pattern: /pitch-deck?token={unique-token}
- Token maps to investor record in database
- Clean attribution without email gates
- Can set expiration dates
- Can revoke access individually
```

**Option 2: Email Capture Gate**
```
- Require email before viewing
- Creates investor profile automatically
- Enables PostHog identify()
- More friction but richer data
```

**Option 3: UTM Parameters**
```
URL: /pitch-deck?utm_source=email&utm_campaign=series_a&utm_content={investor-id}
- Works with existing PostHog pageview tracking
- No database changes required
- Less reliable (users can modify URL)
```

#### Privacy Considerations

- **GDPR Compliance**: Tracking is largely pseudonymous (browser, time, location)
- **Transparency**: Disclose tracking if asked by investors
- **Data Retention**: Delete tracking data after funding round closes
- **Non-Tracked Option**: Have PDF version available on request

---

### Recommended Implementation Strategy

#### Phase 1: Basic Slide Tracking (No Code Changes to Deck)

Use existing PostHog integration with custom events:

```typescript
// In pitch-deck.tsx, add to useMotionValueEvent callback
useMotionValueEvent(scrollYProgress, "change", (latest) => {
  const currentSlideIndex = Math.floor(latest * totalSlides);
  if (currentSlideIndex !== previousSlide) {
    posthog.capture("pitch_slide_viewed", {
      slide_index: currentSlideIndex,
      slide_id: PITCH_SLIDES[currentSlideIndex]?.id,
      slide_title: PITCH_SLIDES[currentSlideIndex]?.title,
      scroll_progress: latest,
    });
  }
});
```

#### Phase 2: Token-Based Attribution

**Database Schema**:
```typescript
// In db/console/src/schema
export const pitchDeckLinks = pgTable("pitch_deck_links", {
  id: serial("id").primaryKey(),
  token: varchar("token", { length: 64 }).unique().notNull(),
  investorEmail: varchar("investor_email", { length: 255 }),
  investorName: varchar("investor_name", { length: 255 }),
  investorCompany: varchar("investor_company", { length: 255 }),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const pitchDeckViews = pgTable("pitch_deck_views", {
  id: serial("id").primaryKey(),
  linkId: integer("link_id").references(() => pitchDeckLinks.id),
  sessionId: varchar("session_id", { length: 64 }),
  slideId: varchar("slide_id", { length: 64 }),
  timeSpent: integer("time_spent"), // milliseconds
  viewedAt: timestamp("viewed_at").defaultNow(),
});
```

**URL Pattern**:
```
https://lightfast.ai/pitch-deck?t={token}
```

**Token Extraction**:
```typescript
// In pitch-deck page.tsx
export default function PitchDeckPage({ searchParams }: { searchParams: { t?: string } }) {
  const token = searchParams.t;

  return (
    <div className="min-h-screen bg-background">
      <PitchDeck investorToken={token} />
    </div>
  );
}
```

#### Phase 3: Comprehensive Tracking

**Events to Capture**:

| Event | Properties | Trigger |
|-------|------------|---------|
| `pitch_deck_opened` | `token`, `referrer`, `device` | Page load |
| `pitch_slide_viewed` | `slide_id`, `slide_index`, `token` | Scroll to slide |
| `pitch_slide_time` | `slide_id`, `time_spent`, `token` | Leave slide |
| `pitch_deck_completed` | `total_time`, `slides_viewed`, `token` | View all slides |
| `pitch_grid_view_opened` | `token` | Enter grid view |
| `pitch_preface_toggled` | `expanded`, `token` | Toggle preface |

**PostHog Implementation**:
```typescript
// Custom hook for pitch deck tracking
export function usePitchDeckTracking(investorToken?: string) {
  const posthog = usePostHog();
  const sessionId = useRef(crypto.randomUUID());

  useEffect(() => {
    // Track deck opened
    posthog?.capture("pitch_deck_opened", {
      investor_token: investorToken,
      session_id: sessionId.current,
      referrer: document.referrer,
      device: /Mobile/.test(navigator.userAgent) ? "mobile" : "desktop",
    });

    // Track when user leaves
    return () => {
      posthog?.capture("pitch_deck_closed", {
        investor_token: investorToken,
        session_id: sessionId.current,
        total_time: Date.now() - startTime,
      });
    };
  }, []);

  const trackSlide = useCallback((slideId: string, slideIndex: number) => {
    posthog?.capture("pitch_slide_viewed", {
      investor_token: investorToken,
      session_id: sessionId.current,
      slide_id: slideId,
      slide_index: slideIndex,
    });
  }, [investorToken, posthog]);

  return { trackSlide, sessionId: sessionId.current };
}
```

#### Phase 4: Engagement Dashboard

**PostHog Dashboard Queries**:

```sql
-- Most engaging slides
SELECT properties.slide_id, COUNT(*) as views, AVG(properties.time_spent) as avg_time
FROM events
WHERE event = 'pitch_slide_time'
GROUP BY properties.slide_id
ORDER BY avg_time DESC

-- Investor engagement scores
SELECT properties.investor_token,
       COUNT(DISTINCT properties.session_id) as sessions,
       SUM(properties.time_spent) as total_time,
       MAX(properties.slide_index) as max_slide
FROM events
WHERE event IN ('pitch_slide_viewed', 'pitch_slide_time')
GROUP BY properties.investor_token
ORDER BY total_time DESC
```

---

## Code References

### Pitch Deck Components
- `apps/www/src/app/(app)/(internal)/pitch-deck/page.tsx:1-21` - Main page component
- `apps/www/src/app/(app)/(internal)/pitch-deck/layout.tsx:1-56` - Layout with header and preface
- `apps/www/src/app/(app)/(internal)/pitch-deck/_components/pitch-deck.tsx:16-123` - Scroll-driven presentation
- `apps/www/src/app/(app)/(internal)/pitch-deck/_components/pitch-deck-context.tsx:1-102` - State management

### PostHog Integration
- `vendor/analytics/src/providers/posthog/client.tsx:11-71` - Client provider and pageview tracking
- `vendor/analytics/src/providers/posthog/server.ts:1-13` - Server-side client
- `vendor/analytics/env.ts:1-15` - Environment configuration
- `apps/www/src/app/layout.tsx:173-178` - Provider integration in www app

### Slide Data
- `apps/www/src/config/pitch-deck-data.ts:1-98` - Slide configuration (8 slides)

---

## Architecture Documentation

### Current Analytics Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│ apps/www                                                            │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ layout.tsx                                                      │ │
│ │ └── <PostHogProvider baseUrl={createBaseUrl()}>                │ │
│ │       └── <PostHogPageView /> (automatic $pageview)            │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                              │                                      │
│                              ▼                                      │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ Next.js Rewrites (/ingest/* → us.i.posthog.com/*)              │ │
│ └─────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │   PostHog Cloud     │
                    │   (us.posthog.com)  │
                    └─────────────────────┘
```

### Proposed Tracking Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│ Investor receives unique link: /pitch-deck?t={token}               │
└─────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│ pitch-deck/page.tsx                                                 │
│ ├── Extract token from searchParams                                │
│ └── Pass to <PitchDeck investorToken={token} />                    │
└─────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│ PitchDeck Component                                                 │
│ ├── usePitchDeckTracking(token)                                    │
│ │   ├── pitch_deck_opened (on mount)                               │
│ │   ├── pitch_slide_viewed (on scroll)                             │
│ │   └── pitch_deck_closed (on unmount)                             │
│ └── useMotionValueEvent(scrollYProgress, ...)                      │
└─────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│ PostHog Events (with investor_token property)                       │
│ ├── pitch_deck_opened    { token, referrer, device }               │
│ ├── pitch_slide_viewed   { token, slide_id, slide_index }          │
│ ├── pitch_slide_time     { token, slide_id, time_spent }           │
│ └── pitch_deck_completed { token, total_time, slides_viewed }      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Historical Context (from thoughts/)

### Related Plans
- `thoughts/shared/plans/2026-01-22-pitch-deck-page.md` - Initial pitch deck implementation plan
- `thoughts/shared/plans/2026-01-23-pitch-deck-animation-improvements.md` - Animation refinements

### Related Research
- `thoughts/shared/research/2026-01-22-web-analysis-seed-pitch-deck-vc-guidance.md` - VC guidance on pitch deck content
- `thoughts/shared/research/2026-01-23-pitch-deck-animation-improvements.md` - Animation implementation research

---

## Open Questions

1. **Email capture vs token-only**: Should we require email before viewing, or rely solely on tokens?
2. **Database location**: Should tracking data go in `@db/console` or a separate analytics database?
3. **Real-time notifications**: Should we send Slack/email alerts when investors view the deck?
4. **Engagement scoring**: What thresholds define a "hot" investor lead?
5. **Data retention**: How long should we keep individual tracking data?
6. **Forwarding detection**: How do we track when a deck is forwarded to investment committee members?

---

## External Resources

- [DocSend Startup Fundraising](https://www.docsend.com/solutions/startup-fundraising/) - Industry-standard tracking
- [Papermark Open Source](https://papermark.io) - Self-hosted alternative
- [PostHog JavaScript SDK](https://posthog.com/docs/libraries/js) - Implementation reference
- [Papermark Pitch Deck Metrics](https://papermark.io/pitch-deck-metrics) - Benchmark data
