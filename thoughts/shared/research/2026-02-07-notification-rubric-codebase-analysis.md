---
date: 2026-02-07
researcher: codebase-agent
topic: "Notification Rubric - Codebase Analysis"
tags: [research, codebase, notifications, events, memory-pipeline]
status: complete
---

# Codebase Deep Dive: Notification Rubric

## Research Question
The current notification significance threshold approach is too explicit and doesn't reflect how teams actually want to be notified about their development pipeline. We need to understand: (1) what events currently exist and how they're classified, (2) how the memory pipeline produces observations, (3) what currently triggers notifications, and (4) how significance/priority is determined.

## Summary

The Lightfast notification system follows a linear pipeline: **Webhook → SourceEvent → Observation Capture → observation.captured Event → Notification Dispatch → Knock**. The system currently supports **4 webhook sources** (GitHub, Vercel, Linear, Sentry) with **23+ event types** defined in the centralized `INTERNAL_EVENT_TYPES` registry plus many more from Linear/Sentry transformers. Each webhook is transformed into a standardized `SourceEvent`, then processed through the neural observation capture workflow which scores significance (0-100), filters below threshold (40), classifies via AI, extracts entities, generates embeddings, and stores the observation.

Notifications are triggered by a **second, independent threshold** (70/100) in the dispatch workflow. This creates a two-gate system: events scoring 40-69 are stored as observations but never trigger notifications, while events ≥70 trigger notifications to ALL org members via Knock. There is no per-user filtering, no event-type-based routing, and no batching beyond what Knock provides natively. The notification preferences UI only supports global channel toggles (in-app feed, email) with per-workflow preferences marked as "coming soon."

Linear and Sentry webhook handlers exist as transformers in `@repo/console-webhooks` but do **not have route handlers** in the console app — meaning they are prepared for integration but not yet receiving webhooks.

## Detailed Findings

### A. Event Taxonomy

#### A.1 Centralized Event Type Registry

**File**: `packages/console-types/src/integrations/event-types.ts:25-87`

The `INTERNAL_EVENT_TYPES` const object is the **source of truth** for event type validation and scoring. Each entry has `source`, `label`, and `weight` (base significance 0-100).

**GitHub Events (12 types)**:
| Event Type | Label | Base Weight |
|---|---|---|
| `push` | Push | 30 |
| `pull-request.opened` | PR Opened | 50 |
| `pull-request.closed` | PR Closed | 45 |
| `pull-request.merged` | PR Merged | 60 |
| `pull-request.reopened` | PR Reopened | 40 |
| `pull-request.ready-for-review` | Ready for Review | 45 |
| `issue.opened` | Issue Opened | 45 |
| `issue.closed` | Issue Closed | 40 |
| `issue.reopened` | Issue Reopened | 40 |
| `release.published` | Release Published | 75 |
| `release.created` | Release Created | 70 |
| `discussion.created` | Discussion Created | 35 |
| `discussion.answered` | Discussion Answered | 40 |

**Vercel Events (5 types)**:
| Event Type | Label | Base Weight |
|---|---|---|
| `deployment.created` | Deployment Started | 30 |
| `deployment.succeeded` | Deployment Succeeded | 40 |
| `deployment.ready` | Deployment Ready | 40 |
| `deployment.error` | Deployment Failed | 70 |
| `deployment.canceled` | Deployment Canceled | 65 |

**Default weight for unknown event types**: 35 (`event-types.ts:113`)

#### A.2 Linear Event Types (Transformers only — no webhook route)

**File**: `packages/console-webhooks/src/transformers/linear.ts`

Transformers exist for 5 Linear webhook types, each with create/update/remove actions:
- **Issue**: `issue.created`, `issue.updated`, `issue.deleted` (line 350-513)
- **Comment**: `comment.created`, `comment.updated`, `comment.deleted` (line 518-580)
- **Project**: `project.created`, `project.updated`, `project.deleted` (line 585-678)
- **Cycle**: `cycle.created`, `cycle.updated`, `cycle.deleted` (line 683-755)
- **ProjectUpdate**: `project-update.created`, `project-update.updated`, `project-update.deleted` (line 760-827)

