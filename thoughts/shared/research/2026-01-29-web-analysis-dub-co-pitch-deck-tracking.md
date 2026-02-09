---
date: 2026-01-29T14:30:00Z
researcher: Claude
topic: "Dub.co as Alternative for Pitch Deck Investor Tracking"
tags: [research, web-analysis, dub-co, link-tracking, investor-tracking, pitch-deck]
status: complete
created_at: 2026-01-29
confidence: high
sources_count: 12
related_research: thoughts/shared/research/2026-01-29-pitch-deck-tracking-hubspot-alternatives.md
---

# Web Research: Dub.co as Alternative for Pitch Deck Investor Tracking

**Date**: 2026-01-29T14:30:00Z
**Topic**: Can Dub.co replace the custom webhook approach for investor tracking?
**Confidence**: High - Based on official documentation and direct feature comparison

## Research Question

The original research (`thoughts/shared/research/2026-01-29-pitch-deck-tracking-hubspot-alternatives.md`) proposed using PostHog webhooks → Custom Database → Resend for investor tracking. Can Dub.co's link shortener with custom domains provide a simpler solution?

## Executive Summary

**Yes and No.** Dub.co is an excellent addition to the tracking stack but **cannot fully replace PostHog** for pitch deck tracking. Here's why:

| Tracking Need | Dub.co | PostHog |
|---------------|--------|---------|
| Who clicked the link | ✅ | ❌ |
| When they clicked | ✅ | ⚠️ (via pageview) |
| Geographic location | ✅ | ✅ |
| Device/browser | ✅ | ✅ |
| **Scroll depth per slide** | ❌ | ✅ |
| **Time on each slide** | ❌ | ✅ |
| **Which slides they viewed** | ❌ | ✅ |
| **Session replay** | ❌ | ✅ |
| Real-time notifications | ✅ (webhooks) | ⚠️ (needs custom) |

**Recommendation**: Use **Dub.co + PostHog together** for the best of both worlds, OR use Dub.co alone if you only need click attribution (simpler but less insight).

---

## Dub.co Overview

### What Is Dub.co?

Dub.co is a modern link management platform (like Bitly but better) with:
- Short links with custom domains
- Real-time analytics (clicks, geography, devices)
- Conversion tracking (clicks → leads → sales)
- Webhooks for real-time notifications
- API/SDKs for programmatic link creation

### Pricing

| Plan | Price | Tracked Clicks | Links/Month | Custom Domains | Analytics Retention |
|------|-------|---------------|-------------|----------------|---------------------|
| **Free** | $0 | 1,000 | 25 | 3 | 30 days |
| **Pro** | $25/mo | 50,000 | 1,000 | 10 | 1 year |
| **Business** | $75/mo | 250,000 | 5,000 | 100 | 3 years |

**Key Feature**: Webhooks are available on all plans, including free!

---

## Option Analysis: Dub.co vs Custom Webhook

### Option A: Dub.co Only (Simplest)

**Architecture**:
```
Investor clicks: links.lightfast.ai/sequoia → lightfast.ai/pitch-deck?utm_content=sequoia
                            ↓
                    Dub.co tracks click
                            ↓
                    Webhook → Slack notification
```

**What You Get**:
- ✅ Know who clicked (via personalized slug or UTM)
- ✅ Geographic location (country/city)
- ✅ Device type (mobile/desktop)
- ✅ Click timestamp
- ✅ Real-time Slack notification
- ✅ Custom domain branding (links.lightfast.ai)

**What You Lose**:
- ❌ No scroll depth tracking
- ❌ No time-on-page tracking
- ❌ No slide-by-slide analytics
- ❌ No session replay
- ❌ Can't see if they read 10% or 100% of deck

**Cost**: $0-25/month
**Setup Time**: ~30 minutes

**Best For**: Quick MVP, knowing WHO clicked but not HOW they engaged.

---

### Option B: Dub.co + PostHog (Recommended)

**Architecture**:
```
Investor clicks: links.lightfast.ai/sequoia → lightfast.ai/pitch-deck?utm_content=sequoia
                            ↓                              ↓
                    Dub.co tracks click         PostHog tracks engagement
                            ↓                              ↓
                    Webhook → Slack              usePitchDeckTracking hook
                    "Sequoia just clicked!"     → slides viewed, time, scroll
```

**What You Get**:
- ✅ Everything from Dub.co (click attribution, Slack notifications)
- ✅ Scroll depth per slide
- ✅ Time spent on each slide
- ✅ Complete session replay
- ✅ Engagement scoring (did they view 90%+ → "hot lead")

**What You Lose**:
- Nothing! Full attribution + full engagement

**Cost**: $25/month (Dub.co Pro) + PostHog (free tier likely sufficient)
**Setup Time**: ~3-4 hours (Dub.co + PostHog tracking hook)

**Best For**: Serious investor tracking with actionable engagement data.

---

### Option C: Custom Webhook Only (Original Plan)

**Architecture**:
```
PostHog tracks everything → Webhook → Custom API → Database → Resend notification
```

**What You Get**:
- ✅ Full engagement tracking
- ✅ Email notifications
- ✅ No external dependencies

**What You Lose**:
- ❌ No short links (long URLs with UTM params)
- ❌ No custom domain branding
- ❌ More development work

**Cost**: $0 (uses existing infra)
**Setup Time**: ~2-3 hours

**Best For**: Maximum control, minimal external dependencies.

---

## Comparison Matrix

