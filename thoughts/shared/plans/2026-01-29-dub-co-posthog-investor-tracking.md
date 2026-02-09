# Pitch Deck Investor Tracking: Dub.co + PostHog Implementation Plan

## Overview

Implement a complete investor tracking solution for the pitch deck at `/pitch-deck` using:
- **Dub.co** for branded short links (`links.lightfast.ai/sequoia`) with instant Discord notifications on clicks
- **PostHog** for deep engagement analytics (scroll depth, slides viewed, completion tracking)

This combines click attribution from Dub.co with engagement depth from PostHog to provide full funnel visibility.

## Current State Analysis

### Existing Infrastructure
- **PostHog fully integrated** in `apps/www` via `@vendor/analytics/posthog-client`
- Automatic pageview tracking active via `PostHogPageView` component (`vendor/analytics/src/providers/posthog/client.tsx:45`)
- `usePosthogAnalytics()` hook available for custom events
- No custom event tracking currently in pitch deck
- No Dub.co integration exists

### Pitch Deck Implementation
- 8 scroll-driven slides using Framer Motion (`apps/www/src/app/(app)/(internal)/pitch-deck/_components/pitch-deck.tsx`)
- Scroll progress tracked via `useMotionValueEvent(scrollYProgress, "change", ...)` at line 43
- State management via React Context (`pitch-deck-context.tsx`)
- Grid view overlay, keyboard navigation, preface toggle

### Key Integration Points
- `pitch-deck.tsx:43-57` - Scroll progress change handler (slide tracking)
- `pitch-deck.tsx:89-92` - Grid item click handler
- `pitch-deck-context.tsx` - Preface toggle handler
- `page.tsx` - URL searchParams access for UTM extraction

## Desired End State

After implementation:

### Investor Flow
```
1. Create investor link in Dub.co: links.lightfast.ai/sequoia
2. Investor clicks link → Dub.co tracks click + sends Discord notification
3. Dub.co redirects to: lightfast.ai/pitch-deck?utm_content=sequoia
4. PostHog captures engagement events with utm_content attached
5. PostHog dashboard shows which slides each investor viewed
```

### What You'll Have
- Branded short links: `links.lightfast.ai/{investor-name}`
- Instant Discord notification: "🔗 Sequoia just clicked your pitch deck!"
- PostHog dashboard showing:
  - Which slides each investor viewed
  - Time to complete deck
  - Engagement funnel (opened → viewed slides → completed)
  - Device/location breakdown per investor

### Verification
1. Create Dub.co link: `links.lightfast.ai/test-investor`
2. Click link, verify Discord notification appears immediately
3. Scroll through all slides
4. Check PostHog for events with `utm_content=test-investor`

## What We're NOT Doing

- Database storage of engagement data (using PostHog as source of truth)
- Email notifications (Discord only for MVP)
- Admin UI for generating investor links (use Dub.co dashboard)
- Time-spent-per-slide tracking (complex lifecycle management)
- Real-time engagement dashboard (use PostHog dashboards)
- HubSpot integration ($890/month - too expensive)

## Implementation Approach

**Phase 1-4**: PostHog tracking hook + pitch deck integration (code changes)
**Phase 5**: Dub.co webhook → Discord middleware (API route)
**Phase 6**: Dub.co setup + investor link generation (dashboard configuration)

---