**Note**: None of these have base weights in `INTERNAL_EVENT_TYPES` — they would all get the default 35 weight.

#### A.3 Sentry Event Types (Transformers only — no webhook route)

**File**: `packages/console-webhooks/src/transformers/sentry.ts`

Transformers exist for 7 Sentry event types:
- **Issue events**: `issue.created`, `issue.resolved`, `issue.assigned`, `issue.ignored` (line 252-363)
- **Error**: `error` (line 368-445)
- **Event Alert**: `event_alert` (line 450-502)
- **Metric Alert**: `metric_alert` (line 507-564)

**Note**: None of these have base weights in `INTERNAL_EVENT_TYPES` either.

#### A.4 Administrative/Non-Observation Events

The GitHub webhook handler also processes non-observation events that don't enter the neural pipeline:
- `installation_repositories` (repo removed from installation) — `route.ts:42-63`
- `installation` (app deleted) — `route.ts:555-567`
- `repository` (deleted or renamed) — `route.ts:570-593`

#### A.5 Inngest Internal Events

**File**: `api/console/src/inngest/client/client.ts:560-700+`

Key Inngest events in the system:
| Event Name | Emitted By | Consumed By |
|---|---|---|
| `apps-console/github.push` | GitHub webhook route | `githubPushHandler` |
| `apps-console/neural/observation.capture` | Webhook route handlers | `observationCapture` |
| `apps-console/neural/observation.captured` | `observationCapture` | `notificationDispatch`, `entityExtraction` |
| `apps-console/neural/profile.update` | `observationCapture` | `profileUpdate` |
| `apps-console/neural/cluster.check-summary` | `observationCapture` | `clusterSummary` |
| `apps-console/neural/llm-entity-extraction.requested` | `observationCapture` | `llmEntityExtraction` |
| `apps-console/sync.requested` | `githubPushHandler` | `syncOrchestrator` |

### B. Memory Pipeline Analysis

#### B.1 Event Ingestion Flow

```
Webhook HTTP Request
  ↓
apps/console/src/app/(github|vercel)/api/.../webhooks/route.ts
  ↓ (verify signature, validate timestamp, resolve workspace)
  ↓ (store raw payload in workspace_webhook_payloads)
  ↓ (transform to SourceEvent via @repo/console-webhooks)
  ↓
inngest.send("apps-console/neural/observation.capture")
  ↓
api/console/src/inngest/workflow/neural/observation-capture.ts
  ↓
  ├─ Step 1: Check duplicate (by workspaceId + sourceId) [line 441-493]
  ├─ Step 2: Check event allowed by source config [line 496-579]
  ├─ Step 3: Score significance (GATE: reject < 40) [line 582-632]
  ├─ Step 4: Fetch workspace context [fetches workspace + integration]
  ├─ Step 5: PARALLEL AI processing
  │   ├─ Classification (Claude Haiku 3.5) [line 653-708]
  │   ├─ Multi-view Embeddings (3 vectors) [line 713-754]
  │   ├─ Entity Extraction (regex patterns) [line 757-777]
  │   └─ Actor Resolution [line 780-782]
  ├─ Step 6: Cluster assignment (threshold: 60 affinity) [line 815-834]
  ├─ Step 7: Vector upsert to Pinecone [line 852-918]
  ├─ Step 8: DB transaction (observation + entities) [line 922-999]
  ├─ Step 9: Relationship detection [line 1003-1017]
  └─ Step 10: Fire events [line 1052-1107]
       ├─ observation.captured → notificationDispatch
       ├─ profile.update → profileUpdate
       ├─ cluster.check-summary → clusterSummary
       └─ llm-entity-extraction.requested → llmEntityExtraction (if body > 200 chars)
```

