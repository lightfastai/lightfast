---
date: 2026-02-06T01:50:17Z
researcher: Claude
git_commit: 5eaa1050
branch: feat/definitive-links-strict-relationships
repository: lightfast
topic: "Memory Connector Backfill Architecture"
tags: [research, codebase, backfill, connectors, sources, memory, ingestion, github, linear, vercel, sentry]
status: complete
last_updated: 2026-02-06
last_updated_by: Claude
---

# Research: Memory Connector Backfill Architecture

**Date**: 2026-02-06T01:50:17Z
**Researcher**: Claude
**Git Commit**: 5eaa1050
**Branch**: feat/definitive-links-strict-relationships
**Repository**: lightfast

## Research Question

How can we implement backfill functionality for memory connectors (GitHub, Linear, Vercel, Sentry) when users connect a source? We need time-limited backfill options (7 days, 30 days, 90 days) rather than unlimited historical data.

## Summary

### Current State

The codebase currently has **NO backfill implementation**. When a user connects a source:
- **GitHub**: Only receives data from webhooks going forward (pushes, PRs, issues)
- **Vercel**: Only receives deployment events going forward
- **Linear/Sentry**: Transformers exist but no OAuth or webhook handlers implemented

This creates a **terrible first experience** - users connect a source and see nothing until new activity occurs.

### Existing Infrastructure

| Component | Status | Location |
|-----------|--------|----------|
| Webhook handlers | GitHub/Vercel complete | `apps/console/src/app/(github\|vercel)/api/.../webhooks/route.ts` |
| Event transformers | GitHub/Vercel/Linear/Sentry complete | `packages/console-webhooks/src/transformers/` |
| Document pipeline | Complete | `api/console/src/inngest/workflow/processing/process-documents.ts` |
| Observation pipeline | Complete | `api/console/src/inngest/workflow/neural/observation-capture.ts` |
| Ingestion source enum | Includes "backfill" | `packages/console-validation/src/schemas/ingestion.ts` |
| Webhook storage | Complete | `db/console/src/schema/tables/workspace-webhook-payloads.ts` |

### Key Database Fields

```typescript
// workspace-integrations.ts
lastSyncedAt: timestamp         // Last successful sync
lastSyncStatus: "success" | "failed" | "pending"
connectedAt: timestamp          // When source was connected
sourceConfig: {
  sync: {
    events?: string[],          // ["push", "pull_request", "issue"]
    autoSync: boolean
  }
}
```

---

## Backfill Architecture Design

### Time Limit Options

| Option | Use Case | Est. API Calls (GitHub) |
|--------|----------|------------------------|
| **7 days** | Active projects with recent activity | ~10-20 |
| **30 days** | Standard starting point | ~50-100 |
| **90 days** | Historical context for established projects | ~150-300 |

**No unlimited option** to prevent:
- API rate limit exhaustion
- Excessive processing costs
- Long initial sync times

### Trigger Points

1. **On Source Connection** (Primary)
   - User connects GitHub repo → immediate backfill trigger
   - User selects backfill depth (7/30/90 days) or default (30 days)

2. **Manual Trigger** (Secondary)
   - User requests re-sync from UI
   - Useful after config changes or issues

3. **Never Scheduled**
   - No periodic backfill - that's what webhooks are for

### Proposed Event Flow

```
User connects source
       │
       ▼
apps-console/source.connected
       │
       ▼
apps-console/backfill.requested
       │
       ├──────────────────────────────────────────┐
       ▼                                          ▼
apps-console/backfill.github.started    apps-console/backfill.vercel.started
       │                                          │
       ├─► Fetch merged PRs (since date)          ├─► Fetch deployments (since date)
       ├─► Fetch closed issues (since date)       │
       ├─► Fetch commits (since date)             │
       ├─► Fetch releases (since date)            │
       │                                          │
       ▼                                          ▼
apps-console/neural/observation.capture (reuses existing pipeline)
       │
       ▼
apps-console/backfill.completed
```

### Backfill vs Webhook Events

