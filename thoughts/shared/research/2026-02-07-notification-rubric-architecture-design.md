---
date: 2026-02-07
researcher: architect-agent
topic: "Notification Rubric - Architecture Design"
tags: [research, architecture, notifications, rubric, philosophy]
status: complete
based_on:
  - 2026-02-07-notification-rubric-codebase-analysis.md
  - 2026-02-07-notification-rubric-external-research.md
---

# Architecture Design: Notification Rubric

## Research Question

We need to rethink the notification philosophy for Lightfast. Instead of rigid significance thresholds, we need: (1) a notification philosophy, (2) a thinking process rubric for "should this notify?", (3) an event taxonomy with notification map, (4) a stack-aware strategy for dev vs prod, and (5) a rubric storage recommendation.

## Executive Summary

The codebase analysis reveals a linear, threshold-driven notification pipeline where a single significance score (0-100) gates both storage (>=40) and notification (>=70). This produces two critical problems: **blast-radius** (all org members get all notifications) and **signal collapse** (a rich multi-dimensional event is reduced to one number). The external research confirms that industry leaders are moving away from static thresholds toward multi-signal, context-aware notification decisions — with measured improvements of 54% fewer false positives, 35% higher digest engagement, and 43% lower opt-out rates.

Lightfast's unique position — sitting at the intersection of dev tools (GitHub, Linear) and observability (Sentry, Vercel errors) — means its notification value proposition is **cross-tool correlation**, not per-event alerting. The architecture should shift from "notify when score is high" to "notify when the system discovers something the user couldn't have seen from any single tool alone."

This design proposes a rubric-driven notification framework built on three principles: **Insights over Events**, **Quiet by Default**, and **Earned Attention**. It preserves the existing Knock + Inngest infrastructure while introducing a classification layer between observation capture and notification dispatch.

---

## A. Notification Philosophy

### The Lightfast Notification Manifesto

**Lightfast notifications represent insights, not events.**

A user already receives GitHub emails when a PR is merged. They get Vercel Slack messages when deploys fail. They see Linear inbox items when issues are assigned. Lightfast adds no value by duplicating these per-tool notifications. Instead, Lightfast notifications should answer the question: **"What did the system discover that no single tool could tell me?"**

#### Three Principles

**1. Insights over Events**
A notification is justified only when Lightfast's memory pipeline has produced understanding beyond what the raw event conveys. A PR merge is an event. A PR merge that closes a cluster of 4 related Sentry issues, triggers a production deploy, and completes a Linear epic — that's an insight. Notify on insights, not events.

**2. Quiet by Default**
New workspaces should produce near-zero notifications. As the system accumulates observations, detects patterns, and learns the team's development rhythm, notification volume should increase gradually. This is the opposite of most tools, which start noisy and get quieter as users suppress. Lightfast starts quiet and earns the right to notify.

**3. Earned Attention**
Every notification must pass a cost-benefit test: the cost of the user's attention must be justified by the value of what they learn. If a notification is dismissed without action more than 50% of the time, the notification type has failed to earn attention and should be suppressed or batched.

#### Who Are Notifications For?

| Audience | What They Need | Example |
|----------|---------------|---------|
| **Individual developer** | Events relevant to their code, PRs, and assigned issues | "Your PR #42 triggered 3 new Sentry errors in production" |
| **Team lead** | Cross-cutting patterns, velocity insights, risk indicators | "Deploy frequency dropped 60% this week; 3 PRs blocked by failing tests" |
| **Workspace admin** | System health, integration status, anomalies | "GitHub webhook delivery delayed 15+ minutes; 12 events queued" |

#### When Should a User Expect an Email?

- **Always**: Security vulnerabilities, production incidents, breaking changes
- **Usually**: Release published, deployment failures, cross-tool correlations
- **Digest only**: PR activity summaries, velocity insights, pattern reports
- **Never by default**: Routine pushes, successful deploys, dependency updates

---

## B. Thinking Process Rubric

### The Notification Decision Tree

For every event that enters the memory pipeline, the system should walk through this decision tree before dispatching a notification.