#### B.2 SourceEvent Schema

**File**: `packages/console-types/src/neural/source-event.ts:7-37`

```typescript
interface SourceEvent {
  source: "github" | "vercel" | "linear" | "sentry";
  sourceType: string;      // Internal event type (e.g., "push", "pull-request.merged")
  sourceId: string;        // Unique ID (e.g., "pr:lightfastai/lightfast#123")
  title: string;           // <=120 chars
  body: string;            // Full content for embedding
  actor?: SourceActor;     // Who performed the action
  occurredAt: string;      // ISO timestamp
  references: SourceReference[]; // Commits, branches, issues, PRs, deployments
  metadata: Record<string, unknown>; // Source-specific structured data
}
```

#### B.3 Observation Database Schema

**File**: `db/console/src/schema/tables/workspace-neural-observations.ts:48-247`

Key columns:
- `id` (BIGINT, internal PK) + `externalId` (varchar(21), nanoid, for API)
- `workspaceId` → FK to `orgWorkspaces`
- `clusterId` (BIGINT) → assignment to observation cluster
- `occurredAt` / `capturedAt` — temporal tracking
- `actor` (JSONB) + `actorId` (BIGINT) → resolved actor profile
- `observationType` (varchar) — e.g., "push", "pull_request_merged"
- `title` (text) + `content` (text) — for embedding
- `topics` (JSONB string[]) — AI-extracted topics
- **`significanceScore` (real)** — 0-100 score stored on observation
- `source` + `sourceType` + `sourceId` — provenance tracking
- `sourceReferences` (JSONB) + `metadata` (JSONB)
- 4 embedding vector IDs (legacy + title/content/summary views)

Indexes: externalId (unique), workspace+occurredAt, cluster, workspace+source+sourceType, workspace+sourceId (dedup), workspace+observationType

#### B.4 Classification System

**File**: `api/console/src/inngest/workflow/neural/classification.ts`

**14 categories** used by Claude Haiku 3.5:
`bug_fix`, `feature`, `refactor`, `documentation`, `testing`, `infrastructure`, `security`, `performance`, `incident`, `decision`, `discussion`, `release`, `deployment`, `other`

Output: `{ primaryCategory, secondaryCategories[], topics[], confidence, reasoning }`

Fallback to regex-based classification on AI failure.

#### B.5 Cluster Assignment

**File**: `api/console/src/inngest/workflow/neural/cluster-assignment.ts`

Affinity scoring (0-100):
- **Embedding Similarity** (0-40 pts): Cosine similarity via Pinecone
- **Entity Overlap** (0-30 pts): Jaccard similarity
- **Actor Overlap** (0-20 pts): Binary match
- **Temporal Proximity** (0-10 pts): Linear decay from <1 hour

**Threshold**: 60/100 to join existing cluster; below creates new cluster.

#### B.6 Actor Detection & Cross-Source Reconciliation

**File**: `api/console/src/inngest/workflow/neural/actor-resolution.ts`

- **GitHub**: Direct mapping `github:{numericId}` (line 126-132)
- **Vercel**: Attempts commit SHA linkage → falls back to `github:{username}` (line 100-131)

**Cross-source reconciliation** (`observation-capture.ts:244-329`): When a GitHub push arrives with a commit SHA that matches a Vercel deployment observation, the Vercel observation's actor ID is upgraded from username to numeric GitHub ID.

#### B.7 Relationship Detection

**File**: `api/console/src/inngest/workflow/neural/relationship-detection.ts`

**8 relationship types**: `fixes`, `resolves`, `triggers`, `deploys`, `references`, `same_commit`, `same_branch`, `tracked_in`

**Detection methods**:
1. Commit SHA matching (GitHub push ↔ Vercel deployment)
2. Branch name matching (Linear issue ↔ GitHub PR)
3. Explicit "Fixes #123" references
4. PR number matching (Linear → GitHub)
5. Sentry issue → commit resolution

