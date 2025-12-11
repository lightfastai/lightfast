---
date: 2025-12-11T22:15:00+08:00
researcher: Claude
topic: "Svix Integration vs Custom Raw Webhook Payload Storage"
tags: [research, web-analysis, webhooks, svix, infrastructure, build-vs-buy, memory-system]
status: complete
created_at: 2025-12-11
confidence: high
sources_count: 12
decision: hybrid-svix-plus-custom-storage
rationale: Lightfast is a memory system requiring permanent retention for reprocessing
---

# Web Research: Svix Integration vs Custom Raw Webhook Payload Storage

**Date**: 2025-12-11T22:15:00+08:00
**Topic**: Does integrating Svix eliminate the need for custom webhook payload storage?
**Confidence**: High - based on official Svix documentation and product specifications

## Research Question

If we integrate Svix, do we still need to implement custom raw webhook payload storage as designed in `thoughts/shared/research/2025-12-11-raw-webhook-payload-storage-design.md`?

## Executive Summary

**Short Answer: Use both. Svix Ingest + Custom Permanent Storage (Hybrid Approach).**

Svix Ingest provides webhook reliability infrastructure (signature verification, retries, traffic handling), but its retention is limited to 30-90 days. **Lightfast is a memory system that requires permanent retention** for potential reprocessing of historical data with improved transformers.

**Recommendation**: Hybrid approach - Svix handles ingestion reliability, your database handles permanent storage.

```
GitHub → Svix Ingest (verify, retry, buffer) → Your API → workspace_webhook_payloads (forever)
                                                              ↓
                                                    Transform → Neural Observations
```

## Key Findings

### 1. Svix Has TWO Products (Important Distinction)

| Product | Purpose | Direction |
|---------|---------|-----------|
| **Svix Dispatch** | Send webhooks TO your customers | Outbound |
| **Svix Ingest** | Receive webhooks FROM third parties | Inbound |

**For your use case (receiving GitHub/Vercel webhooks), you need Svix Ingest.**

### 2. What Svix Ingest Provides