```
                        ┌──────────────────────┐
                        │  1. EVENT CATEGORY    │
                        │  What kind of event?  │
                        └──────────┬───────────┘
                                   │
              ┌────────────────────┼────────────────────┐
              ▼                    ▼                    ▼
         ┌─────────┐        ┌──────────┐        ┌───────────┐
         │ CRITICAL │        │ WORKFLOW │        │ AMBIENT   │
         │ (P0/P1)  │        │ (P2/P3)  │        │ (P4)      │
         └────┬────┘        └────┬─────┘        └─────┬─────┘
              │                   │                     │
              ▼                   ▼                     ▼
    2. NOTIFY IMMEDIATELY   3. WORTHINESS TEST    Store only.
    Skip remaining steps.   (see below)           No notification.
              │                   │
              ▼                   │
         INTERRUPT           ┌────┴────┐
         (push + email)      │ Pass?   │
                             │         │
                          Yes│      No │
                             ▼         ▼
                    4. STACK CHECK   Store only.
                             │
                          ┌──┴──┐
                       Dev│  Prod│
                          ▼     ▼
                     Suppress  5. GROUPING
                     or batch  STRATEGY
                               │
                    ┌──────────┼──────────┐
                    ▼          ▼          ▼
               Real-time   Batched    Digest
               (Aware)     (Inform)   (Ambient)
```

### Step 1: Event Category Classification

Classify the event into one of three categories based on the **observation type** and **content signals**:

| Category | Definition | Examples | Action |
|----------|-----------|----------|--------|
| **CRITICAL** | Production impact, security, data loss risk | `deployment.error` with error spike, security vulnerability, incident keywords | Immediate notification, skip worthiness test |
| **WORKFLOW** | State changes in development workflow | PR merged, release published, issue opened, deploy succeeded | Apply worthiness test |
| **AMBIENT** | Routine activity, low information value | Pushes to default branch, dependency updates, formatting changes | Store observation only, never notify individually |

**Implementation**: This maps directly to the existing `INTERNAL_EVENT_TYPES` weights and `SIGNIFICANCE_SIGNALS` in `scoring.ts`. Events with base weight >= 70 + critical/incident keywords = CRITICAL. Events with base weight 40-69 = WORKFLOW. Events with base weight < 40 = AMBIENT.

### Step 2: The Worthiness Test (for WORKFLOW events)

Five questions, each scored 0 or 1. An event must score >= 3 to warrant a notification:

| # | Question | Score = 1 | Score = 0 |
|---|----------|----------|----------|
| W1 | **Is this actionable?** Can the user do something right now? | PR needs review, deploy needs rollback, issue needs triage | PR merged (already done), deploy succeeded (no action needed) |
| W2 | **Is this cross-tool?** Does it connect events across integrations? | PR merge → deploy → error spike (3 sources) | Single-source event with no correlations |
| W3 | **Is this relevant to this user?** Based on ownership, authorship, assignment? | User authored the PR, is assigned the issue, owns the service | Unrelated team member's activity |
| W4 | **Is this novel?** First occurrence, not a duplicate or follow-up? | First notification about this cluster, new pattern detected | 5th push to same PR branch, known recurring issue |
| W5 | **What's the miss cost?** Would the user suffer if they saw this tomorrow instead? | Deploy failure in production, blocking issue | Successful deploy, closed discussion |

**Scoring**:
- 5/5: Notify immediately (Interrupt channel)
- 3-4/5: Notify (Aware channel or next batch)
- 1-2/5: Digest only (Inform channel)
- 0/5: Store only, no notification

### Step 3: Stack Context Check

See Section E for full details. In summary:
- **Development stack** (< 50 observations, < 3 active sources): Suppress most notifications, default to digest-only
- **Growing stack** (50-500 observations, 3+ sources): Enable workflow notifications, batch by default
- **Mature stack** (500+ observations, cross-tool correlations detected): Full notification capability, real-time for critical

### Step 4: Grouping Strategy Selection