### C. Current Notification Triggers

#### C.1 Notification Dispatch Workflow

**File**: `api/console/src/inngest/workflow/notifications/dispatch.ts`

**Trigger**: `apps-console/neural/observation.captured` event (line 39)

**Guards** (sequential):
1. Knock client configured? (line 52-55)
2. **Significance score ≥ 70?** (line 58-65) — `NOTIFICATION_SIGNIFICANCE_THRESHOLD = 70`
3. `clerkOrgId` present? (line 68-70)

**Processing**:
1. Fetch ALL org members from Clerk (paginated, line 73-127)
2. Lookup workspace name (line 148-154)
3. Trigger Knock workflow `observation-captured` with all members as recipients (line 157-182)

**Data sent to Knock** (line 163-171):
```typescript
{
  observationId,
  observationType,
  significanceScore,
  topics: [],
  clusterId,
  workspaceId,
  workspaceName,
}
```

**Critical observations**:
- **No per-user filtering**: ALL org members receive every notification
- **No event type routing**: All high-significance events go to the same Knock workflow
- **No batching logic in dispatch**: Relies entirely on Knock's native batching
- **No actor exclusion**: The person who performed the action also gets notified
- **Tenant scoping**: Uses `workspaceId` (not `clerkOrgId`) as tenant for per-workspace preferences

#### C.2 Two-Gate Threshold System

```
Event Score Range  │ Observation Stored? │ Notification Sent?
──────────────────┼────────────────────┼──────────────────
0-39 (noise)       │ NO                  │ NO
40-69 (medium)     │ YES                 │ NO
70-100 (high)      │ YES                 │ YES
```

**Which events typically reach 70+?**
Using base weights + typical content signals:
- `release.published` (75 base) → Almost always notifies
- `release.created` (70 base) → Notifies if any positive signal
- `deployment.error` (70 base) → Notifies if any positive signal
- `deployment.canceled` (65 base) → Needs +5 content signal
- `pull-request.merged` (60 base) → Needs +10 content signal (e.g., "feature" keyword)
- `pull-request.opened` (50 base) → Needs +20 (critical keyword or significant content)
- `push` (30 base) → Very unlikely to notify (needs "breaking" or "critical" keyword + references)

**Events that NEVER trigger notifications** (even if stored):
- Routine pushes, discussion created/answered, most deployment created/succeeded events
- ANY Linear or Sentry event (since they all get default weight 35)

#### C.3 Knock Integration

**Server-side client**: `vendor/knock/src/index.ts` — Singleton `Knock` instance from `@knocklabs/node`

**Client-side provider**: `vendor/knock/src/components/provider.tsx`
- `KnockProvider` + `KnockFeedProvider` wrapping the app
- Feed channel ID: `lightfast-console-notifications` (line 12)

**User token**: Signed via `signUserToken` for enhanced security (1-hour expiry, 5-min client refetch)

**Knock workflow**: `observation-captured` — configured in Knock dashboard (not in code)

#### C.4 Notification Preferences

**Client hook**: `vendor/knock/src/components/preferences.tsx`
- `useNotificationPreferences()` hook using Knock client SDK
- Fetches/sets preferences via `knockClient.preferences.get()/set()`
- Supports `channel_types`, `workflows`, `categories` preference sets

**UI**: `apps/console/src/app/.../settings/notifications/_components/notification-preferences.tsx`
- **Two channel toggles**: in_app_feed, email
- **Per-workflow preferences**: "Coming soon" placeholder (line 124-141)
- No per-event-type controls
- No significance threshold customization
- No per-source filtering

#### C.5 What DOESN'T Trigger Notifications Today

1. **All Linear events** — no webhook route handler exists (transformers only)
2. **All Sentry events** — no webhook route handler exists (transformers only)
3. **Low-significance GitHub events** — pushes to default branch with routine commits
4. **Medium-significance events** (40-69) — stored but not notified
5. **GitHub admin events** — installation changes, repo deletion/rename
6. **Non-default-branch pushes** — filtered at webhook handler level
7. **Events not allowed by source config** — per-source event filtering

