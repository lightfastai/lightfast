---
date: 2026-02-05T12:30:00+08:00
researcher: Claude
git_commit: d2ee86b28fd4b2ff54719b241aa4d64b7ad25128
branch: main
repository: lightfast
topic: "Accelerator Demo: Relationship Graph vs Timeline Analysis"
tags: [research, codebase, relationships, cross-source, timeline, context-graph, sentry, linear, demo]
status: complete
last_updated: 2026-02-05
last_updated_by: Claude
last_updated_note: "Updated with decision to implement true relationship graph for accelerator demo"
decision: implement-true-graph
---

# Research: Accelerator Demo - Relationship Graph vs Timeline Analysis

**Date**: 2026-02-05T12:30:00+08:00
**Researcher**: Claude
**Git Commit**: d2ee86b28fd4b2ff54719b241aa4d64b7ad25128
**Branch**: main
**Repository**: lightfast

## Research Question

1. Is the timeline in the accelerator demo plan "general purpose" or does it track through relationship levels (Vercel → commits → PR → GitHub issue ↔ Linear issue → Sentry)?
2. Where are relationships defined in code vs just in the plan document?
3. Are the Sentry/Linear mocks in `demo-incident.json` accurate to actual webhook structures?
4. Is "context graph" more fundamental than "timeline" (timeline as byproduct)?

## Summary

**Key Finding**: The codebase has **foundational building blocks** for relationship tracking but **no explicit relationship graph implementation**. The accelerator demo plan proposes new APIs (`/v1/related`, `/v1/timeline`) that would query existing `sourceReferences` data, but the underlying relationship graph is implicit rather than explicit.

**Decision**: **Implement a true relationship graph** for the accelerator demo rather than relying on ad-hoc JSONB queries. The incremental effort (~1-2 days) is worth it because:
1. The demo IS the product pitch - showing real architecture matters
2. JSONB containment queries are fragile and don't scale
3. The relationship data already exists in transformers - just need proper storage
4. Avoids throwaway code that would need rewriting for production

**Timeline vs Context Graph**: Context graph is **more fundamental**. Timeline is simply one projection of the underlying relationship data. The codebase stores relationships in `sourceReferences` JSONB fields, but lacks bidirectional traversal, typed relationship edges, or graph query capabilities. **We will build the graph first; timeline becomes a simple query on it.**

**Mock Accuracy**: The Sentry and Linear mocks are **largely accurate** but missing some important cross-referencing fields (particularly `statusDetails.inCommit` for Sentry and `attachments` for Linear). These will be added as part of implementation.

---

## Detailed Findings

### 1. Current Relationship Storage in Code

#### sourceReferences JSONB Column

**Schema Definition**: `db/console/src/schema/tables/workspace-neural-observations.ts:159`

```typescript
export interface ObservationReference {
  type: 'commit' | 'branch' | 'pr' | 'issue' | 'deployment' | 'project' |
        'cycle' | 'assignee' | 'reviewer' | 'team' | 'label';
  id: string;
  url?: string;
  label?: string;  // e.g., "fixes", "closes", "merge"
}
```

**What exists today**:
- References are stored as a JSONB array on each observation
- References are **outgoing only** (observation → referenced entities)
- No reverse index (entity → observations that reference it)
- No typed relationship edges (just "references", not "fixes", "blocks", "follows")

#### How References Are Written

**GitHub Transformer** (`packages/console-webhooks/src/transformers/github.ts`):
- Push events: extracts `commit` (SHA), `branch` references (lines 44-54)
- PR events: extracts `pr`, `branch`, `commit`, `issue` (with "fixes"/"closes" labels), `reviewer`, `assignee`, `label` (lines 121-188)
- Issue extraction from PR body uses regex: `/(fix(?:es)?|close[sd]?|resolve[sd]?)\s+#(\d+)/gi` (line 477-492)