| Strategy | When | Implementation |
|----------|------|----------------|
| **Real-time** | Critical events, W-score 5/5 | Immediate Knock trigger (current behavior) |
| **Batched** | Workflow events, W-score 3-4/5 | Knock batch step with 15-minute window |
| **Daily digest** | Ambient summaries, velocity reports | Scheduled Inngest cron → Knock digest workflow |
| **Weekly digest** | Trend reports, pattern summaries | Scheduled Inngest cron → Knock digest workflow |

---

## C. Event Taxonomy & Notification Map

### Active Events (Currently Receiving Webhooks)

| Event Type | Source | Category | Notify? | Channel | Batching | Rationale |
|-----------|--------|----------|---------|---------|----------|-----------|
| `push` | GitHub | AMBIENT | No (individually) | Digest only | Daily | Routine activity; user already sees in GitHub. Only notify if push triggers cross-tool correlation (e.g., causes deploy failure). |
| `pull-request.opened` | GitHub | WORKFLOW | Conditional | In-app + Email batch | 15-min | Only if user is a requested reviewer or PR touches their owned files. |
| `pull-request.closed` | GitHub | AMBIENT | No | Digest only | Daily | Low action value; already visible in GitHub. |
| `pull-request.merged` | GitHub | WORKFLOW | Conditional | In-app + Email batch | 15-min | Only if it triggers cross-tool correlation (deploy, closes issues) OR user authored a related PR. |
| `pull-request.reopened` | GitHub | WORKFLOW | Yes | In-app | Real-time | Signals a problem; someone thought this was done but it isn't. Actionable. |
| `pull-request.ready-for-review` | GitHub | WORKFLOW | Yes (targeted) | In-app + Email | 15-min | Actionable for reviewers. Must target only requested reviewers, not all org members. |
| `issue.opened` | GitHub | WORKFLOW | Conditional | In-app + Email batch | 15-min | Only if assigned to user, mentions user, or matches user's watched labels. |
| `issue.closed` | GitHub | AMBIENT | No | Digest only | Daily | Low action value. |
| `issue.reopened` | GitHub | WORKFLOW | Yes (targeted) | In-app | Real-time | Signals regression; actionable for assignee. |
| `release.published` | GitHub | WORKFLOW | Yes | In-app + Email | Real-time | High information value for entire team. Novel event (happens infrequently). |
| `release.created` | GitHub | WORKFLOW | No | Digest only | Daily | Precursor to published; avoid double-notifying. |
| `discussion.created` | GitHub | AMBIENT | No | Digest only | Weekly | Low urgency, low action value. |
| `discussion.answered` | GitHub | AMBIENT | No | Digest only | Weekly | Low urgency. |
| `deployment.created` | Vercel | AMBIENT | No | — | — | Too frequent, no action needed. |
| `deployment.succeeded` | Vercel | AMBIENT | No | Digest only | Daily | Good news, but not actionable. Include in daily velocity summary. |
| `deployment.ready` | Vercel | AMBIENT | No | — | — | Redundant with succeeded. |
| `deployment.error` | Vercel | CRITICAL | Yes | In-app + Email + Push | Real-time | Production impact. Immediate attention required. Exclude the person who triggered the deploy (they already know). Actually — include them too, with different messaging ("your deploy failed" vs "a deploy failed"). |
| `deployment.canceled` | Vercel | WORKFLOW | Conditional | In-app | 15-min | Only if user initiated the deploy or owns the project. |

### Planned Events (Transformers Exist, No Webhook Route Yet)

