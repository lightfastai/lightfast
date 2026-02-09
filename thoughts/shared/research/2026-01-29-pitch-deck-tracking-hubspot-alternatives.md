---
date: 2026-01-29T02:09:47Z
researcher: Claude
git_commit: 7f4be19dce56084d0b5d45b7a54ab38680b158e8
branch: main
repository: lightfastai/lightfast
topic: "Alternative Solutions for Pitch Deck Investor Tracking (HubSpot Replacement)"
tags: [research, analytics, posthog, crm, investor-tracking, pitch-deck]
status: complete
last_updated: 2026-01-29
last_updated_by: Claude
---

# Research: Alternative Solutions for Pitch Deck Investor Tracking

**Date**: 2026-01-29T02:09:47Z
**Researcher**: Claude
**Git Commit**: 7f4be19dce56084d0b5d45b7a54ab38680b158e8
**Branch**: main
**Repository**: lightfastai/lightfast

## Research Question

The original plan (`thoughts/shared/plans/2026-01-28-pitch-deck-posthog-tracking.md`) proposed using PostHog → HubSpot Data Pipeline for investor tracking. However, this requires HubSpot Marketing Hub Professional ($890/month), which is too expensive. What are affordable alternatives for tracking investor engagement with the pitch deck?

## Summary

Several viable alternatives exist that can replace the HubSpot integration while maintaining full investor tracking capabilities. The best options are:

1. **Airtable Team ($20/user/month)** - Native PostHog integration, no middleware needed
2. **Custom Database with Resend** - Use existing infrastructure (free/low-cost)
3. **Supabase + Atomic CRM ($25/month)** - Most flexible, self-hosted option
4. **Google Sheets + Apps Script (Free)** - Zero-cost DIY option

All options work with PostHog's webhook destinations, which are available on all plans including free tier.

---

## Detailed Findings

### Current PostHog Infrastructure

**Location**: `vendor/analytics/src/providers/posthog/`

The codebase has a complete PostHog integration:

- **Client-side**: React provider with hooks (`client.tsx:22-67`)
- **Server-side**: Node client configured for serverless (`server.ts:1-13`)
- **Reverse proxy**: `/ingest` endpoint to bypass ad-blockers (`vendor/next/src/next-config-builder.ts:27-50`)
- **Automatic pageviews**: `PostHogPageView` component tracks route changes
- **Custom events**: `usePosthogAnalytics()` hook available for tracking

**Key Finding**: PostHog webhooks are available on all plans (including free). No need for expensive CDP features.

### Existing Infrastructure for Notifications

The codebase already has patterns that can be reused for investor notifications:

| Pattern | Location | Can Reuse For |
|---------|----------|---------------|
| Webhook handlers | `apps/console/src/app/(github)/api/github/webhooks/route.ts` | Receiving PostHog events |
| Inngest workflows | `api/console/src/inngest/workflow/` | Async processing |
| Resend email | `packages/email/src/functions/all.ts` | Investor notifications |
| Activity tracking | `db/console/src/schema/tables/workspace-user-activities.ts` | Engagement logging |
| Metrics | `db/console/src/schema/tables/workspace-operations-metrics.ts` | Analytics storage |

---

## Option Analysis

### Option 1: Airtable Team - Native PostHog Integration

**Cost**: $20/user/month (Team tier)
**Setup Time**: ~30 minutes

**How It Works**:
1. Create Airtable base with tables: `Investors`, `Pitch Deck Views`, `Engagement Events`
2. Configure PostHog → Airtable destination (native integration)
3. Map PostHog event properties to Airtable fields
4. Use Airtable automations for follow-up triggers

**Pros**:
- Native PostHog destination (no code needed)
- Visual interface for tracking engagement
- Built-in automations for workflows
- Familiar spreadsheet-like interface

**Cons**:
- Strict rate limits (5 requests/second, 25,000 automation runs/month)
- Expensive if you exceed limits (forced tier upgrade)
- External dependency

**PostHog Configuration**:
```
Data Pipeline → Destinations → Airtable
- Filter: event name contains "pitch_deck"
- Map: utm_content → Investor ID field
- Map: slides_viewed_count → Slides Viewed field
```

---

### Option 2: Custom Database with Resend (Recommended)

**Cost**: Free (uses existing infrastructure)
**Setup Time**: ~2-3 hours

**How It Works**:
1. Create PostHog webhook destination pointing to new API route
2. Create `pitch_deck_engagement` table in existing database
3. Store engagement events with investor identification
4. Use Resend for notification emails when engagement thresholds hit

**Architecture**:
```
PostHog Event → Webhook → /api/posthog-webhook/route.ts
                              ↓
                    pitch_deck_engagement table
                              ↓
                    Check engagement thresholds
                              ↓
                    Resend notification (if high engagement)
```

**New Files Required**:

```typescript
// apps/www/src/app/api/posthog-webhook/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@db/console";
import { pitchDeckEngagement } from "@db/console/schema";
import { sendResendEmailSafe } from "@repo/email";

export async function POST(request: NextRequest) {
  const payload = await request.json();

  // Verify PostHog webhook (optional - PostHog webhooks don't have signatures)
  const event = payload.event;
  const properties = payload.properties;

  // Store engagement
  await db.insert(pitchDeckEngagement).values({
    eventType: event,
    investorId: properties.utm_content,
    sessionId: properties.session_id,
    slideIndex: properties.slide_index,
    slidesViewedCount: properties.slides_viewed_count,
    deviceType: properties.device_type,
    utmSource: properties.utm_source,
    utmCampaign: properties.utm_campaign,
    timestamp: new Date(payload.timestamp),
  });

  // Check for high engagement (completed deck)
  if (event === "pitch_deck_completed") {
    await sendResendEmailSafe({
      to: "founders@lightfast.ai",
      subject: `🔥 Investor viewed full pitch deck: ${properties.utm_content}`,
      react: InvestorEngagementEmail({ investorId: properties.utm_content }),
    });
  }

  return NextResponse.json({ received: true });
}
```

```typescript
// db/console/src/schema/tables/pitch-deck-engagement.ts
export const pitchDeckEngagement = pgTable(
  "lightfast_pitch_deck_engagement",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    eventType: varchar("event_type", { length: 50 }).notNull(),
    investorId: varchar("investor_id", { length: 191 }), // from utm_content
    sessionId: varchar("session_id", { length: 191 }).notNull(),
    slideIndex: integer("slide_index"),
    slidesViewedCount: integer("slides_viewed_count"),
    deviceType: varchar("device_type", { length: 20 }),
    utmSource: varchar("utm_source", { length: 100 }),
    utmCampaign: varchar("utm_campaign", { length: 100 }),
    timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    investorIdx: index("engagement_investor_idx").on(table.investorId),
    sessionIdx: index("engagement_session_idx").on(table.sessionId),
    timestampIdx: index("engagement_timestamp_idx").on(table.timestamp),
  }),
);
```

**Pros**:
- Uses existing infrastructure (no new services)
- Full control over data and logic
- No external API limits
- Email notifications via Resend (already configured)
- Can add Slack notifications easily

**Cons**:
- Requires development work (~2-3 hours)
- Need to create dashboard/views for analytics

---

### Option 3: Supabase + Atomic CRM

**Cost**: $25/month (Supabase Pro) + Free (Atomic CRM is MIT licensed)
**Setup Time**: ~4-5 hours

**How It Works**:
1. Set up Supabase project with Atomic CRM template
2. Customize CRM for investor tracking (add pitch deck fields)
3. Create Edge Function to receive PostHog webhooks
4. Use Supabase database webhooks for follow-up triggers

**Pros**:
- Full CRM functionality (contacts, deals, tasks, notes)
- Real-time subscriptions for live dashboards
- Unlimited customization
- Self-hosted database (data ownership)

**Cons**:
- Most development work required
- Separate from main codebase
- Need to learn Supabase patterns

---

### Option 4: Google Sheets + Apps Script

**Cost**: Free
**Setup Time**: ~1-2 hours

**How It Works**:
1. Create Google Sheet with columns for engagement data
2. Deploy Apps Script as web app to receive webhooks
3. Configure PostHog webhook to Apps Script URL
4. Use Sheet formulas for engagement analytics

**Apps Script Example**:
```javascript
function doPost(e) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const data = JSON.parse(e.postData.contents);

  sheet.appendRow([
    new Date(),
    data.event,
    data.properties.utm_content,
    data.properties.session_id,
    data.properties.slides_viewed_count,
    data.properties.device_type,
  ]);

  // Send email for high engagement
  if (data.event === "pitch_deck_completed") {
    MailApp.sendEmail(
      "founders@lightfast.ai",
      "Investor viewed full deck: " + data.properties.utm_content,
      "View details: [sheet link]"
    );
  }

  return ContentService.createTextOutput("OK");
}
```

**Pros**:
- Completely free
- Simple to set up
- Familiar interface
- Easy to share with team

**Cons**:
- Rate limits on Apps Script execution
- No CRM features
- Manual maintenance
- Not production-grade

---

### Option 5: Attio (Investor-Focused CRM)

**Cost**: Free tier (3 users) or $36-86/user/month
**Setup Time**: ~2-3 hours

**How It Works**:
1. Set up Attio with investor contacts
2. Create custom objects for pitch deck views
3. Build webhook receiver to call Attio API
4. Use Attio automations for workflows

**Pros**:
- Purpose-built for investor relations
- Used by 500+ VCs
- Strong data enrichment
- Beautiful interface

