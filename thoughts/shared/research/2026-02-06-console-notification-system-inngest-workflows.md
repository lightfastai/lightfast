---
date: 2026-02-06T02:08:56Z
researcher: claude
git_commit: 5eaa1050042cde2cbd11f812af558fc900123918
branch: feat/definitive-links-strict-relationships
repository: lightfast
topic: "Console Notification System: Inngest Workflow Events & next-forge Knock Pattern"
tags: [research, codebase, notifications, inngest, knock, next-forge, console]
status: complete
last_updated: 2026-02-06
last_updated_by: claude
last_updated_note: "Added Slack bot reference from unified-slack-bot-architecture research, updated architecture diagrams"
---

# Research: Console Notification System — Inngest Workflow Events & next-forge Knock Pattern

**Date**: 2026-02-06T02:08:56Z
**Researcher**: claude
**Git Commit**: 5eaa1050042cde2cbd11f812af558fc900123918
**Branch**: feat/definitive-links-strict-relationships
**Repository**: lightfast

## Research Question

What core functionalities in the Lightfast console app (specifically Inngest workflows in `@api/console/src/inngest/`) should surface as user-facing notifications? How does next-forge's notification package work as a reference architecture?

## Summary

The console app runs **20+ Inngest workflows** across 5 categories (orchestration, processing, neural memory, infrastructure, providers) that process engineering events asynchronously. Today, users see workflow status only through a **jobs table** (polling every 5s) and an **activity timeline**. There is no real-time notification system — no push, no WebSocket, no in-app notification feed.

next-forge uses **Knock** (knock.app) as a thin, workflow-based notification layer with an in-app feed popover, requiring only ~7 files. The pattern delegates template management and multi-channel orchestration to Knock's platform.

**Key insight**: User-facing notifications should surface **workspace intelligence** — engineering events, cross-source connections, new contributors, cluster insights — not internal system health (sync failures, embedding errors, config issues). Infrastructure status already lives in the jobs table. The notification feed is where Lightfast's cross-source relationship graph delivers unique value that no individual tool can provide.

---

## Detailed Findings

### 1. next-forge Notification Architecture (Reference)

next-forge uses **Knock** (`@knocklabs/node` + `@knocklabs/react`) with this structure:

```
packages/notifications/
├── components/
│   ├── provider.tsx        # KnockProvider + KnockFeedProvider wrapper
│   └── trigger.tsx         # Bell icon + NotificationFeedPopover
├── index.ts                # Server-side Knock client singleton
├── keys.ts                 # t3-env validated environment variables
├── styles.css              # CSS overrides for Knock UI
└── package.json
```

**Key patterns:**
- **Server-side**: `notifications.workflows.trigger('workflow-key', { recipients, data })` — triggered from backend code
- **Client-side**: `KnockProvider` wraps authenticated layout, `NotificationsTrigger` bell icon placed in sidebar footer
- **Graceful degradation**: All components return null/children if env vars not set
- **Theme sync**: Provider accepts `theme` prop from `next-themes` for dark/light mode
- **Channels**: In-app feed by default; email, SMS, push, Slack configurable via Knock dashboard (no code changes)
- **Workflow-based**: Templates managed in Knock dashboard, not in code

**Integration in next-forge app:**
- Provider wraps `(authenticated)/layout.tsx`
- Bell icon placed in `SidebarFooter` next to user avatar and theme toggle
- User ID from Clerk passed to `KnockProvider` for feed authentication

---

### 2. Current Console Notification Landscape

#### What Exists Today

| Pattern | Technology | Usage |
|---------|-----------|-------|
| Toast notifications | Sonner (sonner ^2.0.6) | Immediate feedback for user actions (15+ components) |
| Email | Resend (@vendor/email) | Auth verification codes only |
| Static alerts | shadcn/ui Alert | Security notices, failed payments |
| Jobs table | React Query + polling | Background job status display |
| Activity timeline | React component + tRPC | Audit log display |

#### What Does NOT Exist