| Event Type | Source | Category | Notify? | Channel | Batching | Rationale |
|-----------|--------|----------|---------|---------|----------|-----------|
| `issue.created` | Linear | WORKFLOW | Conditional | In-app + Email batch | 15-min | Only if assigned to user or in user's team. |
| `issue.updated` | Linear | AMBIENT | No | Digest only | Daily | Too frequent, usually minor state changes. |
| `issue.deleted` | Linear | AMBIENT | No | — | — | Rare, low value. |
| `comment.created` | Linear | WORKFLOW | Conditional | In-app | 15-min | Only if on user's assigned/watched issue. |
| `project.created` | Linear | WORKFLOW | Yes | In-app + Email | Real-time | Novel, relevant to team planning. |
| `project-update.created` | Linear | WORKFLOW | Yes | In-app + Email batch | 15-min | Team-level status update; high info value. |
| `cycle.created` | Linear | AMBIENT | No | Digest only | Weekly | Planning event, not urgent. |
| `issue.created` | Sentry | CRITICAL | Yes | In-app + Email + Push | Real-time | New error in production. High action value. |
| `issue.resolved` | Sentry | WORKFLOW | Conditional | In-app | 15-min | Only if user is assigned or authored the fix. |
| `error` | Sentry | CRITICAL | Conditional | In-app + Email | Real-time | Only if correlated with recent deploy or affecting user's code. |
| `event_alert` | Sentry | CRITICAL | Yes | In-app + Email + Push | Real-time | Configured alerts are inherently important. |
| `metric_alert` | Sentry | CRITICAL | Yes | In-app + Email + Push | Real-time | Threshold breaches require attention. |

### Cross-Tool Correlation Events (New — Lightfast's Unique Value)

These don't exist as individual events but emerge from the relationship detection system (`relationship-detection.ts`). They represent Lightfast's highest-value notifications.

| Correlation | Sources | Category | Notify? | Channel | Rationale |
|-------------|---------|----------|---------|---------|-----------|
| PR Merge → Deploy Failure | GitHub + Vercel | CRITICAL | Yes | In-app + Email + Push | Direct causation link. Highest action value. |
| PR Merge → Sentry Error Spike | GitHub + Sentry | CRITICAL | Yes | In-app + Email | Probable regression detected. |
| Deploy → Sentry Issue Created | Vercel + Sentry | CRITICAL | Yes | In-app + Email + Push | Deploy introduced new errors. |
| Cluster Summary Ready | Multiple sources | WORKFLOW | Yes | In-app + Email digest | Narrative summary of related activity. |
| Velocity Anomaly | GitHub (aggregated) | WORKFLOW | Conditional | Email digest | Weekly if pattern detected. |
| Stale PR Detected | GitHub (time-based) | WORKFLOW | Yes (targeted) | In-app + Email | PR open > 7 days with no activity. Author only. |

---

## D. Rubric Storage Location

### Recommendation: Hybrid — Types Package + Documentation

**Primary**: `packages/console-types/src/notifications/rubric.ts`
**Secondary**: `NOTIFICATIONS.md` in repository root

#### Justification

| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| `docs/notifications/rubric.md` | Easy to read, low friction to update | No type safety, not importable, drifts from code | Reject |
| `packages/console-types/src/notifications/rubric.ts` | Type-safe, importable by dispatch logic, enforced at compile time | Harder to read for non-engineers, change requires PR | **Primary choice** |
| `NOTIFICATIONS.md` in root | Visible, follows `CLAUDE.md` pattern, readable by AI assistants | Can drift from implementation, no enforcement | **Secondary choice** |
| Database-driven (admin UI) | Dynamic, per-workspace customization | Over-engineering for current stage, complex to build | Future consideration |

#### Proposed Structure

**`packages/console-types/src/notifications/rubric.ts`**:
```typescript
/** Event categories for notification routing */
export type EventCategory = "critical" | "workflow" | "ambient";

/** Notification channel tiers */
export type ChannelTier = "interrupt" | "aware" | "inform" | "ambient";

/** Grouping strategies */
export type GroupingStrategy = "realtime" | "batched_15m" | "daily_digest" | "weekly_digest";

/** Per-event-type notification configuration */
export interface EventNotificationConfig {
  eventType: string;
  source: string;
  category: EventCategory;
  notify: boolean | "conditional";
  channelTier: ChannelTier;
  grouping: GroupingStrategy;
  targetingRule: "all_members" | "owner_only" | "assignee_only" | "reviewers_only" | "actor_excluded";
  condition?: string; // Human-readable condition (e.g., "only if cross-tool correlation exists")
}

/** The notification rubric — source of truth for dispatch decisions */
export const NOTIFICATION_RUBRIC: Record<string, EventNotificationConfig> = {
  // ... all events from taxonomy table
};

/** Worthiness test scoring */
export interface WorthinessScore {
  actionable: boolean;
  crossTool: boolean;
  relevant: boolean;
  novel: boolean;
  missCost: "high" | "medium" | "low";
  total: number; // 0-5
}
```