| Aspect | Webhook Event | Backfill Event |
|--------|---------------|----------------|
| `ingestionSource` | `"webhook"` | `"backfill"` |
| Timing | Real-time | Historical batch |
| Deduplication | By deliveryId | By sourceId + occurredAt |
| Rate limiting | N/A (event-driven) | Required (API calls) |

---

## Source-Specific Backfill Details

### GitHub Backfill

**API Endpoints**:
| Data Type | Endpoint | Rate Limit |
|-----------|----------|------------|
| Pull Requests | `GET /repos/{owner}/{repo}/pulls?state=all&since=` | 5000/hour |
| Issues | `GET /repos/{owner}/{repo}/issues?state=all&since=` | 5000/hour |
| Commits | `GET /repos/{owner}/{repo}/commits?since=` | 5000/hour |
| Releases | `GET /repos/{owner}/{repo}/releases` | 5000/hour |

**Implementation Location**: `packages/console-octokit-github/src/`

**Existing Code**:
- `throttled.ts` - Rate-limited Octokit wrapper
- `github-content.ts` - Content fetching utilities
- `index.ts` - GitHub App client factory

**What's Missing**:
```typescript
// packages/console-octokit-github/src/backfill.ts (proposed)
export async function listMergedPullRequests(octokit, owner, repo, since: Date): Promise<PullRequest[]>
export async function listClosedIssues(octokit, owner, repo, since: Date): Promise<Issue[]>
export async function listCommits(octokit, owner, repo, since: Date, branch: string): Promise<Commit[]>
export async function listReleases(octokit, owner, repo, since: Date): Promise<Release[]>
```

**Transformer Reuse**: All GitHub transformers exist in `packages/console-webhooks/src/transformers/github.ts`:
- `transformPullRequest()` - Lines 114-251
- `transformIssue()` - Lines 256-335
- `transformPush()` - Lines 36-109 (for commits)
- `transformRelease()` - Lines 340-420

### Vercel Backfill

**API Endpoints**:
| Data Type | Endpoint | Rate Limit |
|-----------|----------|------------|
| Deployments | `GET /v6/deployments?projectId=&since=` | 100/min |

**Implementation Location**: `packages/console-vercel/src/`

**What Exists**:
- `types.ts` - Vercel API types
- `env.ts` - Environment validation

**What's Missing**:
```typescript
// packages/console-vercel/src/backfill.ts (proposed)
export async function listDeployments(accessToken, projectId, since: Date): Promise<Deployment[]>
```

**Transformer Reuse**: `packages/console-webhooks/src/transformers/vercel.ts`:
- `transformDeployment()` - Lines 17-150

### Linear Backfill (Future)

**API**: GraphQL at `https://api.linear.app/graphql`

**Entities to Backfill**:
| Entity | Query |
|--------|-------|
| Issues | `issues(filter: { updatedAt: { gte: $since } })` |
| Comments | `comments(filter: { updatedAt: { gte: $since } })` |
| Projects | `projects(filter: { updatedAt: { gte: $since } })` |

**Rate Limit**: 6,000 complexity points per minute

**Transformer Exists**: `packages/console-webhooks/src/transformers/linear.ts` (844 lines)

### Sentry Backfill (Future)

**API Endpoints**:
| Data Type | Endpoint |
|-----------|----------|
| Issues | `GET /api/0/projects/{org}/{project}/issues/` |
| Events | `GET /api/0/issues/{issue_id}/events/` |

**Rate Limit**: 100 requests per minute

**Transformer Exists**: `packages/console-webhooks/src/transformers/sentry.ts` (585 lines)

---

## Implementation Plan

### Phase 1: Core Infrastructure

#### 1.1 Database Schema Updates

```typescript
// db/console/src/schema/tables/workspace-integrations.ts
// Add to sourceConfig:
backfill?: {
  status: "pending" | "running" | "completed" | "failed";
  depth: 7 | 30 | 90;  // days
  startedAt?: string;
  completedAt?: string;
  itemsProcessed?: number;
  itemsFailed?: number;
}
```

#### 1.2 Inngest Workflow