**Vercel Transformer** (`packages/console-webhooks/src/transformers/vercel.ts`):
- Deployment events: extracts `commit` (from `meta.githubCommitSha`), `branch`, `deployment`, `project` (lines 34-69)
- **Critical**: The commit SHA is the cross-source linking key to GitHub

**Linear Transformer** (`packages/console-test-data/src/transformers/linear.ts`):
- Issue events: extracts `issue`, `team`, `project`, `cycle`, `assignee`, `label`, `branch` (lines 317-372)
- Comment events: extracts parent `issue` reference (lines 457-464)

**Sentry Transformer** (`packages/console-test-data/src/transformers/sentry.ts`):
- Issue events: extracts `issue`, `project`, `assignee` (lines 228-250)
- Event alerts: extracts `project` only (lines 402-407)

#### How References Are Queried

**Actor Resolution** (`api/console/src/inngest/workflow/neural/observation-capture.ts:257-269`):
```typescript
// Uses PostgreSQL JSONB containment operator
sql`${workspaceNeuralObservations.sourceReferences}::jsonb @> ${JSON.stringify([{ type: "commit", id: commitSha }])}::jsonb`
```

This is the **only current use** of cross-source reference queries - finding Vercel observations that reference a GitHub commit to reconcile actor IDs.

---

### 2. What the Demo Plan Proposes vs What Exists

#### Proposed in Plan (Does NOT Exist Yet)

| Component | Location in Plan | Current State |
|-----------|------------------|---------------|
| `/v1/related/{id}` API | Phase 3, lines 489-678 | **Does not exist** |
| `/v1/timeline` API | Phase 4, lines 763-872 | **Does not exist** |
| `references` field in V1SearchResult | Phase 2, lines 300-356 | **Does not exist** (schema needs update) |
| Demo reset script | Phase 1, lines 74-264 | **Does not exist** |

#### What Already Exists (Building Blocks)

| Component | File Location | Purpose |
|-----------|---------------|---------|
| `sourceReferences` column | `db/console/src/schema/tables/workspace-neural-observations.ts:159` | Stores references |
| Reference extraction | `packages/console-webhooks/src/transformers/*.ts` | Populates references from webhooks |
| Entity extraction from refs | `api/console/src/inngest/workflow/neural/entity-extraction-patterns.ts:170-210` | Converts refs to entities |
| JSONB containment query | `api/console/src/inngest/workflow/neural/observation-capture.ts:262` | Cross-source actor resolution |
| Four-path search | `apps/console/src/lib/neural/four-path-search.ts` | Multi-modal retrieval (does NOT use refs) |

---

### 3. The Relationship Graph Question

#### Current State: Implicit Graph via sourceReferences

```
┌─────────────────────────────────────────────────────────────────────┐
│                    CURRENT: Implicit References                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Observation A          Observation B          Observation C         │
│  (GitHub PR #478)       (Vercel Deploy)        (Sentry Issue)        │
│  ┌──────────────┐       ┌──────────────┐       ┌──────────────┐     │
│  │refs:         │       │refs:         │       │refs:         │     │
│  │- commit:abc  │───┐   │- commit:abc  │───┐   │- issue:123   │     │
│  │- issue:#500  │   │   │- deploy:dpl1 │   │   │- project:p1  │     │
│  │- issue:LIN-892   │   │- project:p1  │   │   └──────────────┘     │
│  └──────────────┘   │   └──────────────┘   │                        │
│                     │                       │                        │
│                     └───────────────────────┘                        │
│                     (Implicit link via shared commit SHA)            │
│                                                                      │
│  ❌ No reverse lookups (can't query "what refs commit:abc?")        │
│  ❌ No typed edges (refs don't describe relationship type)           │
│  ❌ No graph traversal (can't walk from A → B → C)                   │
└─────────────────────────────────────────────────────────────────────┘
```

#### What a Context Graph Would Look Like