**`NOTIFICATIONS.md`** (root):
A human-readable version of the rubric, philosophy, and decision tree — readable by Claude Code, new engineers, and product stakeholders. Updated whenever the types change. This document serves as the "why" to the code's "what."

---

## E. Stack-Aware Notification Strategy

### Stack Maturity Model

A workspace's notification behavior should adapt based on its maturity — measured by observation volume, source diversity, and correlation density.

| Stage | Criteria | Notification Behavior |
|-------|----------|----------------------|
| **Seed** (0-49 observations) | < 50 total observations, typically 1-2 sources | Near-silent. Only CRITICAL events notify. All WORKFLOW events go to weekly digest. Purpose: build the memory graph without overwhelming users. |
| **Growing** (50-499 observations) | 50+ observations, 2+ active sources, some clusters forming | Cautious. CRITICAL = real-time. WORKFLOW = daily digest. Cross-tool correlations start appearing in digests. Purpose: demonstrate pattern detection value. |
| **Mature** (500+ observations) | 500+ observations, 3+ sources, cross-tool correlations detected regularly | Full capability. CRITICAL = real-time. WORKFLOW = 15-min batch or real-time based on W-score. Cross-tool correlations = real-time. Daily + weekly digests. Purpose: proactive intelligence. |

### Maturity Detection

Maturity should be computed lazily (on notification dispatch, not continuously) using data already available in the pipeline:

```
maturity = classify(
  observationCount: COUNT(*) FROM workspace_neural_observations WHERE workspaceId = X,
  sourceCount: COUNT(DISTINCT source) FROM workspace_neural_observations WHERE workspaceId = X,
  correlationCount: COUNT(*) FROM workspace_observation_relationships WHERE workspaceId = X,
  oldestObservation: MIN(capturedAt) FROM workspace_neural_observations WHERE workspaceId = X,
)
```

Cache the result per workspace with a 1-hour TTL. No new tables needed.

### Notification Volume Curve

```
Notifications
per week
│
│                                              ╭───── Mature: 10-20/week
│                                         ╭────╯      (targeted, high-value)
│                                    ╭────╯
│                               ╭────╯
│                          ╭────╯
│                     ╭────╯ Growing: 3-5/week
│                ╭────╯      (mostly digests)
│           ╭────╯
│      ╭────╯
│ ╭────╯ Seed: 0-1/week
│─╯      (critical only)
└──────────────────────────────────────── Time / Observation count
```

**Target volumes**:
- Seed: 0-1 notifications per user per week (critical only)
- Growing: 3-5 notifications per user per week (1 critical + 2-3 digests)
- Mature: 10-20 notifications per user per week (2-3 critical + 5-10 workflow + 1-2 digests)

**Anti-fatigue guardrail**: If any user receives > 30 notifications in a week, automatically escalate to digest-only mode for WORKFLOW events until the next week. Log this as a system event for workspace admins.

### Dev vs Prod Stack Differences

In Lightfast's context, "dev vs prod" isn't about the Lightfast deployment environment — it's about the **user's workspace maturity** and **which branches/environments their sources track**.

| Aspect | Dev-like Workspace | Prod-like Workspace |
|--------|-------------------|-------------------|
| Source branches | Feature branches, staging deploys | main/production branches, production deploys |
| Error sensitivity | Higher threshold (ignore expected test failures) | Lower threshold (any new production error matters) |
| Deploy notifications | Suppress (too frequent in dev) | Enable (each production deploy is significant) |
| Digest frequency | Weekly (lower activity expectation) | Daily (higher activity, faster feedback needed) |
| Cross-tool correlations | Show in digest (educational) | Real-time notification (actionable) |