## Phase 1: Create PostHog Tracking Hook

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
  // UTM parameters for investor correlation
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string; // Key field: investor identifier from Dub.co
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
      device_type:
        typeof window !== "undefined" &&
        /Mobile|Android|iPhone/i.test(navigator.userAgent)
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
  const trackSlideView = useCallback(
    (slideIndex: number) => {
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
      if (
        viewedSlidesRef.current.size === PITCH_SLIDES.length &&
        !deckCompletedRef.current
      ) {
        deckCompletedRef.current = true;
        posthog?.capture("pitch_deck_completed", {
          ...getMetadata(),
          total_slides: PITCH_SLIDES.length,
          time_to_complete_ms: Date.now() - mountTimeRef.current,
        });
      }
    },
    [posthog, getMetadata],
  );

  // Track grid view toggle
  const trackGridView = useCallback(
    (enabled: boolean) => {
      posthog?.capture("pitch_deck_grid_toggled", {
        ...getMetadata(),
        grid_enabled: enabled,
        slides_viewed_at_toggle: viewedSlidesRef.current.size,
      });
    },
    [posthog, getMetadata],
  );

  // Track preface toggle
  const trackPrefaceToggle = useCallback(
    (expanded: boolean) => {
      posthog?.capture("pitch_deck_preface_toggled", {
        ...getMetadata(),
        preface_expanded: expanded,
      });
    },
    [posthog, getMetadata],
  );

  // Track grid item click (navigation from grid)
  const trackGridItemClick = useCallback(
    (slideIndex: number) => {
      const slide = PITCH_SLIDES[slideIndex];
      posthog?.capture("pitch_deck_grid_item_clicked", {
        ...getMetadata(),
        slide_index: slideIndex,
        slide_id: slide?.id,
        slide_title: slide?.title,
      });
    },
    [posthog, getMetadata],
  );

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
- [ ] Hook file exists at correct path

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

export function PitchDeckTrackingProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={null}>
      <TrackingProviderInner>{children}</TrackingProviderInner>
    </Suspense>
  );
}
```

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles: `pnpm typecheck`
- [ ] Linting passes: `pnpm lint`

#### Manual Verification:
- [ ] Provider file exports correctly

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

Inside `PitchDeck` function, after `const { isGridView, setIsGridView } = usePitchDeck();` add:
```typescript
const { trackSlideView, trackGridView, trackGridItemClick } = useTracking();

// Track current slide for change detection
const previousSlideRef = useRef<number>(-1);
```

Replace the `useMotionValueEvent` handler (lines 43-57) with:
```typescript
useMotionValueEvent(scrollYProgress, "change", (latest) => {
  const slideIndex = Math.min(
    Math.floor(latest * PITCH_SLIDES.length),
    PITCH_SLIDES.length - 1,
  );
  if (slideIndex !== currentSlide) {
    setCurrentSlide(slideIndex);
  }

  // Track slide views
  if (slideIndex !== previousSlideRef.current && slideIndex >= 0) {
    previousSlideRef.current = slideIndex;
    trackSlideView(slideIndex);
  }

  // Grid view logic with tracking
  const shouldBeGrid = latest >= GRID_THRESHOLD;
  if (shouldBeGrid !== isGridView) {
    setIsGridView(shouldBeGrid);
    trackGridView(shouldBeGrid);
  }
});
```

Update `handleGridItemClick` function (lines 89-92) to:
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

**Implementation Note**: After completing this phase, proceed to Phase 5 (Discord webhook).

---

## Phase 5: Create Dub.co → Discord Webhook Middleware

### Overview
Create an API route to receive Dub.co webhook events and forward formatted notifications to Discord.

### Changes Required:

#### 1. Add Environment Variables
**File**: `apps/www/.vercel/.env.development.local` (add to existing)

```bash
# Discord Webhook for Investor Notifications
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/YOUR_WEBHOOK_ID/YOUR_WEBHOOK_TOKEN

# Dub.co Webhook Verification (optional but recommended)
DUB_WEBHOOK_SECRET=your_dub_webhook_secret_from_dashboard
```

#### 2. Update Environment Schema
**File**: `apps/www/src/env.ts`

Add to the server section:
```typescript
DISCORD_WEBHOOK_URL: z.string().url().optional(),
DUB_WEBHOOK_SECRET: z.string().optional(),
```

Add to runtimeEnv:
```typescript
DISCORD_WEBHOOK_URL: process.env.DISCORD_WEBHOOK_URL,
DUB_WEBHOOK_SECRET: process.env.DUB_WEBHOOK_SECRET,
```

#### 3. Create Discord Webhook Utility
**File**: `apps/www/src/lib/discord-webhook.ts` (new file)

```typescript
import { env } from "~/env";

interface DiscordEmbed {
  title: string;
  description?: string;
  color: number;
  fields?: Array<{
    name: string;
    value: string;
    inline?: boolean;
  }>;
  timestamp?: string;
  footer?: {
    text: string;
  };
}

interface DiscordMessage {
  username?: string;
  avatar_url?: string;
  content?: string;
  embeds?: DiscordEmbed[];
}

