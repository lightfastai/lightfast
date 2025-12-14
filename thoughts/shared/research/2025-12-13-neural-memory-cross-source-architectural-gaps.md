---
date: 2025-12-13T02:15:00Z
researcher: Claude
git_commit: 014045bb15a6b1a4274cf15ac024bbc297615a18
branch: feat/memory-layer-foundation
repository: lightfast
topic: "Neural Memory Cross-Source Linking Architectural Gaps"
tags: [research, neural-memory, cross-source, architecture, gaps]
status: complete
last_updated: 2025-12-13
last_updated_by: Claude
---

# Neural Memory Cross-Source Linking Architectural Gaps

**Date**: 2025-12-13
**Branch**: feat/memory-layer-foundation
**Status**: Research complete, implementation needed

## Executive Summary

The neural memory system has significant architectural gaps in cross-source linking. The current implementation is **forward-only** with **no backfill**, **no relationship resolution**, and **incorrect entity attribution** when events arrive out of order. This document catalogs all identified gaps and proposes a research path for solutions.

---

## Problem Statement

### Core Issue

When users connect multiple sources (GitHub, Vercel, Sentry, Linear), the system cannot reliably link related events across sources. A Vercel deployment should link to the GitHub commit that triggered it, but the current architecture has no mechanism to establish or maintain these relationships.

### User Scenarios That Fail

**Scenario A: Vercel Connected Before GitHub**
```
1. User connects Vercel first
   → Deployment webhook: { commit: "abc123" }
   → Entity created: "commit:abc123" → sourceObservationId = Vercel deployment

2. User connects GitHub later
   → Push webhook: { commit: "abc123" }
   → Entity exists, only occurrenceCount++
   → Entity STILL points to Vercel as canonical source (wrong!)
```

**Scenario B: Webhook Race Condition**
```
Timeline:
  T+0ms:   Developer pushes commit
  T+50ms:  Vercel build triggered
  T+100ms: Vercel webhook arrives (FIRST)
  T+150ms: GitHub webhook arrives (SECOND)

Result: Commit entity points to Vercel, not GitHub
```

**Scenario C: No Historical Context**
```
1. User connects GitHub to existing repo with 500 PRs
2. System captures: 0 historical PRs
3. User asks: "What PRs did Sarah work on?"
4. Answer: Only PRs created AFTER connection
```

---

## Architectural Gaps

### Gap 1: No Backfill Mechanism

**Current State**: Webhook-forward only. No historical data captured on source connection.

**Evidence**:
- `api/console/src/router/org/workspace.ts:1207-1235` - Bulk link creates DB records only, no sync triggered
- `api/console/src/inngest/workflow/sources/github-sync-orchestrator.ts:140-148` - Only syncs files (documents), not events

**Impact**: Users start with empty observation history regardless of how much historical activity exists.

| Source | On Connect | Historical Data |
|--------|------------|-----------------|
| GitHub | Webhook subscription | None |
| Vercel | Webhook subscription | None |
| Sentry | Webhook subscription | None |
| Linear | Webhook subscription | None |

**What Should Exist**:
```typescript
async function backfillGitHub(workspaceId: string, repoId: string) {
  // Fetch last N days or N items of:
  // - Merged PRs
  // - Closed issues
  // - Commits to default branch
  // - Releases
  // Transform each to SourceEvent, mark as backfilled
}
```

---

### Gap 2: Entity Points to First Observer, Not Canonical Source

**Current State**: `sourceObservationId` is set on first insert, never updated.

**Evidence**:
- `db/console/src/schema/tables/workspace-neural-entities.ts:72` - `sourceObservationId` defined
- `api/console/src/inngest/workflow/neural/observation-capture.ts:585-596` - OnConflict only updates `occurrenceCount` and `lastSeenAt`

**Code**:
```typescript
.onConflictDoUpdate({
  target: [workspaceId, category, key],
  set: {
    lastSeenAt: new Date().toISOString(),
    occurrenceCount: sql`${table.occurrenceCount} + 1`,
    // NOTE: sourceObservationId NOT updated!
  },
})
```

**Impact**: Entity attribution is wrong when non-canonical source observes first.