**Auto-detection heuristic**: If > 80% of observations come from non-default branches or staging environments, treat as dev-like. If > 80% come from default branch or production deployments, treat as prod-like. Mixed = prod-like (safer default).

---

## Integration with Existing Systems

### How This Connects to Current Architecture

**1. Knock Workflows (unchanged infrastructure, new workflow topology)**

Current state: Single `observation-captured` workflow for all notifications.

Proposed state: Multiple Knock workflows mapped to channel tiers:

| Knock Workflow Key | Channel Tier | Channels | Batching |
|-------------------|-------------|----------|----------|
| `critical-alert` | Interrupt | In-app + Email + Push | None (immediate) |
| `workflow-update` | Aware | In-app + Email | Knock batch (15 min) |
| `daily-digest` | Inform | Email | Daily (9 AM user timezone) |
| `weekly-summary` | Ambient | Email | Weekly (Monday 9 AM) |

The existing `observation-captured` workflow can be preserved as an alias for `workflow-update` during migration.

**2. Inngest Integration (new classification step)**

Insert a **notification classification step** between `observation.captured` event emission and `notificationDispatch`:

```
observation.captured event
    ↓
NEW: notification-classifier (Inngest function)
    ├─ Reads observation + classification + relationships
    ├─ Applies rubric (EventCategory → WorthinessTest → StackContext)
    ├─ Determines: notify? → which workflow? → which recipients?
    └─ Emits: notification.routed event (or suppresses)
    ↓
notificationDispatch (existing, modified)
    ├─ Receives pre-classified notification decision
    ├─ No longer applies threshold — trusts classifier
    └─ Triggers appropriate Knock workflow with targeted recipients
```

**3. tRPC (new preferences endpoints)**

Add to `userRouter` (no org required):
- `notifications.getPreferences` — current channel toggles + per-category preferences
- `notifications.updatePreferences` — update channel + category + event-type preferences

Add to `orgRouter` (org membership required):
- `notifications.getWorkspaceConfig` — workspace-level notification rules
- `notifications.updateWorkspaceConfig` — admin-only workspace notification tuning

**4. Existing Data Reuse**

The rubric leverages data already computed by the neural pipeline:
- **Classification** (`classification.ts`): 14 categories → map to EventCategory
- **Cluster assignment** (`cluster-assignment.ts`): correlation detection
- **Relationship detection** (`relationship-detection.ts`): cross-tool links
- **Actor resolution** (`actor-resolution.ts`): ownership/relevance filtering
- **Significance score** (`scoring.ts`): preserved as one input, no longer sole gatekeeper

No new AI calls needed. The rubric is a routing layer over existing intelligence.

---

## Open Questions

1. **Actor exclusion vs. actor-aware messaging**: Should the person who triggered an event (e.g., pushed code, merged PR) be excluded from the notification, or receive a differently-worded version? Industry split: GitHub excludes, Sentry includes with context.

2. **Digest content depth**: Should daily digests include full observation details, or just titles with links? Full details = longer email but self-contained. Titles only = shorter but requires app visit.

3. **Per-workspace vs per-user maturity**: Should the Seed→Growing→Mature curve apply per workspace or per user within a workspace? A new team member joining a mature workspace should probably get full notifications immediately.

4. **Knock workflow count**: Creating 4 Knock workflows (critical-alert, workflow-update, daily-digest, weekly-summary) increases Knock dashboard complexity. Alternative: use a single workflow with Knock's built-in step conditions. Need to evaluate Knock's conditional routing capabilities.

5. **Cross-tool correlation latency**: The relationship detection system runs after observation capture. How long should the notification classifier wait for potential correlations before notifying? Proposal: 5-minute correlation window for WORKFLOW events, 0 for CRITICAL events.

6. **Feedback loop priority**: How important is building the notification engagement tracking (click-through, dismiss rate) for V1? It's critical for the "Earned Attention" principle but adds significant scope. Proposal: instrument click-through from day 1, defer dismiss-rate tracking to V2.

7. **Migration path**: Existing workspaces with the current single-threshold system — should they be migrated to the new rubric immediately, or offered an opt-in period? Abrupt changes to notification behavior can surprise users.