- No in-app notification feed/inbox
- No real-time push (WebSocket/SSE)
- No notification preferences/settings
- No cross-channel notification orchestration
- No notification service (Knock, Novu, etc.)

#### Current Jobs Display (`apps/console/src/components/jobs-table.tsx`)
- Fetches up to 50 jobs via `trpc.jobs.list`
- **Polls every 5 seconds** when running jobs exist (line 398)
- Status icons: green CheckCircle2 (completed), red XCircle (failed), spinning Loader2 (running), Clock (queued)
- Expandable details show error messages and JSON output
- Restart action available for completed/failed/cancelled jobs

#### Current Activity Timeline (`apps/console/src/components/activity-timeline.tsx`)
- Receives activities from parent via props
- Filters by 11 categories: auth, workspace, integration, store, job, search, document, permission, api_key, settings
- Displays max 20 items with color-coded icons
- 3-tier recording: Tier 1 (synchronous critical), Tier 2 (Inngest queue), Tier 3 (fire-and-forget)

---

### 3. Inngest Workflow Inventory — Notification Candidates

#### Category A: Source Sync Workflows (High User Impact)

These workflows run when users connect integrations or push code. Users actively wait for results.

**1. Sync Orchestrator** (`workflow/orchestration/sync-orchestrator.ts`)
- **Event**: `apps-console/sync.requested`
- **Function**: `apps-console/sync.orchestrator`
- **What it does**: Unified entry point for all source syncs. Creates job, validates workspace config, routes to source-specific orchestrator, waits up to 25 minutes for completion, records final metrics.
- **User-visible state changes**: Job created → running → completed/failed. Source `lastSyncedAt` updated.
- **Notification candidates**:
  - Sync started (informational)
  - **Sync completed** with item counts (success)
  - **Sync failed** with error details (critical)

**2. GitHub Sync Orchestrator** (`workflow/sources/github-sync-orchestrator.ts`)
- **Event**: `apps-console/github.sync.trigger`
- **Function**: `apps-console/github.sync.orchestrator`
- **What it does**: Fetches repo file tree, filters by `lightfast.yml` patterns, batches into groups of 50, waits for all batch completions (10 min timeout per batch), aggregates metrics.
- **User-visible state changes**: Files indexed/updated in search.
- **Notification candidates**:
  - **Batch processing progress** (X of Y files processed)
  - Config file not found warning

**3. GitHub Push Handler** (`workflow/providers/github/push-handler.ts`)
- **Event**: `apps-console/github.push`
- **Function**: `apps-console/github-push-handler`
- **What it does**: Routes GitHub push webhooks. Detects config file changes (triggers full sync) vs. normal pushes (triggers incremental sync).
- **User-visible state changes**: Triggers sync based on push.
- **Notification candidates**:
  - **Push received** — new commit detected (informational)
  - **Config change detected** — full re-sync triggered (important)
  - Push filtered (event not in allowed sync events)

#### Category B: Document Processing Workflows (Medium User Impact)

These run as children of sync workflows. Users care about the aggregate result, not individual operations.

**4. File Batch Processor** (`workflow/processing/files-batch-processor.ts`)
- **Event**: `apps-console/files.batch.process`
- **Function**: `apps-console/files.batch.processor`
- **What it does**: Fetches file contents from GitHub, transforms to documents, sends to document processor. Up to 10 batches in parallel per workspace.
- **Notification candidates**: Covered by parent sync notifications.

**5. Process Documents** (`workflow/processing/process-documents.ts`)
- **Event**: `apps-console/documents.process`
- **Function**: `apps-console/process-documents`
- **What it does**: Parses, chunks, embeds (Cohere), upserts to Pinecone, persists to database. Batches 25 docs with 5s timeout.
- **User-visible state changes**: Documents searchable after processing.
- **Notification candidates**:
  - **Embedding failures** (external API errors — Cohere/Pinecone)