**What Should Exist**:
```typescript
// Canonical source priority
const SOURCE_PRIORITY = { github: 1, linear: 2, vercel: 3, sentry: 4 };

// On conflict, update sourceObservationId if new source has higher priority
.onConflictDoUpdate({
  set: {
    sourceObservationId: sql`
      CASE WHEN ${SOURCE_PRIORITY[newSource]} < ${SOURCE_PRIORITY[existingSource]}
      THEN ${newObservationId}
      ELSE source_observation_id
      END
    `,
  },
})
```

---

### Gap 3: No Forward Reference Resolution

**Current State**: References captured at ingestion time, never resolved retroactively.

**Evidence**:
- `api/console/src/inngest/workflow/neural/observation-capture.ts:557` - `sourceReferences` stored as JSONB, never processed again
- No workflow exists to scan for unresolved references

**Example**:
```
1. Vercel deployment arrives with reference: { type: "pr", id: "#123" }
2. PR #123 observation doesn't exist yet
3. Reference stored but points to nothing
4. PR #123 arrives later
5. NO mechanism links Vercel deployment to PR #123
```

**What Should Exist**:
```typescript
// After observation capture, emit event
await step.sendEvent("resolve-references", {
  name: "neural/references.resolve",
  data: { observationId, references: sourceEvent.references }
});

// Separate workflow scans for matching observations
// Updates relationship table when matches found
```

---

### Gap 4: No Observation-to-Observation Relationships

**Current State**: Observations are isolated. No relationship table exists.

**Evidence**:
- `db/console/src/schema/relations.ts:73-96` - Only cluster relation defined
- No `observation_relationships` table in schema

**Impact**: Cannot answer "What events are related to this commit?" without full-text search.

**What Should Exist**:
```sql
CREATE TABLE observation_relationships (
  id VARCHAR(191) PRIMARY KEY,
  workspace_id VARCHAR(191) NOT NULL,
  from_observation_id VARCHAR(191) NOT NULL,
  to_observation_id VARCHAR(191) NOT NULL,
  relationship_type VARCHAR(50) NOT NULL,  -- 'triggered', 'references', 'fixes', 'deployed_by'
  confidence FLOAT DEFAULT 1.0,
  created_at TIMESTAMP DEFAULT NOW(),

  FOREIGN KEY (from_observation_id) REFERENCES workspace_neural_observations(id),
  FOREIGN KEY (to_observation_id) REFERENCES workspace_neural_observations(id)
);

CREATE INDEX idx_rel_from ON observation_relationships(from_observation_id);
CREATE INDEX idx_rel_to ON observation_relationships(to_observation_id);
CREATE INDEX idx_rel_type ON observation_relationships(workspace_id, relationship_type);
```

---

### Gap 5: sourceReferences Not Indexed for Queries

**Current State**: `sourceReferences` is JSONB with no index.

**Evidence**:
- `db/console/src/schema/tables/workspace-neural-observations.ts:150` - JSONB column
- No GIN index defined in migrations

**Impact**: Cannot efficiently query "Find all observations referencing commit abc123".

**Current Query (slow)**:
```sql
SELECT * FROM workspace_neural_observations
WHERE source_references @> '[{"type": "commit", "id": "abc123"}]';
-- Full table scan without GIN index
```

**What Should Exist**:
```sql
CREATE INDEX idx_obs_refs_gin ON workspace_neural_observations
USING GIN (source_references jsonb_path_ops);
```

---

### Gap 6: No Cross-Source Identifier Registry

**Current State**: Each source uses its own ID format. No unified registry.

**Evidence**: Scattered ID formats across transformers:
- GitHub: `pr:org/repo#123`, `push:org/repo:sha`
- Vercel: `deployment:dpl_xxx`
- No mapping between equivalent identifiers

**Impact**: Same entity (e.g., commit abc123) has different representations per source.