// Discord color codes
export const DISCORD_COLORS = {
  success: 3066993, // Green
  warning: 16776960, // Gold
  error: 15158332, // Red
  info: 3447003, // Blue
  purple: 10181046, // Purple (for investor clicks)
};

export async function sendDiscordNotification(
  message: DiscordMessage,
): Promise<boolean> {
  const webhookUrl = env.DISCORD_WEBHOOK_URL;

  if (!webhookUrl) {
    console.warn("Discord webhook URL not configured, skipping notification");
    return false;
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username: "Lightfast Investor Tracking",
        ...message,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Discord webhook error:", response.status, errorText);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Failed to send Discord notification:", error);
    return false;
  }
}

export function formatInvestorClickEmbed(data: {
  shortLink: string;
  investorId?: string;
  city?: string;
  country?: string;
  device?: string;
  browser?: string;
  timestamp?: string;
}): DiscordEmbed {
  const investorName = data.investorId || "Unknown Investor";
  const location =
    data.city && data.country
      ? `${data.city}, ${data.country}`
      : data.country || "Unknown";

  return {
    title: "🔗 Pitch Deck Clicked!",
    description: `**${investorName}** just opened your pitch deck`,
    color: DISCORD_COLORS.purple,
    fields: [
      {
        name: "Investor",
        value: investorName,
        inline: true,
      },
      {
        name: "Location",
        value: location,
        inline: true,
      },
      {
        name: "Device",
        value: data.device || "Unknown",
        inline: true,
      },
      {
        name: "Link",
        value: data.shortLink,
        inline: false,
      },
    ],
    timestamp: data.timestamp || new Date().toISOString(),
    footer: {
      text: "Dub.co → Lightfast",
    },
  };
}
```

#### 4. Create Dub.co Webhook Route
**File**: `apps/www/src/app/api/webhooks/dub/route.ts` (new file)

```typescript
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { env } from "~/env";
import {
  sendDiscordNotification,
  formatInvestorClickEmbed,
} from "~/lib/discord-webhook";

// Verify Dub webhook signature (HMAC-SHA256)
function verifyDubSignature(
  payload: string,
  signature: string | null,
  secret: string,
): boolean {
  if (!signature) return false;

  const hmac = crypto.createHmac("sha256", secret);
  const digest = hmac.update(payload).digest("hex");

  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(digest),
    );
  } catch {
    return false;
  }
}

// Dub.co webhook payload types
interface DubClickEvent {
  event: "link.clicked";
  data: {
    click: {
      id: string;
      timestamp: string;
      ip?: string;
      country?: string;
      city?: string;
      device?: string;
      browser?: string;
      os?: string;
    };
    link: {
      id: string;
      domain: string;
      key: string; // The short link slug (e.g., "sequoia")
      url: string; // Destination URL
      externalId?: string;
    };
  };
}

export async function POST(request: NextRequest) {
  try {
    const payload = await request.text();
    const signature = request.headers.get("x-dub-signature");

    // Verify webhook signature if secret is configured
    const webhookSecret = env.DUB_WEBHOOK_SECRET;
    if (webhookSecret) {
      if (!verifyDubSignature(payload, signature, webhookSecret)) {
        console.error("Invalid Dub webhook signature");
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
      }
    }

    const event: DubClickEvent = JSON.parse(payload);
    console.log("Received Dub webhook:", event.event, event.data.link.key);

    // Only process click events
    if (event.event !== "link.clicked") {
      return NextResponse.json({ received: true, processed: false });
    }

    // Extract investor ID from link key or destination URL
    const linkKey = event.data.link.key;
    const destinationUrl = new URL(event.data.link.url);
    const utmContent = destinationUrl.searchParams.get("utm_content");
    const investorId = utmContent || linkKey;

    // Send Discord notification
    const embed = formatInvestorClickEmbed({
      shortLink: `${event.data.link.domain}/${linkKey}`,
      investorId,
      city: event.data.click.city,
      country: event.data.click.country,
      device: event.data.click.device,
      browser: event.data.click.browser,
      timestamp: event.data.click.timestamp,
    });

    const sent = await sendDiscordNotification({
      embeds: [embed],
    });

    return NextResponse.json({
      received: true,
      processed: true,
      discord_sent: sent,
    });
  } catch (error) {
    console.error("Dub webhook processing error:", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 },
    );
  }
}