```typescript
// api/console/src/inngest/workflow/backfill/backfill-orchestrator.ts
export const backfillOrchestrator = inngest.createFunction(
  {
    id: "backfill-orchestrator",
    concurrency: [{ limit: 1, key: "event.data.sourceId" }],
    retries: 3,
  },
  { event: "apps-console/backfill.requested" },
  async ({ event, step }) => {
    const { sourceId, sourceType, backfillDays } = event.data;
    const since = new Date(Date.now() - backfillDays * 24 * 60 * 60 * 1000);

    // Route to source-specific workflow
    await step.sendEvent(`apps-console/backfill.${sourceType}.started`, {
      sourceId,
      since: since.toISOString(),
    });

    // Wait for completion
    await step.waitForEvent(`apps-console/backfill.${sourceType}.completed`, {
      match: "data.sourceId",
      timeout: "30m",
    });
  }
);
```

#### 1.3 GitHub Backfill Workflow

```typescript
// api/console/src/inngest/workflow/backfill/github-backfill.ts
export const githubBackfill = inngest.createFunction(
  {
    id: "github-backfill",
    concurrency: [{ limit: 1, key: "event.data.sourceId" }],
  },
  { event: "apps-console/backfill.github.started" },
  async ({ event, step }) => {
    const { sourceId, since } = event.data;

    // Step 1: Fetch historical data
    const prs = await step.run("fetch-prs", () =>
      listMergedPullRequests(octokit, owner, repo, new Date(since))
    );

    const issues = await step.run("fetch-issues", () =>
      listClosedIssues(octokit, owner, repo, new Date(since))
    );

    // Step 2: Transform to SourceEvents
    const events = await step.run("transform-events", () => {
      return [
        ...prs.map(pr => transformPullRequest(pr)),
        ...issues.map(issue => transformIssue(issue)),
      ];
    });

    // Step 3: Send to observation pipeline (in batches)
    for (const batch of chunk(events, 25)) {
      await step.sendEvent(
        batch.map(e => ({
          name: "apps-console/neural/observation.capture",
          data: { ...e, ingestionSource: "backfill" },
        }))
      );
    }

    // Step 4: Signal completion
    await step.sendEvent("apps-console/backfill.github.completed", {
      sourceId,
      itemsProcessed: events.length,
    });
  }
);
```

### Phase 2: UI Integration

#### 2.1 Backfill Depth Selector

Location: `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/sources/connect/_components/`

```tsx
// backfill-selector.tsx
export function BackfillSelector({ value, onChange }) {
  return (
    <RadioGroup value={value} onValueChange={onChange}>
      <RadioGroupItem value={7}>Last 7 days</RadioGroupItem>
      <RadioGroupItem value={30}>Last 30 days (recommended)</RadioGroupItem>
      <RadioGroupItem value={90}>Last 90 days</RadioGroupItem>
    </RadioGroup>
  );
}
```

#### 2.2 Backfill Progress UI

Location: `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/sources/_components/`

```tsx
// backfill-progress.tsx
export function BackfillProgress({ sourceId }) {
  const { data } = trpc.sources.getBackfillStatus.useQuery({ sourceId });

  if (data?.status === "running") {
    return (
      <Progress value={(data.itemsProcessed / data.estimatedTotal) * 100} />
    );
  }
  // ...
}
```

### Phase 3: Source-Specific Implementation

#### Priority Order

1. **GitHub** (most complex, most used)
2. **Vercel** (simpler, pairs with GitHub)
3. **Linear** (requires OAuth first)
4. **Sentry** (requires OAuth first)

---

## Deduplication Strategy

### Problem

Backfill may overlap with existing webhook events if:
- User connects source after some webhook events received
- User manually triggers re-backfill

### Solution: Upsert Pattern

The observation pipeline already supports deduplication via `sourceId`:

```typescript
// observation-capture.ts (existing)
const existing = await db.select()
  .from(workspaceNeuralObservations)
  .where(and(
    eq(workspaceId, observation.workspaceId),
    eq(sourceId, observation.sourceId),
  ))
  .limit(1);

if (existing.length > 0) {
  // Skip - already processed
  return { status: "skipped", reason: "duplicate" };
}
```

### SourceId Format

