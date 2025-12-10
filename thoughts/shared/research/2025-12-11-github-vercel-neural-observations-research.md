---
date: 2025-12-11T17:30:00+08:00
researcher: Claude Code
git_commit: cb69a878
branch: feat/memory-layer-foundation
repository: lightfast
topic: "GitHub-Vercel Integration: Neural Observation Design"
tags: [research, integration, github, vercel, neural-memory, observations]
status: complete
last_updated: 2025-12-11
last_updated_by: Claude Code
---

# Research: GitHub-Vercel Integration for Neural Observations

**Date**: 2025-12-11T17:30:00+08:00
**Researcher**: Claude Code
**Git Commit**: cb69a878
**Branch**: feat/memory-layer-foundation

## Research Question

How do GitHub entities (issues, PRs, commits) link to Vercel deployments, and what should the neural observation schema look like to capture this relationship for Lightfast's memory system?

## Summary

GitHub and Vercel integrate through a chain of linked entities: **Issue → PR → Commits → Deployment**. The key correlation point is the **commit SHA** - Vercel deployments include `meta.githubCommitSha` which links back to GitHub commits, and from there we can trace to PRs and linked issues. Neural observations should capture this relationship graph, not just individual events.

## The Entity Relationship Chain

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        GITHUB-VERCEL ENTITY CHAIN                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────────────┐  │
│   │  ISSUE   │────▶│    PR    │────▶│  COMMIT  │────▶│ VERCEL DEPLOYMENT│  │
│   │  #42     │     │   #15    │     │  abc123  │     │    dpl_xyz       │  │
│   └──────────┘     └──────────┘     └──────────┘     └──────────────────┘  │
│                                                                             │
│   Links via:       Contains:        Triggers:         Records in meta:     │
│   "fixes #42"      commits[]        deployment        githubCommitSha      │
│   in PR body       head.sha         webhook           githubCommitRef      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Documentation Links