// Dub.co may send GET requests for webhook verification
export async function GET() {
  return NextResponse.json({ status: "Dub webhook endpoint active" });
}
```

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles: `pnpm typecheck`
- [ ] Linting passes: `pnpm lint`
- [ ] API route responds to GET: `curl http://localhost:4101/api/webhooks/dub`

#### Manual Verification:
- [ ] Test webhook endpoint with mock payload (see testing section)
- [ ] Discord notification appears in channel

**Implementation Note**: After completing this phase, proceed to Phase 6 (Dub.co configuration).

---

## Phase 6: Dub.co Configuration (Manual Setup)

### Overview
Set up Dub.co with custom domain and webhook configuration. **This phase requires no code changes** - it's dashboard configuration.

### Step 1: Create Dub.co Account

1. Go to [dub.co](https://dub.co) and sign up
2. Choose Free tier initially (1,000 tracked clicks, 25 links, webhooks included)
3. Complete onboarding

### Step 2: Add Custom Domain

1. Navigate to **Settings → Domains**
2. Click **Add Domain**
3. Enter: `links.lightfast.ai`
4. Add DNS records in Vercel (or your DNS provider):
   - `CNAME links → cname.dub.co`
5. Wait for verification (~5 minutes)

### Step 3: Configure Webhook

1. Navigate to **Settings → Webhooks**
2. Click **Create Webhook**
3. Configure:
   - **Name**: `Lightfast Discord Notifications`
   - **URL**: `https://www.lightfast.ai/api/webhooks/dub`
   - **Events**: Select `link.clicked`
4. Copy the **Signing Secret** and add to environment variables as `DUB_WEBHOOK_SECRET`
5. Click **Create**

### Step 4: Create First Investor Link

1. Navigate to **Links → Create Link**
2. Configure:
   - **Domain**: `links.lightfast.ai`
   - **Short Link**: `test-investor` (or specific investor name like `sequoia`)
   - **Destination URL**: `https://www.lightfast.ai/pitch-deck?utm_source=dub&utm_medium=pitch-deck&utm_campaign=series-a&utm_content=test-investor`
   - **Tags**: Add `investor` tag for filtering
3. Click **Create Link**

### Step 5: Create Discord Webhook

1. Open Discord and go to your server
2. Navigate to **Server Settings → Integrations → Webhooks**
3. Click **New Webhook**
4. Configure:
   - **Name**: `Lightfast Investor Alerts`
   - **Channel**: Select your desired notification channel
5. Copy the **Webhook URL**
6. Add to environment variables as `DISCORD_WEBHOOK_URL`

### Step 6: Deploy and Test

1. Deploy to Vercel (ensure environment variables are set)
2. Click your test link: `links.lightfast.ai/test-investor`
3. Verify:
   - [ ] Discord notification appears immediately
   - [ ] Notification shows correct investor name, location, device
   - [ ] You're redirected to pitch deck with UTM parameters

### Success Criteria:

#### Manual Verification:
- [ ] Custom domain `links.lightfast.ai` verified in Dub.co
- [ ] Webhook shows "Active" status in Dub.co dashboard
- [ ] Test link redirects correctly to pitch deck with UTM params
- [ ] Discord notification appears within seconds of click
- [ ] PostHog shows events with correct `utm_content` property

---

## Events Reference

### PostHog Events (Engagement Tracking)

| Event | Trigger | Key Properties |
|-------|---------|----------------|
| `pitch_deck_opened` | Page load | session_id, utm_*, device_type, referrer, total_slides |
| `pitch_slide_viewed` | Scroll to new slide | slide_id, slide_index, slide_title, slide_type, slides_viewed_count |
| `pitch_deck_completed` | All slides viewed | total_slides, time_to_complete_ms |
| `pitch_deck_grid_toggled` | Enter/exit grid view | grid_enabled, slides_viewed_at_toggle |
| `pitch_deck_grid_item_clicked` | Click grid thumbnail | slide_id, slide_index, slide_title |
| `pitch_deck_preface_toggled` | Toggle founder note | preface_expanded |

### Dub.co Events (Click Attribution)

| Event | Trigger | Data |
|-------|---------|------|
| `link.clicked` | Investor clicks short link | click ID, timestamp, IP, country, city, device, browser, OS |

---

## Testing Strategy

### Unit Tests
Not required for tracking - PostHog and Dub.co handle event delivery.

### Integration Tests
None needed - this is analytics instrumentation.

### Manual Testing Checklist

#### PostHog Events:
1. Open `/pitch-deck?utm_content=test` in incognito mode
2. Open browser Network tab, filter for "ingest"
3. Verify `pitch_deck_opened` event fires on load with `utm_content=test`
4. Scroll down slowly - verify `pitch_slide_viewed` for slides 0, 1, 2...
5. Scroll back up - verify no duplicate events
6. Continue to end - verify `pitch_deck_completed` fires once
7. Toggle grid view - verify `pitch_deck_grid_toggled`
8. Click grid item - verify `pitch_deck_grid_item_clicked`
9. Toggle preface - verify `pitch_deck_preface_toggled`

#### Dub.co → Discord:
1. Create test link in Dub.co: `links.lightfast.ai/test-{timestamp}`
2. Click link from different browser/incognito
3. Verify Discord notification appears within 5 seconds
4. Verify notification contains: investor name, location, device

#### End-to-End:
1. Create link for "sequoia" in Dub.co
2. Click `links.lightfast.ai/sequoia`
3. Verify Discord shows: "🔗 Pitch Deck Clicked! - sequoia just opened your pitch deck"
4. Scroll through all slides
5. Check PostHog dashboard for session with `utm_content=sequoia`
6. Verify complete engagement funnel: opened → slides → completed

---

## PostHog Dashboard Setup (Post-Implementation)

Create a PostHog dashboard with:

1. **Funnel Insight**:
   - Steps: `pitch_deck_opened` → `pitch_slide_viewed` (3+ slides) → `pitch_deck_completed`
   - Breakdown by `utm_content` (investor)

2. **Investor Breakdown Table**:
   - Event: `pitch_deck_completed`
   - Breakdown: `utm_content`
   - Shows which investors completed the deck

3. **Engagement Over Time**:
   - Event: `pitch_deck_opened`
   - Date range: Last 30 days
   - Shows investor activity trends

4. **Device/Location Breakdown**:
   - Event: `pitch_deck_opened`
   - Breakdown: `device_type`, `$geoip_country_name`

---

## Cost Analysis

| Service | Tier | Monthly Cost | What You Get |
|---------|------|--------------|--------------|
| Dub.co | Free | $0 | 1,000 tracked clicks, 25 links, webhooks |
| Dub.co | Pro | $25 | 50,000 clicks, 1,000 links, 1 year retention |
| PostHog | Free | $0 | 1M events/month, dashboards, session replay |
| Discord | Free | $0 | Unlimited webhooks |
| **Total** | Free tier | **$0** | Full investor tracking |

---

## Performance Considerations

- **Deduplication**: Slide views are deduplicated per session to avoid event spam
- **No DOM reads**: Tracking happens on scroll events already being monitored
- **Async**: Both PostHog and Discord webhook calls are non-blocking
- **Minimal bundle**: Uses existing PostHog client, no new dependencies
- **Webhook latency**: Discord notifications typically arrive within 1-3 seconds

---

## Migration Notes

None - this is new functionality with no existing data to migrate.

---

## References

- Research: `thoughts/shared/research/2026-01-29-web-analysis-dub-co-pitch-deck-tracking.md`
- PostHog alternatives: `thoughts/shared/research/2026-01-29-pitch-deck-tracking-hubspot-alternatives.md`
- Original PostHog plan: `thoughts/shared/plans/2026-01-28-pitch-deck-posthog-tracking.md`
- PostHog provider: `vendor/analytics/src/providers/posthog/client.tsx`
- Pitch deck component: `apps/www/src/app/(app)/(internal)/pitch-deck/_components/pitch-deck.tsx`
- Dub.co Webhooks: https://dub.co/docs/concepts/webhooks/introduction
- Discord Webhooks: https://discord.com/developers/docs/resources/webhook