| Source | SourceId Format | Example |
|--------|-----------------|---------|
| GitHub PR | `github:pr:${prNumber}` | `github:pr:123` |
| GitHub Issue | `github:issue:${issueNumber}` | `github:issue:456` |
| GitHub Push | `github:push:${commitSha}` | `github:push:abc123` |
| Vercel Deploy | `vercel:deployment:${deploymentId}` | `vercel:deployment:dpl_xyz` |
| Linear Issue | `linear:issue:${issueId}` | `linear:issue:LIN-123` |
| Sentry Issue | `sentry:issue:${issueId}` | `sentry:issue:12345` |

---

## Rate Limiting & Batching

### GitHub API Strategy

```typescript
// Batching constants
const BATCH_SIZE = 100;        // GitHub max per page
const DELAY_BETWEEN_BATCHES = 1000; // 1 second
const MAX_ITEMS_PER_TYPE = 1000;    // Hard limit

// Throttled fetch pattern
async function* fetchPaginatedWithDelay<T>(
  fetcher: (page: number) => Promise<T[]>,
  maxItems: number
): AsyncGenerator<T[]> {
  let page = 1;
  let totalFetched = 0;

  while (totalFetched < maxItems) {
    const batch = await fetcher(page);
    if (batch.length === 0) break;

    yield batch;
    totalFetched += batch.length;
    page++;

    await sleep(DELAY_BETWEEN_BATCHES);
  }
}
```

### Inngest Step Batching

```typescript
// Process in steps to avoid timeout
const batches = chunk(allEvents, 25);

for (let i = 0; i < batches.length; i++) {
  await step.run(`process-batch-${i}`, async () => {
    await step.sendEvent(
      batches[i].map(e => ({
        name: "apps-console/neural/observation.capture",
        data: e,
      }))
    );
  });
}
```

---

## Code References

### Existing Transformer Patterns
- `packages/console-webhooks/src/transformers/github.ts:36-458` - GitHub transformers
- `packages/console-webhooks/src/transformers/vercel.ts:17-165` - Vercel transformer
- `packages/console-webhooks/src/transformers/linear.ts:1-844` - Linear transformer
- `packages/console-webhooks/src/transformers/sentry.ts:1-585` - Sentry transformer

### Ingestion Pipeline Entry Points
- `api/console/src/inngest/workflow/neural/observation-capture.ts:335` - Observation capture
- `api/console/src/inngest/workflow/processing/process-documents.ts:113` - Document processing

### OAuth Patterns
- `apps/console/src/app/(github)/api/github/authorize-user/route.ts` - GitHub OAuth
- `apps/console/src/app/(vercel)/api/vercel/authorize/route.ts` - Vercel OAuth

### Database Schema
- `db/console/src/schema/tables/workspace-integrations.ts:25-155` - Integration config
- `db/console/src/schema/tables/workspace-neural-observations.ts:48-200` - Observation storage

### Validation Schemas
- `packages/console-validation/src/schemas/ingestion.ts` - Includes "backfill" source type

---

## Historical Context (from thoughts/)

- `thoughts/shared/research/2025-12-14-neural-memory-production-priority-analysis.md` - Identified backfill as P0 production blocker
- `thoughts/shared/research/2025-12-13-neural-memory-cross-source-architectural-gaps.md:69-96` - Gap analysis for backfill
- `thoughts/shared/research/2026-01-22-linear-integration-ingestion-retrieval-pipeline.md` - Linear integration patterns
- `thoughts/shared/research/2026-01-22-sentry-ingestion-retrieval-pipeline.md` - Sentry integration patterns

---

## Open Questions for Discussion

1. **Default Backfill Depth**: Should 30 days be the default, or should we require explicit selection?

2. **Progress Reporting**: Should backfill progress be real-time (websocket) or polled?

3. **Retry Strategy**: If backfill fails partway through, should we resume from last checkpoint or restart?

4. **Document vs Observation Split**: Should backfill populate documents (for file content) AND observations (for events), or just observations?

5. **Cost Tracking**: Should we track API calls consumed per backfill for usage billing?

6. **Linear/Sentry Priority**: These require OAuth implementation first. Should backfill be designed now with those in mind, or focus on GitHub/Vercel only?