```
┌─────────────────────────────────────────────────────────────────────┐
│                    DESIRED: Explicit Relationship Graph              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────┐                                                   │
│  │ Sentry Issue │                                                   │
│  │ CHECKOUT-123 │                                                   │
│  └──────┬───────┘                                                   │
│         │ triggers                                                  │
│         ▼                                                           │
│  ┌──────────────┐         ┌──────────────┐                         │
│  │ Linear Issue │ ◄─────► │ GitHub Issue │  (two-way sync)         │
│  │   LIN-892    │         │    #500      │                         │
│  └──────┬───────┘         └──────┬───────┘                         │
│         │ assigned branch        │ fixes                           │
│         ▼                        ▼                                 │
│  ┌──────────────┐         ┌──────────────┐                         │
│  │ Git Branch   │ ◄─────► │  GitHub PR   │  (head ref)             │
│  │ lin-892-...  │         │    #478      │                         │
│  └──────────────┘         └──────┬───────┘                         │
│                                  │ merge_commit                     │
│                                  ▼                                  │
│                           ┌──────────────┐                         │
│                           │ Git Commit   │                         │
│                           │ merge478sha  │                         │
│                           └──────┬───────┘                         │
│                                  │ deployed_by                      │
│                                  ▼                                  │
│                           ┌──────────────┐                         │
│                           │Vercel Deploy │                         │
│                           │dpl_hotfix_478│                         │
│                           └──────────────┘                         │
│                                                                      │
│  ✅ Bidirectional edges                                             │
│  ✅ Typed relationships (triggers, fixes, deploys)                  │
│  ✅ Graph traversal queries                                         │
└─────────────────────────────────────────────────────────────────────┘
```

---

### 4. Timeline vs Context Graph

**Your intuition is correct**: Timeline is a **projection** of the context graph, not the fundamental data structure.

| Aspect | Timeline | Context Graph |
|--------|----------|---------------|
| **Data Model** | Flat list ordered by time | Node-edge graph with relationships |
| **Query Type** | `WHERE occurredAt BETWEEN x AND y` | Traversal: `MATCH (a)-[:FIXES]->(b)` |
| **What it answers** | "What happened when?" | "How are these connected?" |
| **Implementation** | Simple date filtering | Requires relationship table or graph DB |

**The demo plan's Timeline API** (`/v1/timeline`) is essentially:
- Filter observations by time window
- Optionally filter by entity presence in title/refs
- Return flat list ordered by `occurredAt DESC`

This is **not a true timeline** that shows causality or relationship flow. It's just temporal filtering.

**A true context graph** would enable queries like:
- "Show me everything connected to PR #478" (traverse all edges)
- "What triggered this Vercel deployment?" (walk back through relationships)
- "What issues were fixed by commits in this release?" (graph query)

---

### 5. Sentry Mock Accuracy

