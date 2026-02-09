---
date: 2026-02-06T12:00:00+08:00
researcher: claude-opus-4-6
topic: "Unified Slack Bot for Lightfast: Replacing Redundant Source-Specific Bots"
tags: [research, web-analysis, slack-bot, discord-bot, notifications, integrations, architecture]
status: complete
created_at: 2026-02-06
confidence: high
sources_count: 12
---

# Web Research: Unified Slack Bot for Lightfast

**Date**: 2026-02-06
**Topic**: Designing a general-purpose Slack bot that leverages Lightfast's context graph to replace redundant source-specific Slack bots (GitHub, Linear, Sentry, Vercel)
**Confidence**: High - based on official Slack/Discord docs, established patterns from incident management platforms, and deep analysis of Lightfast's existing architecture

## Research Question

How should Lightfast design a unified Slack bot that:
1. Replaces individual GitHub, Linear, Sentry, and Vercel Slack bots
2. Leverages the existing context/relationship graph for cross-source intelligence
3. Starts with Slack but is extensible to Discord
4. Delivers contextually enriched notifications (not just forwarded webhooks)

## Executive Summary

Lightfast is uniquely positioned to build a "context-aware" notification bot because it **already has the hard part solved**: the relationship graph that links GitHub PRs to Linear issues to Sentry errors to Vercel deployments. Individual Slack bots (GitHub's, Linear's, Sentry's) each operate in isolation - they can only report events from their own source. A Lightfast bot would be the first to deliver notifications with **cross-source context** - e.g., when a Sentry error fires, the notification includes the linked Linear issue, the GitHub PR that introduced it, and the Vercel deployment it shipped on.

The recommended approach is a **provider-agnostic messaging layer** (Slack first, Discord later) that subscribes to the existing `observation.captured` Inngest event and uses the relationship graph to enrich notifications before delivery. This is architecturally clean because it hooks into the existing event pipeline rather than creating parallel webhook processing.

## Key Findings

### 1. Lightfast's Existing Architecture is Ready for This

**The observation pipeline already emits the right events.**

The `observation.captured` Inngest event (`api/console/src/inngest/workflow/neural/observation-capture.ts`) fires after every processed webhook with:
- `observationId`, `observationType`, `significanceScore`
- `topics`, `entitiesExtracted`, `clusterId`, `clusterIsNew`

The relationship detection system (`api/console/src/inngest/workflow/neural/relationship-detection.ts`) already links:
- **Commit SHAs**: GitHub push ↔ Vercel deployment ↔ Sentry resolution
- **Branch names**: Linear issue ↔ GitHub PR (via `same_branch`)
- **Issue IDs**: PR "Fixes #123" → Linear/GitHub issue (`fixes`, `references`)
- **PR numbers**: Linear attachments → GitHub PRs (`tracked_in`)
- **Sentry triggers**: Linear issue ↔ Sentry error (`triggers`)

The graph API (`packages/console-types/src/api/v1/graph.ts`) already provides `GraphNode`, `GraphEdge`, and `RelatedEvent` schemas for traversal.

**What this means**: The Slack bot doesn't need to build any intelligence layer - it just needs to **read the graph** and format it for messaging platforms.

### 2. Slack Bot SDK: `@slack/bolt` is the Standard

**Official SDK**: `@slack/bolt` (TypeScript/Node.js)
**Source**: [Slack Bolt Documentation](https://slack.dev/bolt-js/)

| Feature | Details |
|---------|---------|
| **Language** | TypeScript/Node.js (matches Lightfast stack) |
| **Connection Modes** | Socket Mode (WebSocket) or HTTP (Events API) |
| **Message Formatting** | Block Kit (rich, interactive messages) |
| **Interactivity** | Buttons, modals, dropdowns, slash commands |
| **Rate Limits** | ~50 req/min per method (Tier 2), burst to 20/min for `chat.postMessage` |
| **Package Size** | ~2MB with dependencies |
| **App Manifest** | YAML-based programmatic configuration |

**Recommended Mode**: **Socket Mode** for initial development (no public URL needed, works behind NAT), with option to switch to HTTP mode for production scale.

**Rate Limits (Critical for design)**:

| Method | Tier | Limit |
|--------|------|-------|
| `chat.postMessage` | Special | 1 per second per channel, burst of 1 |
| `chat.update` | Tier 3 | 50+ per minute |
| `conversations.list` | Tier 2 | 20 per minute |
| `users.list` | Tier 2 | 20 per minute |

**Source**: [Slack Rate Limits](https://api.slack.com/docs/rate-limits)

**Implication**: Need a message queue/debounce layer to avoid hitting `chat.postMessage` limits, especially during deploy storms (multiple Vercel deployments + GitHub pushes + Sentry errors in quick succession).

### 3. Message Threading Strategy: Thread by Context Cluster

The most powerful approach leverages Lightfast's **cluster** system:

**Pattern**: When an observation is captured, check if its cluster already has an active Slack thread. If yes, reply in thread. If no, create a new parent message.

```
Cluster: "Authentication refactor (Sprint 14)"
├── [Thread Parent] 🔄 New activity cluster: Authentication refactor
│   ├── [Reply] 🔀 PR #478 opened: "Refactor auth middleware" (GitHub)
│   ├── [Reply] 📋 LIN-234 moved to In Progress (Linear)
│   ├── [Reply] 🚀 Deployed to preview: auth-refactor-abc123 (Vercel)
│   ├── [Reply] 🐛 New error: JWT validation failed in /api/auth (Sentry)
│   │            └── Related: PR #478, LIN-234, deploy abc123
│   └── [Reply] ✅ PR #478 merged → deployed to production (GitHub + Vercel)
```

This is impossible with individual source bots - they'd each post to different channels with no linking.

### 4. Enriched Notification Format: Cross-Source Context

Instead of just forwarding "PR #478 opened", the Lightfast bot sends:

```
🔀 PR #478 opened: "Refactor auth middleware"
━━━━━━━━━━━━━━━━━━━━━━
Author: @jeevan • Branch: feat/auth-refactor

📎 Related context:
  📋 LIN-234: Refactor authentication system (In Progress)
  🐛 SENTRY-891: JWT validation fails on expired tokens (Resolved)
  🚀 Last deploy: 2h ago (production, healthy)

[View in Lightfast] [View on GitHub] [View Linear Issue]
```

This is the **killer feature** - no other bot can do this because no other system has the cross-source relationship graph.

### 5. Slack vs Discord: Abstraction Design

| Aspect | Slack | Discord |
|--------|-------|---------|
| **SDK** | `@slack/bolt` | `discord.js` |
| **Rich Messages** | Block Kit (JSON blocks) | Embeds (simpler JSON) |
| **Threading** | `thread_ts` on same channel | Separate thread channels |
| **Buttons/Actions** | Block Kit actions + interaction URL | Components (buttons, selects) |
| **Rate Limits** | Strict per-channel | More generous global |
| **Auth Model** | OAuth 2.0 per workspace | Bot token per application |
| **Slash Commands** | Yes, registered per workspace | Yes, registered globally or per guild |
| **Webhooks (outgoing)** | Incoming Webhooks (URL-based) | Webhook URLs per channel |

**Abstraction Layer Design**:

```typescript
// Provider-agnostic message interface
interface NotificationProvider {
  id: 'slack' | 'discord';
  sendMessage(channel: string, message: UnifiedMessage): Promise<MessageRef>;
  updateMessage(ref: MessageRef, message: UnifiedMessage): Promise<void>;
  replyInThread(ref: MessageRef, message: UnifiedMessage): Promise<MessageRef>;
  resolveUser(identity: CrossSourceIdentity): Promise<string | null>;
}

interface UnifiedMessage {
  text: string;  // Plain text fallback
  title?: string;
  fields?: { name: string; value: string; inline?: boolean }[];
  color?: string;  // Hex color for sidebar/embed
  actions?: { label: string; url?: string; actionId?: string }[];
  footer?: string;
}

interface MessageRef {
  provider: 'slack' | 'discord';
  channelId: string;
  messageId: string;  // Slack: ts, Discord: snowflake
  threadId?: string;
}
```

The key insight: **start with a thin abstraction, not a thick one**. Slack Block Kit and Discord Embeds are different enough that a 1:1 mapping loses the best of both. Better to have:
1. A `UnifiedMessage` format for the 80% case
2. Provider-specific overrides for rich formatting

### 6. Products That Consolidate Multiple Bots

| Product | Approach | Key Insight |
|---------|----------|-------------|
| **Rootly** | Incident-centric threading, pulls from PagerDuty/Datadog/Sentry/Jira | Single thread per incident with cross-tool timeline |
| **Incident.io** | Dedicated incident channels, correlates GitHub PRs + Sentry errors | Auto-creates channels, posts updates from all sources |
| **Actioner** | Workflow automation, bidirectional sync across 50+ tools | Smart forms adapt based on integration context |
| **Dispatch (Netflix OSS)** | Pluggable architecture, event-driven, graph-based incident modeling | Best open-source reference for architecture patterns |

**Key takeaway**: All successful unified bots organize around **work units** (incidents, PRs, sprints), not around sources. Lightfast's clusters are the natural work unit.

### 7. Deduplication and Noise Reduction

Critical for replacing individual bots - users currently see 4x notifications for related events.

**Strategy: Significance-Based Gating**

Lightfast already has `significanceScore` with `SIGNIFICANCE_THRESHOLD` gating in the observation pipeline. The Slack bot should apply a **second, higher threshold** for notifications:

| Score Range | Action |
|-------------|--------|
| Below observation threshold | Not captured at all |
| Observation threshold → notification threshold | Captured silently (searchable, not notified) |
| Above notification threshold | Sent to Slack |
| Critical (e.g., production error, deploy failure) | Sent to Slack + @mention relevant users |

**Strategy: Batching Related Events**

When multiple observations hit the same cluster within a short window (e.g., PR merge triggers: GitHub merge event, Vercel deployment, Linear status update), batch them into a single thread update:

```
📦 Cluster update: Authentication refactor
━━━━━━━━━━━━━━━━━━━━━━
3 events in the last 2 minutes:
  ✅ PR #478 merged by @jeevan
  🚀 Deploying to production (Vercel)
  📋 LIN-234 automatically moved to Done
```

### 8. User Identity Mapping

Lightfast already has actor resolution (`api/console/src/inngest/workflow/neural/actor-resolution.ts`) that maps users across GitHub, Vercel, Linear, and Sentry.

For Slack, the additional mapping needed is:
- **Email-based**: Slack profile email → existing source actor emails
- **OAuth-based** (recommended): When user connects Slack in Lightfast, store the Slack user ID alongside their existing source identities

The `SourceActor` type already has `email` for cross-source resolution - Slack users also have profile emails, making matching straightforward.

## Trade-off Analysis

### Approach A: Inngest Subscriber (Recommended)

Hook into existing `observation.captured` event as a new Inngest function.

| Factor | Impact | Notes |
|--------|--------|-------|
| **Implementation effort** | Low | Reuses existing event pipeline |
| **Latency** | ~1-3s after observation | Inngest processing + Slack API |
| **Reliability** | High | Inngest retry + idempotency built-in |
| **Scalability** | High | Inngest concurrency controls per workspace |
| **Architecture fit** | Excellent | Same pattern as existing workflows |
| **Cross-source context** | Full | Can query relationship graph at notification time |

### Approach B: Direct Webhook Forwarding

Process webhooks directly in webhook handlers, forward to Slack.

| Factor | Impact | Notes |
|--------|--------|-------|
| **Implementation effort** | Medium | Duplicate processing logic |
| **Latency** | ~200ms | Direct webhook → Slack |
| **Reliability** | Lower | No built-in retry/idempotency |
| **Scalability** | Medium | Manual rate limiting needed |
| **Architecture fit** | Poor | Bypasses neural pipeline, loses context |
| **Cross-source context** | None | No relationship graph at webhook time |

### Approach C: Full Slack App with Socket Mode

Standalone bot with Socket Mode, polls Lightfast API for updates.

| Factor | Impact | Notes |
|--------|--------|-------|
| **Implementation effort** | High | Separate service, auth, deployment |
| **Latency** | Variable | Depends on polling interval |
| **Reliability** | Medium | Additional service to manage |
| **Scalability** | Medium | WebSocket connection per workspace |
| **Architecture fit** | Poor | Separate from main pipeline |
| **Cross-source context** | Partial | API queries required |

## Recommendations

Based on research findings:

### 1. **Use Inngest Subscriber Pattern** (Approach A)

Create a new Inngest function `notification.dispatch` that subscribes to `observation.captured`. This is the natural extension of the existing pipeline:

```
Webhook → Transform → Observation Capture → [observation.captured event]
                                                        ↓
                                              notification.dispatch (NEW)
                                                        ↓
                                              Query relationship graph
                                                        ↓
                                              Format enriched message
                                                        ↓
                                              Send via provider (Slack/Discord)
```

### 2. **Create a `@repo/console-notifications` package**

Following the existing monorepo patterns:
- `packages/console-notifications/` - Provider-agnostic notification types and routing
- Provider adapters: `slack.ts`, `discord.ts` (future)
- Message formatting: `UnifiedMessage` → platform-specific blocks/embeds
- Thread registry: Maps cluster IDs → active Slack threads

### 3. **Start with Incoming Webhooks, Upgrade to Full Bot**

Phase 1: Use Slack Incoming Webhooks (simplest, one-way)
- Just posting enriched notifications to configured channels
- No OAuth, no interactive features, no slash commands
- Can be implemented in a single Inngest function

Phase 2: Upgrade to full `@slack/bolt` app
- Interactive features: click to view graph, acknowledge, snooze
- Slash commands: `/lightfast search <query>`, `/lightfast graph <entity>`
- App Home: notification preferences, connected sources status
- OAuth flow for multi-workspace distribution

### 4. **Thread by Cluster with Significance Gating**

- Parent message per cluster (when first notification-worthy observation arrives)
- Thread replies for subsequent observations in same cluster
- Batching window: 2 minutes to collect related events before sending
- Notification threshold: Higher than observation capture threshold
- Critical events bypass batching and send immediately

### 5. **Design the Provider Abstraction from Day 1**

Even though Discord comes later, define the `NotificationProvider` interface now. The cost is minimal (one interface file) and it prevents Slack-specific assumptions from leaking into the notification logic.

## Proposed Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                    Existing Lightfast Pipeline                 │
│                                                               │
│  GitHub ──┐                                                   │
│  Linear ──┤  Webhooks → Transformers → Observation Capture    │
│  Sentry ──┤                                ↓                  │
│  Vercel ──┘                     observation.captured event     │
│                                        ↓                      │
│  ┌─────────────────────────────────────────────────────┐      │
│  │            NEW: Notification Dispatch                │      │
│  │                                                      │      │
│  │  1. Check notification preferences (workspace-level) │      │
│  │  2. Apply notification threshold (> observation)     │      │
│  │  3. Query relationship graph for context              │      │
│  │  4. Batch with recent cluster events (2min window)   │      │
│  │  5. Format UnifiedMessage                            │      │
│  │  6. Route to channels (per routing rules)            │      │
│  │  7. Send via provider adapter                        │      │
│  │                                                      │      │
│  │  ┌──────────┐  ┌──────────────┐  ┌────────────┐     │      │
│  │  │  Slack   │  │   Discord    │  │   Future   │     │      │
│  │  │ Adapter  │  │   Adapter    │  │  Adapters  │     │      │
│  │  └──────────┘  └──────────────┘  └────────────┘     │      │
│  └─────────────────────────────────────────────────────┘      │
│                                                               │
│  Database additions:                                          │
│  - notification_channels (workspace → Slack/Discord channels) │
│  - notification_threads (cluster → active thread mapping)     │
│  - notification_preferences (per-workspace routing rules)     │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

## Phased Implementation Plan

### Phase 1: MVP (Incoming Webhooks)
- Add `notification_channels` table with Slack webhook URLs
- New Inngest function subscribing to `observation.captured`
- Basic enrichment: query 1-hop relationships from graph
- Post to configured Slack channel via webhook
- Simple threading by cluster ID
- **Effort**: ~2-3 days

### Phase 2: Rich Notifications
- Block Kit formatting with cross-source context cards
- Significance-based routing (critical → #incidents, normal → #engineering)
- Event batching (2-minute window for cluster events)
- User mention mapping (email-based)
- **Effort**: ~3-5 days

### Phase 3: Interactive Bot
- Upgrade to `@slack/bolt` with Socket Mode
- Slash commands: `/lightfast search`, `/lightfast graph`
- Interactive buttons: "View in Lightfast", "Snooze cluster"
- App Home with notification preferences
- **Effort**: ~5-7 days

### Phase 4: Discord Support
- Implement `DiscordAdapter` using `discord.js`
- Map UnifiedMessage → Discord Embeds
- Discord-specific threading (forum channels or threads)
- **Effort**: ~3-4 days (adapter only, core logic reused)

## Risk Assessment

### High Priority
- **Rate limiting storms**: Deploy events can trigger 4+ observations in seconds → queue/batch before Slack API
  - **Mitigation**: 2-minute batching window, per-channel rate limiter
- **Thread sprawl**: Too many threads makes channels unusable
  - **Mitigation**: Thread reuse by cluster, auto-archive after 24h inactivity

### Medium Priority
- **Stale thread mapping**: Cluster IDs may not be stable long-term
  - **Mitigation**: TTL on thread mappings, graceful fallback to new thread
- **Notification fatigue**: Even enriched notifications can be too many
  - **Mitigation**: Configurable notification threshold per workspace, digest mode option
- **Slack app review**: Distribution requires Slack marketplace approval
  - **Mitigation**: Start with single-workspace install, apply for review when ready

### Low Priority
- **Discord formatting gaps**: Some Block Kit features have no Discord equivalent
  - **Mitigation**: Graceful degradation in adapter layer

## Open Questions

- **Should the bot support bidirectional actions?** (e.g., close Linear issue from Slack) - Adds significant complexity, recommend deferring to Phase 4+
- **Per-user vs per-workspace notification preferences?** - Start with per-workspace, add per-user in Phase 3 via App Home
- **Should notifications be opt-in or opt-out?** - Recommend opt-in: workspace admin configures channels and routing rules
- **Real-time vs near-real-time?** - Inngest adds ~1-3s latency which is acceptable for notifications; real-time only matters for incident alerting

## Sources

### Official Documentation
- [Slack Bolt for JavaScript](https://slack.dev/bolt-js/) - Slack, 2025
- [Slack Block Kit](https://api.slack.com/block-kit) - Slack, 2025
- [Slack Rate Limits](https://api.slack.com/docs/rate-limits) - Slack, 2025
- [Slack Socket Mode](https://api.slack.com/apis/connections/socket) - Slack, 2025
- [Slack App Manifest](https://api.slack.com/reference/manifests) - Slack, 2025
- [Discord.js Guide](https://discordjs.guide/) - Discord.js, 2025
- [Discord API - Interactions](https://discord.com/developers/docs/interactions/receiving-and-responding) - Discord, 2025

### Architecture References
- [Netflix Dispatch](https://github.com/Netflix/dispatch) - Netflix OSS, incident management with Slack
- [Rootly Architecture](https://rootly.com/) - Incident management platform
- [Incident.io Engineering Blog](https://incident.io/blog) - Unified incident response patterns

### Lightfast Codebase (Internal)
- `api/console/src/inngest/workflow/neural/observation-capture.ts` - Event pipeline entry point
- `api/console/src/inngest/workflow/neural/relationship-detection.ts` - Cross-source graph builder
- `packages/console-types/src/api/v1/graph.ts` - Graph API schemas
- `packages/console-types/src/neural/source-event.ts` - SourceEvent/SourceReference types
- `packages/console-webhooks/src/transformers/` - Source-specific webhook transformers

---

**Last Updated**: 2026-02-06
**Confidence Level**: High - Based on official SDK documentation, established architectural patterns from incident management platforms, and deep analysis of Lightfast's existing event pipeline
**Next Steps**: This research supports building a unified notification bot. Recommended first action: create a plan document for Phase 1 (Incoming Webhooks MVP) implementation.