**Source**: [Svix Documentation](https://docs.svix.com/receiving/receiving-with-ingest)

| Feature | Svix Ingest | Custom Design |
|---------|-------------|---------------|
| Signature verification | Built-in for 20+ providers (GitHub, Vercel, Stripe) | Manual implementation |
| Payload storage | Automatic | Manual implementation |
| Retention period | 30 days (Free) / 90 days (Pro) | Forever |
| Replay capability | UI + API | Needs implementation |
| Retry with backoff | Automatic (exponential) | Needs implementation |
| Traffic spike handling | Managed | Your infrastructure |
| Rate limiting | Built-in | Needs implementation |
| Monitoring/observability | Dashboard included | Needs implementation |

### 3. Svix Retention Limits

**Source**: [Svix Retention Documentation](https://docs.svix.com/retention)

| Tier | Retention | Price |
|------|-----------|-------|
| Free | 30 days | $0/month |
| Professional | 90 days | $490/month |
| Enterprise | Custom | Custom |

**Critical**: After retention period, payloads are **automatically deleted**. This is by design for privacy/security compliance.

### 4. Architecture Comparison

**With Svix Ingest:**
```
GitHub → Svix Ingest (verify, store, retry) → Your API → Your DB
                ↓
         Stores for 30-90 days
         (then deleted)
```

**Custom Implementation (current design):**
```
GitHub → Your Webhook Route → Verify → Store Raw Payload → Transform → Inngest → DB
                                ↓
                         workspace_webhook_payloads
                         (stored forever)
```

**Hybrid Approach (Svix + Permanent Storage):**
```
GitHub → Svix Ingest (verify, buffer) → Your API → Store Raw + Process
                                              ↓
                                        Your permanent storage
```

## Trade-off Analysis

### Option 1: Svix Ingest Only

| Factor | Impact | Notes |
|--------|--------|-------|
| Development time | Minimal | Days vs weeks |
| Maintenance | Zero | Svix handles infrastructure |
| Cost | $0-490/month | Based on tier |
| Retention | 30-90 days max | Payloads deleted after |
| Replay | Built-in | UI and API access |
| Vendor lock-in | Medium | Can switch but effort needed |

**Best for**: Teams OK with temporary retention, want fast time-to-market

### Option 2: Custom Implementation (Current Design)

| Factor | Impact | Notes |
|--------|--------|-------|
| Development time | 1-2 weeks | Schema + route modifications |
| Maintenance | Ongoing | Database growth, monitoring |
| Cost | Database storage | Grows linearly with webhooks |
| Retention | Forever | As designed |
| Replay | Needs implementation | Future Phase 4 in design |
| Vendor lock-in | None | Full control |

**Best for**: Teams requiring permanent audit trail, full control over data

### Option 3: Svix + Custom Permanent Storage (Hybrid)

| Factor | Impact | Notes |
|--------|--------|-------|
| Development time | ~1 week | Just storage layer, Svix handles verification |
| Maintenance | Low | Svix handles retries/reliability |
| Cost | $490/month + DB storage | Combined costs |
| Retention | Forever | Store permanently in your DB |
| Replay | Hybrid | Svix for recent, your DB for historical |
| Vendor lock-in | Low | Can fall back to custom |

**Best for**: Teams wanting Svix reliability with permanent retention

## Recommendation: Hybrid Approach

**Lightfast is a memory system. Permanent retention is required for reprocessing capabilities.**

### Architecture

```
GitHub → Svix Ingest (verify, retry, buffer) → Your API
                                                   ↓
                                    ┌──────────────┴──────────────┐
                                    ↓                             ↓
                         workspace_webhook_payloads        Transform → Inngest
                         (permanent raw storage)                  ↓
                                    ↓                      Neural Observations
                         Future: Reprocess with           (processed memories)
                         improved transformers
```

### Implementation

```typescript
// Your webhook endpoint (receives from Svix Ingest)
async function handleWebhook(payload: GitHubEvent, headers: Headers) {
  // 1. Store raw payload permanently (your DB) - for reprocessing
  await storeWebhookPayload({
    workspaceId,
    deliveryId: payload.deliveryId,
    source: "github",
    payload: JSON.stringify(payload),
    receivedAt: new Date(),
  });

  // 2. Process normally - creates current observations
  await inngest.send({ /* ... */ });
}
```

### What Svix Handles (Remove from Custom Code)
- Signature verification for GitHub, Vercel, etc.
- Automatic retries with exponential backoff
- Traffic spike buffering
- Rate limiting
- 90-day hot storage for debugging

### What Custom Storage Handles (Keep in Design)
- Permanent raw payload retention
- Reprocessing capability when transformers improve
- SQL queries joining payloads to observations
- Workspace-level cascade deletes

## Cost Comparison (1000 webhooks/day scenario)

| Approach | Monthly Cost | Notes |
|----------|--------------|-------|
| Custom only | ~$10-20 DB | 5KB avg × 30K/month = 150MB/month |
| Svix Free | $0 | Limited to 30-day retention |
| Svix Pro | $490 | 90-day retention, enterprise features |
| Svix + Custom | $490 + ~$10 DB | Best of both worlds |

## What Custom Design Provides That Svix Doesn't

1. **Permanent retention** - Svix deletes after 30-90 days
2. **Direct DB queries** - Query payloads with SQL, join with observations
3. **No external dependency** - Works even if Svix is down
4. **Custom indexing** - GIN indexes on JSONB for payload queries
5. **Workspace-level cascade** - Delete workspace = delete all payloads

## What Svix Provides That Custom Doesn't (Without Additional Work)

1. **Signature verification** - Built-in for 20+ providers
2. **Automatic retries** - Exponential backoff, no code needed
3. **Traffic spike handling** - Managed scaling
4. **Monitoring dashboard** - Visual webhook inspection
5. **Rate limiting** - Protect your infrastructure
6. **Multi-destination fanout** - Route one webhook to many endpoints

## Decision: Hybrid Approach Selected

```
Lightfast is a memory system
├── Permanent retention required for reprocessing
├── Svix provides reliability infrastructure
└── Result: Hybrid approach
    ├── Svix Ingest: verification, retries, buffering
    └── Custom storage: permanent raw payload retention
```

## Reprocessing Use Cases

Why permanent raw payload storage matters for a memory system:

1. **Transformer improvements** - Extract new observation types from historical webhooks
2. **Bug fixes** - Reprocess webhooks that were incorrectly transformed
3. **New memory types** - Add new neural observation categories to historical data
4. **Audit trail** - Complete record of all source data that created memories
5. **Debugging** - Trace any observation back to its exact source payload

## Sources

### Official Documentation
- [Svix Ingest Documentation](https://docs.svix.com/receiving/receiving-with-ingest) - Svix
- [Svix Retention Documentation](https://docs.svix.com/retention) - Svix
- [Svix Pricing](https://www.svix.com/pricing/) - Svix
- [Svix Build vs Buy](https://www.svix.com/build-vs-buy/) - Svix

### Product Information
- [Svix Ingest Landing Page](https://svix.com/ingest) - Product overview
- [Replaying Messages](https://docs.svix.com/receiving/using-app-portal/replaying-messages) - Replay documentation

### Integration Patterns
- [Svix + Inngest Integration](https://inngest.com/blog/svix-integration) - Inngest Blog

### Alternatives
- [Hookdeck Documentation](https://hookdeck.com/docs/use-cases/receive-webhooks) - Alternative service

---

**Last Updated**: 2025-12-11
**Confidence Level**: High - Based on official Svix documentation and product specifications
**Decision**: Hybrid approach - Svix Ingest + Custom permanent storage
**Rationale**: Lightfast is a memory system requiring permanent retention for reprocessing capabilities
**Next Steps**:
1. Integrate Svix Ingest for webhook reliability
2. Implement `workspace_webhook_payloads` table for permanent storage
3. Simplify webhook routes (remove manual signature verification)