### D. Significance/Priority Systems

#### D.1 Scoring Function

**File**: `api/console/src/inngest/workflow/neural/scoring.ts:78-118`

**Algorithm**:
```
score = getEventWeight(eventType)        // Step 1: Base weight from INTERNAL_EVENT_TYPES
      + Σ(content signal matches)         // Step 2: Keyword matching on title+body
      + min(refCount * 3, 15)             // Step 3: Reference density bonus
      + (bodyLength > 500 ? 5 : bodyLength > 200 ? 2 : 0)  // Step 4: Content substance
score = clamp(score, 0, 100)              // Step 5: Normalize
```

**Content Signals** (line 52-66):

| Signal | Pattern | Weight | Factor |
|---|---|---|---|
| Critical | breaking, critical, urgent, security, vulnerability, CVE-\d+ | +20 | critical_keyword |
| Incident | hotfix, emergency, incident, outage, downtime | +15 | incident_keyword |
| Important | major, important, significant, release, deploy | +10 | important_keyword |
| Feature | feature, feat, new | +8 | feature_keyword |
| Fix | fix, bug, patch, resolve | +5 | fix_keyword |
| Routine | chore, deps, dependencies, bump, update, upgrade | -10 | routine_keyword |
| Trivial | typo, whitespace, formatting, lint | -15 | trivial_keyword |
| WIP | wip, draft, temp, test | -10 | wip_keyword |

#### D.2 Dual Threshold System

1. **Observation Capture Threshold**: 40/100 (`scoring.ts:16`) — Events below this are discarded entirely
2. **Notification Dispatch Threshold**: 70/100 (`dispatch.ts:23`) — Observations below this don't trigger notifications

**TODO comments indicate future plans**:
- `scoring.ts:14`: "Make configurable per workspace"
- `scoring.ts:24-40`: Detailed plan for LLM-based scoring using Claude Haiku for semantic understanding

#### D.3 What's Missing

1. **No per-event-type notification rules** — Can't say "notify me on all deployment failures but not pushes"
2. **No actor-based filtering** — Can't mute your own actions or follow specific team members
3. **No workspace-level threshold customization** — Hardcoded at 70
4. **No urgency/priority classification** — Only a single significance score, no separate priority field
5. **No event correlation notifications** — Can't say "notify me when a Sentry issue is linked to a PR merge"
6. **No digest/summary notifications** — Individual observation notifications only
7. **No quiet hours / DND** — Always-on notification delivery
8. **No notification routing by role** — All org members get everything

## Code References

### Schema Files
- `db/console/src/schema/tables/workspace-neural-observations.ts:48-247` — Observation table with significanceScore field
- `db/console/src/schema/tables/workspace-observation-relationships.ts:55-164` — Relationship graph edges
- `db/console/src/schema/tables/workspace-webhook-payloads.ts:23-108` — Raw webhook storage
- `db/console/src/schema/tables/workspace-actor-profiles.ts:61-135` — Actor profiles
- `db/console/src/schema/tables/workspace-neural-entities.ts` — Extracted entities

### Webhook Handlers
- `apps/console/src/app/(github)/api/github/webhooks/route.ts:462-608` — GitHub webhook endpoint (push, PR, issue, release, discussion)
- `apps/console/src/app/(vercel)/api/vercel/webhooks/route.ts:139-214` — Vercel webhook endpoint (deployment events only)

### Transformers
- `packages/console-webhooks/src/transformers/github.ts` — GitHub → SourceEvent
- `packages/console-webhooks/src/transformers/linear.ts` — Linear → SourceEvent (5 types)
- `packages/console-webhooks/src/transformers/sentry.ts` — Sentry → SourceEvent (7 types)