**6. Delete Documents** (`workflow/processing/delete-documents.ts`)
- **Event**: `apps-console/documents.delete`
- **Function**: `apps-console/delete-documents`
- **What it does**: Removes documents from Pinecone and database.
- **Notification candidates**: Covered by parent sync notifications.

#### Category C: Neural Memory Workflows (Medium-High User Impact)

These process engineering events into the observation/intelligence layer. Users benefit from knowing when insights are ready.

**7. Observation Capture** (`workflow/neural/observation-capture.ts`)
- **Event**: `apps-console/neural/observation.capture`
- **Function**: `apps-console/neural.observation.capture`
- **What it does**: Main write path for neural memory. Processes events through: duplicate check → significance scoring (threshold: 30) → classification (Claude Haiku) → multi-view embedding generation → entity extraction (regex) → actor resolution → cluster assignment → Pinecone upsert → database storage → relationship detection → downstream event emission.
- **User-visible state changes**: New observation in timeline, entities extracted, cluster updated, actor profile updated.
- **Notification candidates**:
  - **High-significance event captured** (score above threshold, e.g., 70+)
  - **New entity discovered** (first occurrence of a service, component, etc.)
  - Event filtered (below significance threshold) — debug only
  - Classification failure (fell back to regex) — admin only

**8. Profile Update** (`workflow/neural/profile-update.ts`)
- **Event**: `apps-console/neural/profile.update`
- **Function**: `apps-console/neural.profile.update`
- **What it does**: Updates actor profile with activity metrics and upserts org-level identity mapping. Debounced 5 minutes per actor.
- **User-visible state changes**: Actor profile observation count and lastActiveAt updated.
- **Notification candidates**:
  - **New contributor detected** (first profile created for an actor)

**9. Cluster Summary** (`workflow/neural/cluster-summary.ts`)
- **Event**: `apps-console/neural/cluster.check-summary`
- **Function**: `apps-console/neural.cluster.check-summary`
- **What it does**: Generates AI summary when cluster reaches 5 observations or summary is >24h old. Uses GPT-4.1-mini. Debounced 10 minutes per cluster.
- **User-visible state changes**: Cluster gets AI-generated summary with key topics and contributors.
- **Notification candidates**:
  - **New cluster insight available** (summary generated for active cluster)

**10. LLM Entity Extraction** (`workflow/neural/llm-entity-extraction-workflow.ts`)
- **Event**: `apps-console/neural/llm-entity-extraction.requested`
- **Function**: `apps-console/neural.llm-entity-extraction`
- **What it does**: Extracts semantic entities from observation content using GPT-5.1-instant. Only for content >200 chars. Confidence threshold 0.7.
- **User-visible state changes**: Additional entities linked to observation.
- **Notification candidates**: Low priority — entities appear in observation detail views automatically.

**11. Relationship Detection** (`workflow/neural/relationship-detection.ts`)
- **Event**: `apps-console/relationships.extract`
- **What it does**: Links observations via shared commit SHAs, branch names, issue IDs.
- **Notification candidates**:
  - **Cross-source connection found** (e.g., GitHub PR linked to Sentry error)

#### Category D: Infrastructure Workflows (Low User Impact)

**12. Record Activity** (`workflow/infrastructure/record-activity.ts`)
- **Event**: `apps-console/activity.record`
- **Function**: `apps-console/record-activity`
- **What it does**: Batches and inserts user activity records. Max 100 events, 10s timeout, keyed by workspaceId.
- **Notification candidates**: None (this IS the audit system).

---

### 4. What Belongs in User-Facing Notifications vs. Internal Ops

**Important distinction**: The Knock notification feed is for **users** — it should tell them what's happening in their engineering workspace, not surface internal system health. Infrastructure errors (sync failures, embedding API errors, config validation) belong in the jobs table, admin dashboards, or ops monitoring — not in a user's notification inbox.