### GitHub
- [Webhook Events Reference](https://docs.github.com/en/webhooks/webhook-events-and-payloads) - Complete payload schemas
- [Deployments API](https://docs.github.com/en/rest/deployments/deployments) - Create and manage deployments
- [Deployment Statuses API](https://docs.github.com/en/rest/deployments/statuses) - Update deployment states
- [Linking PRs to Issues](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/linking-a-pull-request-to-an-issue)

### Vercel
- [Webhooks Documentation](https://vercel.com/docs/webhooks) - Setup and configuration
- [Webhooks API Reference](https://vercel.com/docs/webhooks/webhooks-api) - Event types and payloads
- [GitHub Integration](https://vercel.com/docs/git/vercel-for-github) - How the integration works

## Entity Correlation Details

### 1. Issue → PR

**Linking Methods**:
- Keywords in PR description: `fixes #123`, `closes #456`, `resolves #789`
- Manual linking via PR sidebar "Development" section
- Reference in commit messages: `#123`

**Supported Keywords**: `close`, `closes`, `closed`, `fix`, `fixes`, `fixed`, `resolve`, `resolves`, `resolved`

**Detection**:
```javascript
// Extract linked issues from PR body
const issueNumbers = prBody.match(
  /(?:close|closes|closed|fix|fixes|fixed|resolve|resolves|resolved)\s+#(\d+)/gi
);
```

### 2. PR → Commits

**Relationship**: A PR contains one or more commits

**Access**:
- PR payload includes `head.sha` (latest commit)
- Full list via API: `GET /repos/{owner}/{repo}/pulls/{pull_number}/commits`

**Key Fields in `pull_request` webhook**:
```json
{
  "head": {
    "sha": "abc123def456",
    "ref": "feature-branch"
  }
}
```

### 3. Commits → Deployment

**GitHub `push` Webhook**:
```json
{
  "ref": "refs/heads/main",
  "head_commit": {
    "id": "abc123def456",
    "message": "fix: authentication bug"
  },
  "commits": [
    { "id": "abc123def456", "message": "fix: authentication bug" }
  ]
}
```

**Vercel `deployment.created` Webhook**:
```json
{
  "type": "deployment.created",
  "payload": {
    "deployment": {
      "id": "dpl_xyz",
      "url": "my-app-abc123.vercel.app",
      "meta": {
        "githubCommitSha": "abc123def456",
        "githubCommitRef": "main",
        "githubCommitMessage": "fix: authentication bug",
        "githubCommitAuthorLogin": "developer",
        "githubOrg": "lightfastai",
        "githubRepo": "lightfast"
      }
    },
    "target": "production"
  }
}
```

### 4. Complete Correlation Flow

```javascript
// Given a Vercel deployment webhook, trace the full chain:

// 1. Extract commit SHA from Vercel deployment
const { githubCommitSha, githubOrg, githubRepo } = deployment.meta;

// 2. Find PRs containing this commit
const prs = await octokit.repos.listPullRequestsAssociatedWithCommit({
  owner: githubOrg,
  repo: githubRepo,
  commit_sha: githubCommitSha
});

// 3. For each PR, extract linked issues
for (const pr of prs.data) {
  const linkedIssues = extractLinkedIssues(pr.body);
  // linkedIssues = [42, 56, ...]
}

// 4. Build relationship graph
const graph = {
  deployment: deployment.id,
  commit: githubCommitSha,
  pullRequests: prs.data.map(pr => pr.number),
  issues: linkedIssues
};
```

## Neural Observation Schema Design

### Observation Types for This Flow

| Source | Event Type | Observation Type | Significance |
|--------|------------|------------------|--------------|
| GitHub | `issues.opened` | `issue.created` | Base: 20 |
| GitHub | `issues.closed` | `issue.resolved` | Base: 35 |
| GitHub | `pull_request.opened` | `pr.opened` | Base: 25 |
| GitHub | `pull_request.closed` (merged) | `pr.merged` | Base: 50 |
| GitHub | `push` | `commit.pushed` | Base: 15 |
| Vercel | `deployment.created` | `deployment.started` | Base: 30 |
| Vercel | `deployment.succeeded` | `deployment.succeeded` | Base: 45 |
| Vercel | `deployment.error` | `deployment.failed` | Base: 70 |

### Proposed Observation Structure

```typescript
interface NeuralObservation {
  // Core identification
  id: string;                    // nanoid
  workspaceId: string;
  storeId: string;

  // Temporal
  occurredAt: Date;              // When event happened
  capturedAt: Date;              // When we captured it

  // Actor (cross-source resolved)
  actorId: string;               // Unified actor ID
  actorName: string;
  actorType: 'human' | 'bot' | 'system';
  actorConfidence: number;       // 0.0-1.0

  // Content (multi-view for embeddings)
  observationType: string;       // e.g., "deployment.succeeded"
  title: string;                 // ≤120 chars, embeddable
  content: string;               // Full normalized content
  summary: string;               // ≤320 chars, distilled gist

  // Classification
  topics: string[];              // e.g., ["deployment", "production", "auth"]
  significanceScore: number;     // 0-100
  confidenceScore: number;       // 0.0-1.0

  // Source tracking
  sourceType: 'github' | 'vercel' | 'sentry' | 'linear';
  sourceEventType: string;       // Original event type
  sourceId: string;              // Unique source identifier

  // CRITICAL: Relationship graph
  sourceReferences: Reference[];
  relatedObservationIds: string[];

  // Embeddings (3 views per E2E design)
  // - Title: ≤120 chars, concise headline for quick matching
  // - Content: Full normalized content for detailed retrieval
  // - Summary: ≤320 chars, distilled gist for context snippets
  embeddingTitleId: string;
  embeddingContentId: string;
  embeddingSummaryId: string;

  // Clustering
  clusterId?: string;
  clusterLabel?: string;
}

interface Reference {
  type: 'commit' | 'branch' | 'pr' | 'issue' | 'deployment' | 'project';
  id: string;
  url?: string;
  label?: string;
}
```

### Example: Deployment Observation with References

```typescript
// When Vercel deployment succeeds, create observation with full chain
const observation: NeuralObservation = {
  id: "obs_abc123",
  workspaceId: "ws_123",
  storeId: "store_456",

  occurredAt: new Date("2025-12-11T10:30:00Z"),
  capturedAt: new Date(),

  actorId: "actor_jdoe",
  actorName: "John Doe",
  actorType: "human",
  actorConfidence: 0.95,

  observationType: "deployment.succeeded",
  title: "[Production Deploy] lightfast main@abc123",
  content: `Production deployment succeeded for lightfast.
    Commit: abc123def456
    Message: fix: authentication bug (#42)
    Branch: main
    URL: https://lightfast-abc123.vercel.app
    Duration: 45s`,
  summary: "Production deployment of auth fix (commit abc123) to lightfast succeeded.",

  topics: ["deployment", "production", "auth", "fix"],
  significanceScore: 75,  // Production deploy + bug fix
  confidenceScore: 0.98,

  sourceType: "vercel",
  sourceEventType: "deployment.succeeded",
  sourceId: "deployment:dpl_xyz789",

  // CRITICAL: Full relationship chain
  sourceReferences: [
    { type: "deployment", id: "dpl_xyz789", url: "https://vercel.com/..." },
    { type: "commit", id: "abc123def456", url: "https://github.com/.../commit/abc123" },
    { type: "branch", id: "main" },
    { type: "pr", id: "15", url: "https://github.com/.../pull/15" },
    { type: "issue", id: "42", url: "https://github.com/.../issues/42", label: "fixes" },
    { type: "project", id: "prj_vercel123" }
  ],

  // Links to related observations (populated after ingestion)
  relatedObservationIds: [
    "obs_pr15_merged",      // PR merge observation
    "obs_issue42_closed",   // Issue close observation
    "obs_commit_abc123"     // Commit push observation
  ],

  embeddingTitleId: "emb_title_abc",
  embeddingContentId: "emb_content_abc",
  embeddingSummaryId: "emb_summary_abc",

  clusterId: "cluster_auth_fixes",
  clusterLabel: "Authentication System Updates"
};
```

## Observation Capture Pipeline

### When GitHub Events Arrive

```typescript
// GitHub PR Merged Event
async function handlePRMerged(event: PullRequestEvent) {
  // 1. Extract PR details
  const { number, title, body, head, user } = event.pull_request;

  // 2. Extract linked issues from body
  const linkedIssues = extractLinkedIssues(body);

  // 3. Build references
  const references: Reference[] = [
    { type: "pr", id: String(number), url: event.pull_request.html_url },
    { type: "commit", id: head.sha, url: `${event.repository.html_url}/commit/${head.sha}` },
    { type: "branch", id: head.ref },
    ...linkedIssues.map(issue => ({
      type: "issue" as const,
      id: String(issue),
      url: `${event.repository.html_url}/issues/${issue}`,
      label: "fixes"
    }))
  ];

  // 4. Send to observation pipeline
  await inngest.send({
    name: "apps-console/neural/observation.capture",
    data: {
      workspaceId,
      storeId,
      sourceEvent: {
        source: "github",
        sourceType: "pull_request.closed",
        sourceId: `pr:${event.repository.id}:${number}`,
        title: `[PR Merged] ${title}`,
        body: body,
        actor: {
          id: `github:${user.login}`,
          name: user.login,
        },
        occurredAt: event.pull_request.merged_at,
        references,
        metadata: {
          prNumber: number,
          commits: head.sha,
          baseBranch: event.pull_request.base.ref,
          additions: event.pull_request.additions,
          deletions: event.pull_request.deletions,
          linkedIssues
        }
      }
    }
  });
}
```

### When Vercel Events Arrive

```typescript
// Vercel Deployment Succeeded Event
async function handleDeploymentSucceeded(event: VercelWebhookPayload) {
  const { deployment, project, team } = event.payload;
  const { meta } = deployment;

  // 1. Build references from Vercel metadata
  const references: Reference[] = [
    { type: "deployment", id: deployment.id, url: `https://${deployment.url}` },
    { type: "project", id: project.id },
  ];

  // 2. Add GitHub references if available
  if (meta.githubCommitSha) {
    references.push(
      { type: "commit", id: meta.githubCommitSha },
      { type: "branch", id: meta.githubCommitRef }
    );

    // 3. Query GitHub API to find related PRs and issues
    const relatedPRs = await findPRsForCommit(
      meta.githubOrg,
      meta.githubRepo,
      meta.githubCommitSha
    );

    for (const pr of relatedPRs) {
      references.push({
        type: "pr",
        id: String(pr.number),
        url: pr.html_url
      });

      // Extract issues from PR
      const linkedIssues = extractLinkedIssues(pr.body);
      for (const issue of linkedIssues) {
        references.push({
          type: "issue",
          id: String(issue),
          label: "fixes"
        });
      }
    }
  }

  // 4. Send to observation pipeline
  await inngest.send({
    name: "apps-console/neural/observation.capture",
    data: {
      workspaceId,
      storeId,
      sourceEvent: {
        source: "vercel",
        sourceType: "deployment.succeeded",
        sourceId: `deployment:${deployment.id}`,
        title: `[${event.payload.target === 'production' ? 'Production' : 'Preview'} Deploy] ${project.name}@${meta.githubCommitRef}`,
        body: buildDeploymentContent(event),
        actor: {
          id: meta.githubCommitAuthorLogin
            ? `github:${meta.githubCommitAuthorLogin}`
            : `vercel:${event.payload.user?.id}`,
          name: meta.githubCommitAuthorName || event.payload.user?.username,
        },
        occurredAt: new Date(event.createdAt).toISOString(),
        references,
        metadata: {
          deploymentId: deployment.id,
          deploymentUrl: `https://${deployment.url}`,
          projectId: project.id,
          projectName: project.name,
          teamId: team?.id,
          isProduction: event.payload.target === 'production',
          gitCommitSha: meta.githubCommitSha,
          gitCommitRef: meta.githubCommitRef,
          gitCommitMessage: meta.githubCommitMessage,
          gitOrg: meta.githubOrg,
          gitRepo: meta.githubRepo
        }
      }
    }
  });
}
```

## Significance Scoring for This Flow

### Event Type Base Scores

| Event | Base Score | Rationale |
|-------|------------|-----------|
| Issue opened | 20 | Context, but low urgency |
| Issue closed | 35 | Resolution is meaningful |
| PR opened | 25 | Work in progress |
| PR merged | 50 | Shipped code |
| Commit pushed | 15 | Atomic, needs grouping |
| Deployment created | 30 | Started, not complete |
| Deployment succeeded | 45 | Code is live |
| Deployment failed | 70 | Requires attention |

### Modifier Factors

```typescript
function calculateSignificance(event: SourceEvent): number {
  let score = getBaseScore(event.sourceType);

  // +20: Production deployment
  if (event.metadata.isProduction) score += 20;

  // +15: Has linked issues (resolves user-facing problems)
  if (event.references.some(r => r.type === 'issue')) score += 15;

  // +10: Has multiple commits (larger change)
  if (event.metadata.commitCount > 3) score += 10;

  // +10: Contains keywords: "fix", "security", "urgent"
  if (containsUrgentKeywords(event.title + event.body)) score += 10;

  // +5: From known high-activity author
  if (isHighActivityActor(event.actor)) score += 5;

  return Math.min(score, 100);
}
```

## Relationship Linking Strategy

### Phase 1: Reference-Based (Current)

Store references inline with each observation. Query by reference ID.

```sql
-- Find all observations related to commit abc123
SELECT * FROM workspaceNeuralObservations
WHERE sourceReferences @> '[{"type": "commit", "id": "abc123"}]';
```

### Phase 2: Graph-Based (Future)

Add explicit relationship table for richer queries.

```sql
CREATE TABLE observationRelationships (
  fromObservationId TEXT REFERENCES workspaceNeuralObservations(id),
  toObservationId TEXT REFERENCES workspaceNeuralObservations(id),
  relationshipType TEXT, -- 'causes', 'fixes', 'deploys', 'contains'
  confidence REAL
);
```

### Phase 3: Temporal Graph (Future)

Enable queries like "What was the state of main branch at deployment time?"

```sql
-- Get all observations that were known at deployment time
SELECT * FROM workspaceNeuralObservations
WHERE workspaceId = ?
  AND occurredAt <= (
    SELECT occurredAt FROM workspaceNeuralObservations
    WHERE sourceId = 'deployment:dpl_xyz'
  )
  AND sourceReferences @> '[{"type": "branch", "id": "main"}]';
```

## Retrieval Patterns

### Query: "What deployed yesterday?"

```typescript
// Vector search with filters
const results = await pinecone.query({
  namespace: workspaceNamespace,
  topK: 20,
  filter: {
    observationType: { $in: ["deployment.succeeded", "deployment.failed"] },
    occurredAt: { $gte: yesterday, $lt: today }
  },
  vector: await embed("deployments")
});
```

### Query: "Show me the context for this deployment"

```typescript
// 1. Get deployment observation
const deployment = await getObservation(deploymentId);

// 2. Extract all referenced entities
const commitSha = deployment.sourceReferences.find(r => r.type === 'commit')?.id;
const prNumbers = deployment.sourceReferences.filter(r => r.type === 'pr').map(r => r.id);
const issueNumbers = deployment.sourceReferences.filter(r => r.type === 'issue').map(r => r.id);

// 3. Fetch related observations
const relatedObs = await db.query.workspaceNeuralObservations.findMany({
  where: or(
    inArray(sourceId, [`commit:${commitSha}`, ...prNumbers.map(n => `pr:${n}`), ...issueNumbers.map(n => `issue:${n}`)]),
    arrayContains(sourceReferences, [{ type: 'commit', id: commitSha }])
  )
});

// 4. Build context narrative
const context = buildNarrativeFromObservations([deployment, ...relatedObs]);
```

### Query: "What issues did John fix this week?"

```typescript
// Combine actor filter with relationship traversal
const observations = await db.query.workspaceNeuralObservations.findMany({
  where: and(
    eq(actorId, 'actor_john'),
    gte(occurredAt, weekStart),
    sql`source_references @> '[{"type": "issue", "label": "fixes"}]'`
  )
});

// Extract unique issue IDs
const fixedIssues = observations
  .flatMap(o => o.sourceReferences)
  .filter(r => r.type === 'issue' && r.label === 'fixes')
  .map(r => r.id);
```

## Implementation Notes

### Current Codebase State

1. **Vercel webhook handler** (`apps/console/src/app/(vercel)/api/vercel/webhooks/route.ts:122-156`) has commented-out observation capture code - this is the template for Phase 02.

2. **GitHub webhook handler** (`apps/console/src/app/(github)/api/github/webhooks/route.ts`) handles `push`, `installation_repositories`, `installation`, `repository` events for document syncing, NOT observations.

3. **Need to add**: GitHub issue and PR webhook handlers for observation capture.

### Required API Calls for Full Chain

When a Vercel deployment arrives, enrich with GitHub data:

```typescript
// Required GitHub API calls for full chain resolution
const enrichDeployment = async (deployment: VercelDeployment) => {
  const { githubCommitSha, githubOrg, githubRepo } = deployment.meta;

  // 1. Get PRs for commit (single API call)
  const prs = await octokit.repos.listPullRequestsAssociatedWithCommit({
    owner: githubOrg,
    repo: githubRepo,
    commit_sha: githubCommitSha
  });

  // 2. For each PR, issues are extracted from body (no API call needed)
  // The PR body contains "fixes #123" keywords

  return { prs: prs.data };
};
```

### Rate Limiting Considerations

- GitHub API: 5000 requests/hour with OAuth token
- Vercel API: 120 requests/minute
- Consider caching PR→commit mappings for high-volume repos

## Related Research

- [2025-12-10-github-pr-integration-research.md](./2025-12-10-github-pr-integration-research.md) - GitHub PR webhooks
- [2025-12-10-github-issues-integration-research.md](./2025-12-10-github-issues-integration-research.md) - GitHub Issues webhooks
- [docs/architecture/plans/neural-memory/phase-02-observation-pipeline.md](../../docs/architecture/plans/neural-memory/phase-02-observation-pipeline.md) - Observation pipeline spec

## Next Steps

1. **Implement GitHub issue/PR webhook handlers** for observation capture
2. **Add GitHub API enrichment** to Vercel deployment handler
3. **Design `observationRelationships` table** for Phase 2 graph queries
4. **Implement reference extraction** utilities for issue linking keywords
5. Use `/create_plan github-vercel-observation-pipeline` to plan implementation