### Neural Pipeline
- `api/console/src/inngest/workflow/neural/observation-capture.ts` — Main observation capture workflow
- `api/console/src/inngest/workflow/neural/scoring.ts:78-118` — Significance scoring function
- `api/console/src/inngest/workflow/neural/classification.ts` — AI classification (14 categories)
- `api/console/src/inngest/workflow/neural/cluster-assignment.ts` — Cluster affinity scoring
- `api/console/src/inngest/workflow/neural/relationship-detection.ts` — Cross-observation linking
- `api/console/src/inngest/workflow/neural/actor-resolution.ts` — Actor ID resolution
- `api/console/src/inngest/workflow/neural/llm-entity-extraction-workflow.ts` — LLM entity extraction
- `api/console/src/inngest/workflow/neural/profile-update.ts` — Actor profile maintenance

### Notification System
- `api/console/src/inngest/workflow/notifications/dispatch.ts` — Notification dispatch (threshold=70)
- `vendor/knock/src/index.ts` — Knock client singleton
- `vendor/knock/src/components/provider.tsx` — Knock React provider
- `vendor/knock/src/components/preferences.tsx` — Notification preferences hook
- `apps/console/src/components/notifications-provider.tsx` — Console notifications wrapper
- `apps/console/src/app/.../notifications/_components/notification-preferences.tsx` — Preferences UI

### Event Type Registry
- `packages/console-types/src/integrations/event-types.ts:25-87` — INTERNAL_EVENT_TYPES (source of truth)
- `api/console/src/inngest/client/client.ts:560-700+` — Inngest event type definitions

## Integration Points

### Event System → Memory Pipeline
- Webhook route handlers call `inngest.send("apps-console/neural/observation.capture")` with a transformed `SourceEvent`
- The neural pipeline consumes this event, processes it through significance scoring, AI classification, embedding, entity extraction, and stores the observation

### Memory Pipeline → Notification System
- After successful observation capture, the pipeline emits `observation.captured` event with significance score, observation type, topics, and cluster ID
- The notification dispatch workflow consumes this event and applies its own threshold (70) before triggering Knock

### Notification System → User
- Knock manages the actual delivery channels (in-app feed, email)
- Email is batched by Knock (every 5 minutes per UI description)
- Preferences are managed client-side via Knock SDK
- User token is generated server-side for enhanced security

### Gaps in Integration
1. **Linear/Sentry webhook routes missing** — Transformers exist but no HTTP endpoints to receive webhooks
2. **No feedback loop** — Notification engagement doesn't inform future scoring
3. **No cross-source correlation notifications** — Relationship detection exists but doesn't influence notification routing
4. **Classification doesn't influence notifications** — The 14-category classification output is stored but not used in dispatch decisions

## Gaps Identified

### Architecture Gaps
1. **Single-score significance model** — One number (0-100) can't capture the multidimensional nature of "notification-worthiness" (urgency vs. importance vs. relevance vs. user preference)
2. **Hardcoded thresholds** — Both 40 and 70 are const values with TODO comments about making them configurable
3. **Blast-radius problem** — Every org member gets every notification above threshold, regardless of role or relevance
4. **Missing event sources** — Linear and Sentry have complete transformers but no webhook route handlers
5. **Classification is wasted** — AI classifies into 14 categories but this doesn't affect notification routing

### Feature Gaps
1. **Per-workflow Knock preferences** — UI shows "coming soon" placeholder
2. **Per-event-type notification rules** — No way to say "notify me on deployment failures only"
3. **Actor-aware notifications** — No self-muting, no team member following
4. **Digest/summary mode** — No periodic summaries, only individual event notifications
5. **Quiet hours** — No DND or schedule-aware delivery
6. **Role-based routing** — No different notification rules for admins vs. developers
7. **Workspace-level tuning** — No per-workspace threshold or event filtering
8. **Notification engagement tracking** — No way to learn from what users read/dismiss