| Concern | Where It Belongs | NOT in Knock Feed |
|---------|-----------------|-------------------|
| Sync failed / embedding error | Jobs table (existing), ops monitoring | These are system health issues |
| Workspace config invalid | Settings UI validation, onboarding flow | This is a setup error |
| Batch progress / sync started | Jobs table (existing, polls 5s) | This is infrastructure status |
| Config change detected | Jobs table trigger context | This is a sync trigger detail |

**What users actually care about**: What is happening across their engineering tools? Who is doing what? What patterns are emerging? What connections exist between events?

---

### 5. Recommended User-Facing Notification Events

#### Tier 1: Workspace Activity (Core feed content)

These are the primary notifications — real engineering events happening in the user's workspace.

| Event | Source Workflow | Trigger Condition | Example Notification |
|-------|---------------|-------------------|---------------------|
| **High-significance engineering event** | observation-capture | Significance score ≥ 70 | "Production deployment completed on `api-service`" |
| **Cross-source connection found** | relationship-detection | New relationship stored between observations | "PR #478 linked to SENTRY-891 — same commit `a3f2bc1`" |
| **New cluster insight** | cluster-summary | AI summary generated for active cluster | "Activity summary ready: Authentication refactor (12 events, 3 contributors)" |

These are the events where cross-source intelligence is the value — the thing no individual tool's notifications can provide.

#### Tier 2: Team & People (Social/awareness)

| Event | Source Workflow | Trigger Condition | Example Notification |
|-------|---------------|-------------------|---------------------|
| **New contributor detected** | profile-update | isNewProfile = true | "New contributor: @sarah — first activity from GitHub" |
| **Actor cross-source identity resolved** | actor-resolution | Actor linked across 2+ sources | "@jeevan now tracked across GitHub + Vercel + Linear" |

#### Tier 3: Intelligence & Patterns (Insight-driven)

| Event | Source Workflow | Trigger Condition | Example Notification |
|-------|---------------|-------------------|---------------------|
| **New entity discovered** | observation-capture / llm-entity-extraction | First occurrence of entity (service, component, API) | "New entity detected: `payment-service` (mentioned in 3 events)" |
| **Cluster activity spike** | cluster-summary | Cluster observation count grows rapidly | "Spike in activity: Database migration cluster — 8 events in last hour" |

---

### 6. Notification Integration Points (Where to Trigger)

Based on user-facing value, notifications are triggered from neural memory workflows — not from sync/processing infrastructure:

```
observation-capture.ts
├── Line ~1052-1107: emit-events step
│   ├── High-significance event → Knock notification
│   └── New entity first occurrence → Knock notification

relationship-detection.ts
├── After storing new relationship
│   └── Cross-source connection found → Knock notification

profile-update.ts
├── Line ~182-231: upsert-profile step
│   └── isNewProfile = true → Knock notification

cluster-summary.ts
├── Line ~264-279: update-cluster step
│   └── Summary newly generated → Knock notification
```

Note: Sync/processing workflows (sync-orchestrator, process-documents, delete-documents, files-batch-processor) intentionally excluded — their status is already served by the jobs table with 5s polling. Users don't need a notification saying "sync completed" — they see it in the jobs table or notice new search results.

---

### 7. Event Schema for Notifications

The Inngest events that carry user-facing notification data:

| Inngest Event | Payload Fields for Notification Content |
|---------------|----------------------------------------|
| `apps-console/neural/observation.captured` | observationId, type, significance, title, source, actorName, entitiesCount, clusterId |
| `apps-console/neural/profile.update` | actorId, displayName, email, source, isNewProfile |
| `apps-console/neural/cluster.check-summary` | clusterId, summary, keyTopics, keyContributors, observationCount |
| `apps-console/relationships.extract` | observationId, relatedObservationId, relationshipType, sharedReference |

---

## Code References

### Inngest Core
- `api/console/src/inngest/index.ts` — All workflow registrations (lines 102-133)
- `api/console/src/inngest/client/client.ts` — Event schema definitions (lines 23-728)
- `api/console/src/inngest/lib/caller.ts` — M2M tRPC caller for DB operations