**Cons**:
- Custom objects require Pro tier ($86/user/month)
- Requires middleware for PostHog integration
- External dependency

---

## PostHog Webhook Configuration

All options use PostHog webhooks. Here's how to set them up:

**Navigate to**: PostHog → Data Pipeline → Destinations → + New Destination → Webhook

**Configuration**:
```json
{
  "name": "Pitch Deck Engagement",
  "url": "https://lightfast.ai/api/posthog-webhook",
  "method": "POST",
  "headers": {
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_WEBHOOK_SECRET"
  },
  "body": {
    "event": "{event.event}",
    "timestamp": "{event.timestamp}",
    "distinct_id": "{event.distinct_id}",
    "properties": "{event.properties}"
  }
}
```

**Event Filter**: `event.event contains "pitch_deck"`

---

## Recommendation

**For Lightfast, I recommend Option 2: Custom Database with Resend** because:

1. **Zero additional cost** - Uses existing PlanetScale database and Resend
2. **Existing patterns** - Follows webhook/notification patterns already in codebase
3. **Full control** - No external API limits or dependencies
4. **Integration with existing infra** - Can use Inngest for async processing if needed
5. **Email ready** - Resend is already configured for transactional emails

**Implementation Priority**:
1. Keep Phases 1-4 from original plan (PostHog tracking hook)
2. Replace Phase 5 with custom webhook receiver
3. Add simple email notification for high engagement
4. Optionally add Slack notification later

---

## Simplified Implementation Plan

### Phase 1-4: Same as Original Plan
- Create `usePitchDeckTracking` hook
- Create tracking provider with Suspense
- Wire up tracking to pitch deck component
- Add preface toggle tracking

### Phase 5: Custom Webhook (Replaces HubSpot)

**5a. Create Engagement Table**
```
File: db/console/src/schema/tables/pitch-deck-engagement.ts
- eventType, investorId, sessionId, slideIndex, etc.
- Indexes on investorId, sessionId, timestamp
```

**5b. Create Webhook Endpoint**
```
File: apps/www/src/app/api/posthog-webhook/route.ts
- Receive PostHog events
- Store in pitch_deck_engagement table
- Send notification email for completed decks
```

**5c. Configure PostHog Webhook**
```
PostHog UI → Data Pipeline → Destinations → Webhook
- URL: https://lightfast.ai/api/posthog-webhook
- Filter: event name contains "pitch_deck"
```

### Phase 6: Generate Investor Links (Manual)
- Create tracking URLs manually: `/pitch-deck?utm_source=email&utm_campaign=series-a&utm_content=investor-name`
- Store in Notion/Airtable/Spreadsheet for reference

---

## Cost Comparison

| Solution | Monthly Cost | Setup Time |
|----------|-------------|------------|
| HubSpot Professional | $890 | 45 mins |
| Custom Database + Resend | $0 | 2-3 hours |
| Airtable Team | $20 | 30 mins |
| Supabase + Atomic | $25 | 4-5 hours |
| Google Sheets | $0 | 1-2 hours |
| Attio Pro | $86/user | 2-3 hours |

---

## Code References

- PostHog provider: `vendor/analytics/src/providers/posthog/client.tsx:22-67`
- PostHog initialization: `apps/www/src/instrumentation-client.ts:44-46`
- Webhook handler pattern: `apps/console/src/app/(github)/api/github/webhooks/route.ts:462-608`
- Resend email functions: `packages/email/src/functions/all.ts:109-259`
- Activity tracking table: `db/console/src/schema/tables/workspace-user-activities.ts:34-217`
- Metrics tracking table: `db/console/src/schema/tables/workspace-operations-metrics.ts:46-200`
- Inngest workflow pattern: `api/console/src/inngest/workflow/neural/observation-capture.ts:335-1165`

---

## External Resources

- PostHog Webhooks: https://posthog.com/docs/cdp/destinations/webhook
- PostHog Airtable Integration: https://posthog.com/docs/cdp/destinations/airtable
- Attio API: https://developers.attio.com/
- Supabase Webhooks: https://supabase.com/features/database-webhooks
- Atomic CRM: https://supabase.com/partners/integrations/atomic_crm

---

## Related Research

- Original plan: `thoughts/shared/plans/2026-01-28-pitch-deck-posthog-tracking.md`
- PostHog tracking strategy: `thoughts/shared/research/2026-01-28-pitch-deck-posthog-tracking-strategy.md`
- HubSpot MCP research: `thoughts/shared/research/2026-01-28-hubspot-posthog-mcp-phase5-automation.md`

---

## Open Questions

1. Do we want Slack notifications in addition to email for high engagement?
2. Should we build a simple dashboard for viewing engagement, or use PostHog dashboards?
3. Do we need real-time engagement monitoring (would require WebSocket/SSE)?
4. Should investor links be stored in Notion, Airtable, or a simple spreadsheet?