**Source**: Sentry Webhooks Documentation (https://docs.sentry.io/organization/integrations/integration-platform/webhooks/)

#### ✅ Accurate Fields
- `action`: "created", "resolved", "assigned", "triggered" ✓
- `data.issue`: Core fields (id, shortId, title, metadata, project, assignedTo) ✓
- `installation.uuid` ✓
- `actor` for resolved events ✓

#### ⚠️ Missing Critical Fields

**`statusDetails` in `issue.resolved`** - Most important for cross-referencing:

```json
{
  "data": {
    "issue": {
      "status": "resolved",
      "statusDetails": {
        "inCommit": {
          "repository": "acme/platform",
          "commit": "merge478sha456"  // ← Links to GitHub!
        },
        "inRelease": "v2.4.2",
        "inNextRelease": false
      }
    }
  }
}
```

This is how Sentry **actually links** issue resolutions to specific Git commits. Your mock lacks this field, which would be crucial for automatic Sentry → GitHub linking.

**Other missing fields**:
- `substatus`: "new", "ongoing", "escalating", "regressed"
- `issueType`: "error", "csp", "default"
- `issueCategory`: "error", "csp"
- `priority`: "high", "medium", "low"
- `issue_alert.settings` in event_alert webhooks

---

### 6. Linear Mock Accuracy

**Source**: Linear Webhooks Documentation (https://linear.app/developers/webhooks)

#### ✅ Accurate Fields
- Issue structure with `identifier`, `title`, `state`, `team`, `assignee`, `labels` ✓
- Comment structure with nested `issue` reference ✓
- `updatedFrom` for tracking state transitions ✓
- `branchName` for GitHub branch linkage ✓
- `webhookTimestamp` in milliseconds ✓

#### ⚠️ Missing for GitHub Integration

If testing GitHub integration, Issue data should include `attachments`:

```json
{
  "data": {
    "id": "issue_lin_892",
    "attachments": {
      "nodes": [
        {
          "id": "attachment_gh_pr_478",
          "title": "PR #478: fix: Handle null prices",
          "url": "https://github.com/acme/platform/pull/478",
          "source": "github",
          "sourceType": "githubPr",
          "metadata": {
            "state": "merged",
            "number": 478
          }
        }
      ]
    }
  }
}
```

Without `attachments`, the cross-reference relies on:
1. Markdown in `description` (manual, unstructured)
2. `branchName` matching GitHub branch (indirect)

---

### 7. The Relationship Linkage Diagram

Based on actual webhook structures, here's how cross-source linking **should** work:

```
┌─────────────────────────────────────────────────────────────────────┐
│                    CROSS-SOURCE REFERENCE FLOW                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  SENTRY                                                             │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │ issue.resolved                                              │    │
│  │   statusDetails.inCommit.commit = "merge478sha456"    ──────┼────┤
│  │   statusDetails.inRelease = "v2.4.2"                        │    │
│  └────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  LINEAR                                                             │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │ Issue LIN-892                                               │    │
│  │   branchName = "lin-892-checkout-typeerror"           ──────┼────┤
│  │   attachments[].url = "github.com/.../pull/478"       ──────┼────┤
│  │   description contains "CHECKOUT-123" (manual)              │    │
│  └────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  GITHUB                                                             │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │ PR #478                                                     │    │
│  │   head.ref = "fix/checkout-null-price"                      │    │
│  │   head.sha = "fix478sha123"                                 │    │
│  │   merge_commit_sha = "merge478sha456"                 ◄─────┼────┤
│  │   body contains "Fixes LIN-892" → issue ref with label ─────┼────┤
│  │   body contains "Fixes #500"                                │    │
│  └────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  VERCEL                                                             │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │ deployment.succeeded                                        │    │
│  │   meta.githubCommitSha = "merge478sha456"             ◄─────┼────┤
│  │   meta.githubPrId = "478"                                   │    │
│  │   meta.githubCommitRef = "main"                             │    │
│  └────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  ═══════════════════════════════════════════════════════════════   │
│  LINKING KEYS:                                                      │
│    • Commit SHA (merge478sha456) - links Sentry ↔ GitHub ↔ Vercel  │
│    • PR Number (#478) - links Linear ↔ GitHub                       │
│    • Branch Name - links Linear ↔ GitHub                            │
│    • Issue IDs (LIN-892, #500, CHECKOUT-123) - entity extraction   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Architecture Documentation

### What Would Be Needed for True Context Graph

1. **Bidirectional Relationship Table**:
```sql
CREATE TABLE observation_relationships (
  id BIGINT PRIMARY KEY,
  source_observation_id BIGINT NOT NULL,
  target_observation_id BIGINT NOT NULL,
  relationship_type VARCHAR(50) NOT NULL,  -- "fixes", "triggers", "deploys", "references"
  confidence REAL DEFAULT 1.0,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(source_observation_id, target_observation_id, relationship_type)
);
```

2. **Graph Query API**:
```typescript
// Traverse from observation to all connected observations
GET /v1/graph/{observationId}?depth=2&types=fixes,triggers

// Find path between two observations
GET /v1/graph/path?from={id1}&to={id2}

// Get subgraph around an entity (commit SHA, issue ID)
GET /v1/graph/entity/{entityKey}?depth=3
```

3. **Relationship Classification**:
- Parse PR bodies for "Fixes", "Closes", "Relates to" keywords
- Use `statusDetails.inCommit` from Sentry to create "resolved_by" edges
- Use commit SHA matching to create "deployed_by" edges
- Use `attachments` from Linear to create "tracked_in" edges

---

## Historical Context (from thoughts/)

- `thoughts/shared/research/2026-02-05-lightfast-core-research-concerns.md` - Section 4 discusses cross-source entity resolution but doesn't propose a graph implementation
- `thoughts/shared/plans/2026-02-05-accelerator-demo-search-showcase.md` - The plan being analyzed; proposes APIs but not a graph

---

## Code References

### sourceReferences Schema
- `db/console/src/schema/tables/workspace-neural-observations.ts:159` - Column definition
- `db/console/src/schema/tables/workspace-neural-observations.ts:19-25` - ObservationReference interface

### Transformers (Write references)
- `packages/console-webhooks/src/transformers/github.ts:44-188` - GitHub reference extraction
- `packages/console-webhooks/src/transformers/vercel.ts:34-69` - Vercel reference extraction
- `packages/console-test-data/src/transformers/linear.ts:317-372` - Linear reference extraction
- `packages/console-test-data/src/transformers/sentry.ts:228-250` - Sentry reference extraction

### Reference Queries (Read references)
- `api/console/src/inngest/workflow/neural/observation-capture.ts:257-269` - JSONB containment query
- `api/console/src/inngest/workflow/neural/entity-extraction-patterns.ts:170-210` - Extract entities from refs

### Four-Path Search (Does NOT use references)
- `apps/console/src/lib/neural/four-path-search.ts:552-650` - Result enrichment (fetches metadata, not refs)

---

## Decision: Implement True Relationship Graph

### Why Build It Now

| Approach | Demo Quality | Future Value | Time Investment |
|----------|-------------|--------------|-----------------|
| **JSONB queries (original plan)** | Works for 17 events | Throwaway at scale | ~8 hours |
| **True relationship graph** | Same demo, real foundation | Production-ready | ~16-24 hours |

**The demo IS the product pitch.** Showing accelerator judges a real relationship graph architecture is more compelling than JSONB string matching.

### Implementation Approach

**Phase 1: Schema + Migration**
- Add `observation_relationships` table (see schema below)
- Add indexes for bidirectional lookups
- No changes to existing tables

**Phase 2: Relationship Extraction**
- Modify `observation-capture.ts` to create edges during ingestion
- Extract relationships from `sourceReferences` during capture
- Match observations by shared linking keys (commit SHA, issue ID, branch name)

**Phase 3: Graph Query API**
- `/v1/graph/{id}` - Traverse from observation with configurable depth
- `/v1/graph/entity/{key}` - Find all observations connected to an entity
- Replace proposed `/v1/related` and `/v1/timeline` with graph queries

**Phase 4: Demo + Mock Updates**
- Update `demo-incident.json` with missing Sentry/Linear fields
- Demo script using real graph queries

---

## Relationship Graph Schema

### Database Table

```sql
CREATE TABLE lightfast_observation_relationships (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,

  -- Identity
  external_id VARCHAR(21) NOT NULL,           -- nanoid for API
  workspace_id VARCHAR(191) NOT NULL,

  -- Relationship
  source_observation_id BIGINT NOT NULL,      -- FK to observations.id
  target_observation_id BIGINT NOT NULL,      -- FK to observations.id
  relationship_type VARCHAR(50) NOT NULL,     -- See types below

  -- Linking context
  linking_key VARCHAR(500),                   -- The shared reference (SHA, issue ID)
  linking_key_type VARCHAR(50),               -- "commit", "issue", "branch", "pr"

  -- Confidence & metadata
  confidence REAL DEFAULT 1.0,                -- 1.0 = explicit, 0.8 = inferred
  metadata JSONB,                             -- Additional context

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),

  -- Constraints
  CONSTRAINT unique_relationship
    UNIQUE(workspace_id, source_observation_id, target_observation_id, relationship_type)
);

-- Indexes for bidirectional traversal
CREATE INDEX idx_rel_workspace_source ON lightfast_observation_relationships(workspace_id, source_observation_id);
CREATE INDEX idx_rel_workspace_target ON lightfast_observation_relationships(workspace_id, target_observation_id);
CREATE INDEX idx_rel_workspace_linking_key ON lightfast_observation_relationships(workspace_id, linking_key);
CREATE INDEX idx_rel_external_id ON lightfast_observation_relationships(external_id);
```

### Relationship Types

| Type | Source → Target | Example |
|------|-----------------|---------|
| `fixes` | PR → Issue | PR #478 fixes issue #500 |
| `resolves` | Commit → Sentry Issue | Commit resolves CHECKOUT-123 |
| `triggers` | Sentry Error → Linear Issue | Error triggers incident tracking |
| `deploys` | Vercel Deploy → Commit | Deployment deploys commit SHA |
| `references` | Any → Any | Generic reference link |
| `same_commit` | Observation ↔ Observation | Two events about same commit |
| `same_branch` | Observation ↔ Observation | Two events about same branch |
| `tracked_in` | GitHub PR → Linear Issue | PR tracked in Linear via attachment |

### Relationship Detection Rules

```typescript
// During observation capture, detect relationships:

// 1. Commit SHA matching (high confidence)
// When: New observation has commit SHA in sourceReferences
// Action: Find existing observations with same commit SHA
// Type: "same_commit" (bidirectional)
// Confidence: 1.0

// 2. PR fixes issue (high confidence)
// When: GitHub PR body contains "Fixes #123" or "Fixes LIN-892"
// Action: Create edge from PR observation to issue observation
// Type: "fixes"
// Confidence: 1.0 (explicit in PR body)

// 3. Sentry resolved by commit (high confidence)
// When: Sentry issue.resolved has statusDetails.inCommit
// Action: Create edge from commit observation to Sentry observation
// Type: "resolves"
// Confidence: 1.0 (from Sentry API)

// 4. Vercel deploys commit (high confidence)
// When: Vercel deployment has meta.githubCommitSha
// Action: Create edge from deployment to commit observation
// Type: "deploys"
// Confidence: 1.0 (from Vercel metadata)

// 5. Branch name matching (medium confidence)
// When: Linear issue has branchName matching GitHub PR head.ref
// Action: Create edge between Linear issue and GitHub PR
// Type: "tracked_in"
// Confidence: 0.9 (naming convention match)

// 6. Entity co-occurrence (lower confidence)
// When: Two observations mention same issue ID in text
// Action: Create edge between observations
// Type: "references"
// Confidence: 0.7 (text extraction)
```

---

## Graph Query API Design

### GET /v1/graph/{observationId}

Traverse the relationship graph from a starting observation.

```typescript
// Request
GET /v1/graph/obs_abc123?depth=2&types=fixes,deploys&direction=both

// Response
{
  "data": {
    "root": {
      "id": "obs_abc123",
      "title": "PR #478: fix: Handle null prices",
      "source": "github",
      "type": "pull-request.merged"
    },
    "nodes": [
      {
        "id": "obs_def456",
        "title": "TypeError: price.toFixed is not a function",
        "source": "sentry",
        "type": "issue.created",
        "depth": 1,
        "relationshipFromRoot": "fixes"
      },
      {
        "id": "obs_ghi789",
        "title": "Deployment succeeded: acme-platform",
        "source": "vercel",
        "type": "deployment.succeeded",
        "depth": 1,
        "relationshipFromRoot": "deploys"
      }
    ],
    "edges": [
      {
        "source": "obs_abc123",
        "target": "obs_def456",
        "type": "fixes",
        "linkingKey": "#500",
        "confidence": 1.0
      },
      {
        "source": "obs_ghi789",
        "target": "obs_abc123",
        "type": "deploys",
        "linkingKey": "merge478sha456",
        "confidence": 1.0
      }
    ]
  },
  "meta": {
    "depth": 2,
    "nodeCount": 3,
    "edgeCount": 2
  }
}
```

### GET /v1/graph/entity/{key}

Find all observations connected to a specific entity (commit SHA, issue ID, etc.)

```typescript
// Request
GET /v1/graph/entity/merge478sha456?type=commit

// Response
{
  "data": {
    "entity": {
      "key": "merge478sha456",
      "type": "commit"
    },
    "observations": [
      { "id": "obs_1", "source": "github", "type": "push", "relationship": "contains" },
      { "id": "obs_2", "source": "github", "type": "pull-request.merged", "relationship": "merge_commit" },
      { "id": "obs_3", "source": "vercel", "type": "deployment.succeeded", "relationship": "deploys" },
      { "id": "obs_4", "source": "sentry", "type": "issue.resolved", "relationship": "resolved_by" }
    ]
  }
}
```

### Timeline as Graph Projection

The timeline becomes a simple projection of the graph:

```typescript
// GET /v1/timeline?entity=LIN-892&hours=24
// Internally:
// 1. Find all observations connected to LIN-892 via graph
// 2. Filter by time window
// 3. Sort by occurredAt
// 4. Return with relationship context

{
  "data": [
    { "id": "obs_1", "title": "Sentry alert", "occurredAt": "08:30", "relationship": "triggers" },
    { "id": "obs_2", "title": "Linear issue created", "occurredAt": "08:50", "relationship": "root" },
    { "id": "obs_3", "title": "GitHub issue opened", "occurredAt": "09:00", "relationship": "tracked_in" },
    { "id": "obs_4", "title": "PR opened", "occurredAt": "11:30", "relationship": "fixes" },
    { "id": "obs_5", "title": "PR merged", "occurredAt": "12:00", "relationship": "fixes" },
    { "id": "obs_6", "title": "Vercel deployed", "occurredAt": "12:10", "relationship": "deploys" },
    { "id": "obs_7", "title": "Sentry resolved", "occurredAt": "12:15", "relationship": "resolved_by" }
  ]
}
```

---

## Demo-Incident.json Updates Required

### Sentry issue.resolved - Add statusDetails

```json
{
  "source": "sentry",
  "eventType": "issue.resolved",
  "payload": {
    "data": {
      "issue": {
        "status": "resolved",
        "statusDetails": {
          "inCommit": {
            "repository": "acme/platform",
            "commit": "merge478sha456"
          },
          "inRelease": "v2.4.2",
          "inNextRelease": false
        }
      }
    }
  }
}
```

### Linear Issue - Add attachments (optional, for GitHub integration demo)

```json
{
  "data": {
    "attachments": {
      "nodes": [
        {
          "id": "attachment_gh_pr_478",
          "title": "PR #478: fix: Handle null prices",
          "url": "https://github.com/acme/platform/pull/478",
          "source": "github",
          "sourceType": "githubPr"
        }
      ]
    }
  }
}
```

---

## Resolved Questions

1. **Should relationships be first-class entities?**
   **Yes.** New `observation_relationships` table with proper schema.

2. **What relationship types matter?**
   **8 types identified:** fixes, resolves, triggers, deploys, references, same_commit, same_branch, tracked_in.

3. **How to handle implicit relationships?**
   **Materialize them** with lower confidence scores (0.7-0.9) during capture.

4. **Should the graph be materialized?**
   **Yes.** Pre-compute relationships during observation capture. Query-time computation doesn't scale.

5. **What about relationship confidence?**
   **Track it.** 1.0 for explicit (Sentry statusDetails), 0.9 for naming matches, 0.7 for text extraction.

---

## Implementation Priority

1. **Schema migration** - Add relationship table
2. **Relationship extraction in capture workflow** - Create edges during ingestion
3. **Update demo-incident.json** - Add missing cross-reference fields
4. **Graph query API** - `/v1/graph/{id}` endpoint
5. **Demo script** - Walk through incident using real graph queries

This replaces the original 4-phase plan with a graph-first approach where timeline and related-events become simple projections of the underlying relationship data.