### Orchestration
- `api/console/src/inngest/workflow/orchestration/sync-orchestrator.ts` — Unified sync entry
- `api/console/src/inngest/workflow/sources/github-sync-orchestrator.ts` — GitHub sync logic
- `api/console/src/inngest/workflow/providers/github/push-handler.ts` — Push webhook routing

### Processing
- `api/console/src/inngest/workflow/processing/process-documents.ts` — Document indexing pipeline
- `api/console/src/inngest/workflow/processing/files-batch-processor.ts` — File batch processing
- `api/console/src/inngest/workflow/processing/delete-documents.ts` — Document removal

### Neural Memory
- `api/console/src/inngest/workflow/neural/observation-capture.ts` — Main observation pipeline
- `api/console/src/inngest/workflow/neural/profile-update.ts` — Actor profile updates
- `api/console/src/inngest/workflow/neural/cluster-summary.ts` — AI cluster summarization
- `api/console/src/inngest/workflow/neural/llm-entity-extraction-workflow.ts` — LLM entity extraction
- `api/console/src/inngest/workflow/neural/relationship-detection.ts` — Cross-source linking

### Current UI
- `apps/console/src/components/jobs-table.tsx` — Jobs table with 5s polling
- `apps/console/src/components/activity-timeline.tsx` — Activity audit timeline
- `api/console/src/lib/jobs.ts` — Job lifecycle management
- `api/console/src/lib/activity.ts` — 3-tier activity recording

### Current Notification Infrastructure
- `packages/ui/src/components/ui/sonner.tsx` — Toast wrapper
- `vendor/email/src/index.ts` — Resend email client
- `packages/email/src/templates/code-email.tsx` — Auth email template

### Database Schema
- `db/console/src/schema/tables/workspace-workflow-runs.ts` — Job tracking table
- `db/console/src/schema/tables/workspace-user-activities.ts` — Activity audit table

## Architecture Documentation

### Current Event Flow (No Notifications)
```
Webhook → Inngest Event → Workflow Steps → DB/Pinecone Writes → Job Status Updated
                                                                      ↓
                                                              Jobs Table (5s poll)
```

### Proposed Event Flow (With Knock + Slack Bot)

The notification layer hooks into two points: (1) Knock for in-app feed and email, and (2) the unified Slack bot for cross-source enriched messaging (see `thoughts/shared/research/2026-02-06-web-analysis-unified-slack-bot-architecture.md`).

```
Webhook → Inngest Event → Workflow Steps → DB/Pinecone Writes → Job Status Updated
                                                ↓
                                    Knock Workflow Trigger
                                         ↓
                          ┌──────────────┼──────────────────┐
                          │              │                   │
                     In-App Feed    Email (optional)    Slack Bot (optional)
                     (Bell icon)    (digest/critical)   (enriched, threaded
                                                         by cluster via
                                                         observation.captured
                                                         → relationship graph
                                                         → UnifiedMessage)
```

The Slack bot subscribes to `observation.captured` Inngest events and queries the relationship graph to deliver cross-source context (e.g., linking a Sentry error to the GitHub PR that introduced it and the Vercel deployment it shipped on). Messages are threaded by observation cluster, with significance-based gating and a 2-minute batching window for related events. See the unified Slack bot research for the full `NotificationProvider` abstraction that extends to Discord.

### Knock Integration Pattern (from next-forge)
```
Server: @knocklabs/node → notifications.workflows.trigger()
  ↳ Called from Inngest workflow steps at completion/failure points

Client: @knocklabs/react → KnockProvider + KnockFeedProvider
  ↳ Wraps authenticated layout
  ↳ NotificationsTrigger (bell icon) in sidebar
  ↳ NotificationFeedPopover for feed display
```