| Feature | Dub.co Only | Dub.co + PostHog | Custom Webhook |
|---------|-------------|------------------|----------------|
| **Setup Time** | 30 min | 3-4 hours | 2-3 hours |
| **Monthly Cost** | $0-25 | $25 | $0 |
| **Click Attribution** | ✅ Excellent | ✅ Excellent | ⚠️ Via UTM |
| **Engagement Depth** | ❌ None | ✅ Full | ✅ Full |
| **Slack Notifications** | ✅ Native | ✅ Native | ⚠️ Custom |
| **Custom Domain** | ✅ Yes | ✅ Yes | ❌ No |
| **Short Links** | ✅ Yes | ✅ Yes | ❌ No |
| **External Dependency** | 1 (Dub.co) | 2 (Dub.co + PostHog) | 0 |

---

## Dub.co Implementation Details

### Setting Up Custom Domain

1. Navigate to Dub.co Dashboard → Domains
2. Add domain: `links.lightfast.ai`
3. Add DNS records:
   - `CNAME links → cname.dub.co`
   - Or `A record → Dub.co IP`
4. Wait for verification (~5 min)

### Creating Investor Links

**Manual (Dashboard)**:
```
Short URL: links.lightfast.ai/sequoia
Destination: https://lightfast.ai/pitch-deck?utm_source=email&utm_campaign=series-a&utm_content=sequoia
```

**Programmatic (API)**:
```typescript
import { Dub } from "dub";

const dub = new Dub({ token: process.env.DUB_API_KEY });

const link = await dub.links.create({
  domain: "links.lightfast.ai",
  key: "sequoia",
  url: "https://lightfast.ai/pitch-deck?utm_source=email&utm_campaign=series-a&utm_content=sequoia",
  externalId: "sequoia-capital",
  tags: ["investor", "series-a"],
});
```

### Webhook Configuration

**Dub.co Dashboard → Webhooks → New Webhook**:
```json
{
  "name": "Investor Click Notifications",
  "url": "https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK",
  "events": ["link.clicked"],
  "filters": {
    "tags": ["investor"]
  }
}
```

**Webhook Payload (Click Event)**:
```json
{
  "event": "link.clicked",
  "data": {
    "click": {
      "id": "d0UtZqE0BZuBPrJS",
      "timestamp": "2026-01-29T14:30:00Z",
      "ip": "63.141.57.109",
      "country": "US",
      "city": "San Francisco",
      "device": "Desktop",
      "browser": "Chrome",
      "os": "Mac OS"
    },
    "link": {
      "domain": "links.lightfast.ai",
      "key": "sequoia",
      "url": "https://lightfast.ai/pitch-deck?utm_content=sequoia",
      "externalId": "sequoia-capital"
    }
  }
}
```

---

## Recommendation for Lightfast

### Immediate Action (MVP): Dub.co Only

If you want to ship fast:
1. Set up Dub.co Pro ($25/mo)
2. Add custom domain `links.lightfast.ai`
3. Create webhook → Slack for click notifications
4. Generate investor links manually

**Time**: 30 minutes
**Insight Level**: Basic (who clicked, when, where)

### Full Solution: Dub.co + PostHog

For serious investor tracking:
1. Set up Dub.co (as above)
2. Implement `usePitchDeckTracking` hook (from original plan)
3. Configure PostHog webhook → Custom API (optional, for email notifications)

**Time**: 3-4 hours
**Insight Level**: Complete (click + engagement + notifications)

### Implementation Priority (Updated)

| Phase | Task | Time |
|-------|------|------|
| 1 | Set up Dub.co + custom domain | 30 min |
| 2 | Create Slack webhook for click notifications | 15 min |
| 3 | Generate initial investor links | 15 min |
| 4 | (Optional) Add PostHog tracking hook | 2-3 hrs |
| 5 | (Optional) Add email notifications for high engagement | 1 hr |

---

## Cost Comparison (Updated)

| Solution | Monthly Cost | What You Get |
|----------|--------------|--------------|
| **Dub.co Free** | $0 | 1,000 clicks, 25 links, Slack notifications |
| **Dub.co Pro** | $25 | 50,000 clicks, 1,000 links, 1 year retention |
| **Dub.co + PostHog** | $25 | Full attribution + engagement |
| **Custom Webhook** | $0 | Full engagement, no short links |
| **HubSpot (original)** | $890 | Overkill for this use case |

---

## Key Insight

**Dub.co is the missing piece for link branding and click attribution.** The original plan was focused on engagement tracking (PostHog) but missed the opportunity to:

1. Use branded short links (looks more professional)
2. Get instant Slack notifications on clicks (no custom webhook needed)
3. Have a clean dashboard for link analytics

**Best of both worlds**: Use Dub.co for link management + PostHog for engagement depth.

---

## Sources

### Official Documentation
- [Dub.co Analytics Features](https://dub.co/features/analytics)
- [Dub.co Webhooks](https://dub.co/docs/concepts/webhooks/introduction)
- [Dub.co Pricing](https://dub.co/pricing)
- [Dub.co Custom Domains](https://dub.co/help/article/how-to-add-custom-domain)

### Comparisons
- [Dub vs Bitly](https://dub.co/compare/bitly)
- [Bitly vs Rebrandly](https://dub.co/blog/bitly-vs-rebrandly)

### Integration Patterns
- [Dub.co Client-Side Tracking](https://dub.co/docs/conversions/leads/client-side)
- [PostHog Scroll Depth](https://posthog.com/tutorials/scroll-depth)

---

## Open Questions

1. Do you want short links (Dub.co) or is the raw URL with UTM params acceptable?
2. Is Slack notification sufficient, or do you need email for high engagement?
3. How many investor links do you expect to create? (affects tier choice)
4. Do you need the engagement depth (scroll/time per slide) or just click attribution?

---

**Next Steps**: Based on your answers to the open questions, I can:
- Implement Dub.co-only solution (30 min)
- Implement Dub.co + PostHog solution (3-4 hrs)
- Stick with custom webhook approach from original plan