**What Should Exist**:
```typescript
// Unified identifier registry
interface CrossSourceIdentifier {
  canonicalId: string;           // "commit:abc123def456..."
  canonicalSource: string;       // "github"
  aliases: {
    source: string;
    format: string;
    value: string;
  }[];
}

// Example:
{
  canonicalId: "commit:abc123def456",
  canonicalSource: "github",
  aliases: [
    { source: "github", format: "sha", value: "abc123def456" },
    { source: "vercel", format: "githubCommitSha", value: "abc123def456" },
    { source: "sentry", format: "release", value: "abc123def456" }
  ]
}
```

---

### Gap 7: No Event Ordering by Business Time

**Current State**: Entities attributed by arrival order, not event occurrence order.

**Evidence**:
- `api/console/src/inngest/workflow/neural/observation-capture.ts:573-598` - First insert wins
- `occurredAt` stored but not used for entity attribution

**Impact**: Webhook delays cause incorrect attribution.

**What Should Exist**:
```typescript
// When processing observation, check if earlier observation exists
const earlierObservation = await db.select()
  .from(workspaceNeuralObservations)
  .where(and(
    eq(entityKey, key),
    lt(occurredAt, currentObservation.occurredAt)
  ))
  .orderBy(asc(occurredAt))
  .limit(1);

if (earlierObservation) {
  // Update entity to point to earlier observation
}
```

---

### Gap 8: Entity-Observation is One-to-One, Should Be Many-to-Many

**Current State**: Entity has single `sourceObservationId`.

**Evidence**:
- `db/console/src/schema/tables/workspace-neural-entities.ts:72` - Single FK field

**Impact**: Cannot find all observations mentioning an entity.

**What Should Exist**:
```sql
CREATE TABLE entity_observations (
  entity_id VARCHAR(191) NOT NULL,
  observation_id VARCHAR(191) NOT NULL,
  mention_type VARCHAR(50),  -- 'created', 'referenced', 'modified'
  confidence FLOAT DEFAULT 1.0,

  PRIMARY KEY (entity_id, observation_id),
  FOREIGN KEY (entity_id) REFERENCES workspace_neural_entities(id),
  FOREIGN KEY (observation_id) REFERENCES workspace_neural_observations(id)
);
```

---

### Gap 9: No Causal Chain Tracking

**Current State**: Events are independent observations with no causal links.

**Example Causal Chain (not tracked)**:
```
1. Developer pushes commit abc123 to feature branch
   └─→ GitHub push event

2. Developer opens PR #42 (head: abc123)
   └─→ GitHub pull_request.opened

3. Vercel creates preview deployment
   └─→ Vercel deployment.created (commit: abc123)

4. Tests pass, PR merged
   └─→ GitHub pull_request.closed (merged: true)
   └─→ GitHub push to main (merge commit: def456)

5. Vercel production deployment
   └─→ Vercel deployment.created (commit: def456)

6. Bug in production
   └─→ Sentry issue.created (release: def456)
```

**Impact**: Cannot trace "Which PR introduced this Sentry error?"

**What Should Exist**:
```typescript
interface CausalChain {
  rootCause: ObservationId;      // The commit that started it
  events: {
    observationId: string;
    causalParentId: string;      // What triggered this
    relationship: string;         // 'triggered', 'resulted_in', 'deployed'
    timestamp: string;
  }[];
}
```

---

### Gap 10: Incomplete Reference Extraction

**Current State**: Transformers extract some references, miss others.