### Slack Bot Integration Pattern (from unified-slack-bot-architecture research)
```
Inngest event: observation.captured
  ↳ New Inngest function: notification.dispatch
    ↳ Check notification preferences (workspace-level)
    ↳ Apply notification threshold (> observation capture threshold)
    ↳ Query relationship graph for cross-source context
    ↳ Batch with recent cluster events (2min window)
    ↳ Format UnifiedMessage → Slack Block Kit
    ↳ Thread by cluster (reuse existing thread or create new parent)
    ↳ Send via @slack/bolt (Socket Mode → HTTP in production)
```

Note: Knock can also route to Slack as a channel, but the unified Slack bot approach delivers **enriched, cross-source context** that Knock's simple template forwarding cannot provide. The two approaches are complementary — Knock for lightweight in-app + email, Slack bot for rich engineering intelligence.

## Historical Context (from thoughts/)

### Related Research Documents
- `thoughts/shared/research/2026-02-06-startup-tools-webhook-integration.md` — Webhook integration patterns for relationship graph
- `thoughts/shared/research/2026-02-06-startup-tools-webhook-analysis.md` — Webhook analysis for startup tools
- `thoughts/shared/research/2025-12-16-neural-observation-workflow-tracking-analysis.md` — Neural observation pipeline tracking architecture
- `thoughts/shared/research/2025-12-15-webhook-actor-shape-verification.md` — Webhook actor shape verification
- `thoughts/shared/plans/2025-12-17-neural-workflow-metrics-enhancement.md` — Neural workflow metrics enhancement

### Key Historical Context
- The neural memory system processes engineering events (GitHub pushes, PRs, Vercel deployments) into observations with multi-view embeddings, entity extraction, and cluster analysis
- Activity recording uses a 3-tier strategy balancing latency vs. reliability
- The jobs table with 5s polling is the primary way users track background work
- Multiple integration sources planned (Linear, Sentry, Intercom, Zendesk) — each will generate webhook events needing notifications
- No prior documents specifically address a notification service/feed system

## Related Research
- `thoughts/shared/research/2026-02-06-web-analysis-unified-slack-bot-architecture.md` — **Unified Slack bot architecture**: Provider-agnostic messaging layer subscribing to `observation.captured`, threading by cluster, cross-source enrichment via relationship graph, phased implementation (Incoming Webhooks → @slack/bolt → Discord)
- `thoughts/shared/research/2026-02-06-relationship-graph-definitive-links.md` — Relationship graph research
- `thoughts/shared/research/2026-02-05-accelerator-demo-relationship-graph-analysis.md` — Accelerator demo relationship graph
- `thoughts/shared/research/2026-01-22-sentry-ingestion-retrieval-pipeline.md` — Sentry integration pipeline
- `thoughts/shared/research/2026-01-22-linear-integration-ingestion-retrieval-pipeline.md` — Linear integration pipeline

## Open Questions

1. **Knock vs. alternatives**: Should Lightfast use Knock (next-forge pattern), Novu (open-source), or a custom solution with Upstash (already in stack)?
2. **Notification scope**: Should notifications be workspace-scoped, org-scoped, or user-scoped?
3. **Email digest**: Should workspace intelligence (cluster summaries, cross-source links) be batched into periodic email digests?
4. **Real-time vs. polling**: Should the notification feed use WebSocket/SSE (Knock default) or continue the polling pattern?
5. **Notification preferences**: What granularity of user preferences is needed (per-channel, per-event-type)? E.g., "notify me about production deployments but not PR opens"
6. **Multi-workspace**: How should notifications work for users in multiple workspaces?
7. **Integration-specific notifications**: As Linear, Sentry, and other integrations are added, should each have notification templates or should all events flow through the unified observation pipeline?
8. **Knock + Slack bot overlap**: Should Knock handle Slack delivery (simple templates) or should the unified Slack bot own all Slack messaging (enriched, cross-source)? The Slack bot research recommends the latter for engineering intelligence, but Knock could handle simpler admin notifications (billing, auth, etc.).
9. **Significance threshold tuning**: The observation pipeline uses score ≥ 30 for capture. What threshold makes sense for notifications (70+?)? Should this be user-configurable per workspace?