**GitHub Transformer Gaps** (`packages/console-webhooks/src/transformers/github.ts`):
- ✅ Extracts: PR number, head SHA, linked issues (fixes #123)
- ❌ Missing: Base branch, merge commit SHA (for merged PRs)
- ❌ Missing: All commits in PR (only head SHA)
- ❌ Missing: Check runs / status checks

**Vercel Transformer Gaps** (`packages/console-webhooks/src/transformers/vercel.ts`):
- ✅ Extracts: Commit SHA, branch, deployment ID
- ❌ Missing: `githubPullRequestId` (if available in payload)
- ❌ Missing: Previous deployment ID (for rollback tracking)
- ❌ Missing: Build logs URL

---

## Cross-Source Linkage Map

### Known Linkable Identifiers

| Identifier | GitHub | Vercel | Sentry | Linear |
|------------|--------|--------|--------|--------|
| Commit SHA | ✅ `payload.after`, `pr.head.sha` | ✅ `meta.githubCommitSha` | ⚠️ Release name? | ❓ |
| Branch Name | ✅ `ref`, `pr.head.ref` | ✅ `meta.githubCommitRef` | ❓ | ❓ |
| Repo Name | ✅ `repository.full_name` | ✅ `meta.githubOrg/Repo` | ⚠️ Project name? | ❓ |
| PR Number | ✅ `pull_request.number` | ❓ Unknown | ❓ | ⚠️ Attachments? |
| Issue Number | ✅ `issue.number` | ❌ | ❓ | ⚠️ Linked? |
| Actor Email | ✅ Available | ⚠️ Via commit | ⚠️ User email | ✅ Available |

### Causal Relationships

```
┌─────────────────────────────────────────────────────────────────────┐
│                     CROSS-SOURCE CAUSAL CHAIN                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  GitHub Push (commit abc123)                                         │
│       │                                                              │
│       ├──────────────────┬──────────────────┐                       │
│       ▼                  ▼                  ▼                       │
│  GitHub PR #42      Vercel Preview     Linear Issue                 │
│  (head: abc123)     (commit: abc123)   (branch: feat/x)             │
│       │                  │                                          │
│       ▼                  │                                          │
│  PR Merged               │                                          │
│  (merge: def456)         │                                          │
│       │                  │                                          │
│       ├──────────────────┘                                          │
│       ▼                                                              │
│  GitHub Push (main, def456)                                          │
│       │                                                              │
│       ▼                                                              │
│  Vercel Production (commit: def456)                                  │
│       │                                                              │
│       ▼                                                              │
│  Sentry Error (release: def456)                                      │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘

LINKING IDENTIFIERS:
  • abc123 links: GitHub push → PR → Vercel preview
  • def456 links: PR merge → GitHub push → Vercel prod → Sentry
  • Branch "feat/x" links: GitHub PR → Linear issue
  • Actor email links: All events by same developer
```

---

## Proposed Solution Architecture

### Phase 1: Relationship Table + GIN Index

```sql
-- Add relationship tracking
CREATE TABLE observation_relationships (...);

-- Add JSONB index for reference queries
CREATE INDEX idx_obs_refs_gin ON workspace_neural_observations
USING GIN (source_references jsonb_path_ops);
```

### Phase 2: Reference Resolution Workflow

```typescript
// New Inngest workflow: neural/references.resolve
// Triggered after observation capture
// Scans for matching observations by shared identifiers
// Creates relationship records
```

### Phase 3: Canonical Source Attribution

```typescript
// Update entity upsert to respect source priority
// GitHub > Linear > Vercel > Sentry
// Earlier occurredAt wins within same priority
```

### Phase 4: Backfill on Connect

```typescript
// GitHub: Fetch last 100 merged PRs, 100 issues, 100 commits
// Vercel: Fetch last 50 production deployments
// Mark as backfilled, process through normal pipeline
```

---

## Next Steps

1. **Run cross-source linkage research** - Use prompt above to map all available identifiers
2. **Design relationship schema** - Finalize `observation_relationships` table
3. **Implement reference resolution** - Background workflow to link observations
4. **Add canonical source logic** - Update entity upsert
5. **Build backfill mechanism** - Start with GitHub PRs

---

## References

### Code Files
- `api/console/src/inngest/workflow/neural/observation-capture.ts` - Main pipeline
- `packages/console-webhooks/src/transformers/github.ts` - GitHub transformer
- `packages/console-webhooks/src/transformers/vercel.ts` - Vercel transformer
- `db/console/src/schema/tables/workspace-neural-observations.ts` - Observation schema
- `db/console/src/schema/tables/workspace-neural-entities.ts` - Entity schema

### Related Research
- `thoughts/shared/research/2025-12-13-cross-source-linkage-architecture.md` - Deep dive on cross-source identifiers and causal chains
- `thoughts/shared/research/2025-12-13-neural-memory-v1-gap-analysis.md` - V1 implementation status
- `docs/architecture/analysis/2025-12-09-neural-memory-e2e-design.md` - Original design spec
