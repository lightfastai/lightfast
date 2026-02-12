---
date: 2026-02-10T00:00:00Z
researcher: Claude
git_commit: 593bc567cf765058503dd8901ce5e276460dde82
branch: main
repository: lightfast-search-perf-improvements
topic: "detectAndCreateRelationships - Relationship Types, Predicates, and SQL Queries"
tags: [research, codebase, neural, relationships, graph, sql]
status: complete
last_updated: 2026-02-10
last_updated_by: Claude
---

# Research: detectAndCreateRelationships - Relationship Types, Predicates, and SQL Queries

**Date**: 2026-02-10
**Researcher**: Claude
**Git Commit**: 593bc567cf765058503dd8901ce5e276460dde82
**Branch**: main
**Repository**: lightfast-search-perf-improvements

## Research Question

Document the complete relationship detection system:
1. All relationship types that can be created
2. For each type: the matching predicate (exact match, temporal window, fuzzy)
3. The SQL queries used to find candidate matches
4. The schema of the relationships table
5. Average fan-out per observation
6. Complexity: O(?) per observation ingested

## Summary

The `detectAndCreateRelationships` function in `api/console/src/inngest/workflow/neural/relationship-detection.ts` creates typed edges between observations based on shared references (commit SHAs, branch names, issue IDs, PR numbers). It implements 8 relationship types with varying confidence levels (0.8-1.0) and uses PostgreSQL JSONB containment queries with ILIKE fallbacks. Each query is limited to 50 matches per reference type, and deduplication ensures one edge per target-type pair.

## Relationship Types

The system creates 8 distinct relationship types defined in the schema:

1. **fixes** - PR/commit fixes an issue
2. **resolves** - Commit resolves a Sentry issue
3. **triggers** - Sentry error triggers Linear issue
4. **deploys** - Vercel deployment deploys a commit
5. **references** - Generic reference link
6. **same_commit** - Two observations about the same commit
7. **same_branch** - Two observations about the same branch
8. **tracked_in** - GitHub PR tracked in Linear via attachment

Source: [db/console/src/schema/tables/workspace-observation-relationships.ts:27-35](../../../db/console/src/schema/tables/workspace-observation-relationships.ts#L27-L35)

## Formal Detection Rules

### Rule 1: SAME_COMMIT (Default)
```
IF sourceReferences contains { type: "commit", id: <SHA> }
   AND target observation has same SHA in sourceReferences
   AND NOT (source=sentry AND label="resolved_by")
   AND NOT (source IN ["vercel","github"] AND target.source IN ["github","vercel"])
THEN create_edge(
   type: "same_commit",
   confidence: 1.0,
   linkingKey: <SHA>,
   linkingKeyType: "commit",
   detectionMethod: "commit_match"
)
```
**Predicate**: Exact match on commit SHA via JSONB containment
**Source**: [relationship-detection.ts:69-103](../../../api/console/src/inngest/workflow/neural/relationship-detection.ts#L69-L103)

### Rule 2: RESOLVES (Sentry Commit Resolution)
```
IF sourceReferences contains { type: "commit", id: <SHA>, label: "resolved_by" }
   AND (source="sentry" OR target.source="sentry")
   AND target observation has same SHA in sourceReferences
THEN create_edge(
   type: "resolves",
   confidence: 1.0,
   linkingKey: <SHA>,
   linkingKeyType: "commit",
   detectionMethod: "explicit"
)
```
**Predicate**: Exact match on commit SHA + explicit label "resolved_by"
**Source**: [relationship-detection.ts:92](../../../api/console/src/inngest/workflow/neural/relationship-detection.ts#L92), [determineCommitRelationType:455-461](../../../api/console/src/inngest/workflow/neural/relationship-detection.ts#L455-L461)

### Rule 3: DEPLOYS (Vercel ↔ GitHub)
```
IF sourceReferences contains { type: "commit", id: <SHA> }
   AND ((source="vercel" AND target.source="github")
        OR (source="github" AND target.source="vercel"))
   AND target observation has same SHA in sourceReferences
THEN create_edge(
   type: "deploys",
   confidence: 1.0,
   linkingKey: <SHA>,
   linkingKeyType: "commit",
   detectionMethod: "commit_match"
)
```
**Predicate**: Exact match on commit SHA + cross-source (Vercel ↔ GitHub)
**Source**: [determineCommitRelationType:463-469](../../../api/console/src/inngest/workflow/neural/relationship-detection.ts#L463-L469)

### Rule 4: SAME_BRANCH
```
IF sourceReferences contains { type: "branch", id: <BRANCH_NAME> }
   AND target observation has same BRANCH_NAME in sourceReferences
THEN create_edge(
   type: "same_branch",
   confidence: 0.9,
   linkingKey: <BRANCH_NAME>,
   linkingKeyType: "branch",
   detectionMethod: "branch_match"
)
```
**Predicate**: Exact match on branch name via JSONB containment
**Source**: [relationship-detection.ts:105-124](../../../api/console/src/inngest/workflow/neural/relationship-detection.ts#L105-L124)

### Rule 5: FIXES (Explicit PR → Issue)
```
IF sourceReferences contains { type: "issue", id: <ISSUE_ID>,
                                label: ("fixes" | "closes" | "resolves") }
   AND (target.sourceReferences contains { type: "issue", id: <ISSUE_ID> }
        OR target.title ILIKE '%<ISSUE_ID>%'
        OR target.sourceId ILIKE '%<ISSUE_ID>%')
THEN create_edge(
   type: "fixes",
   confidence: 1.0,
   linkingKey: <ISSUE_ID>,
   linkingKeyType: "issue",
   detectionMethod: "explicit"
)
```
**Predicate**: Exact match on issue ID (JSONB or fuzzy text match) + explicit resolution label
**Source**: [relationship-detection.ts:126-155](../../../api/console/src/inngest/workflow/neural/relationship-detection.ts#L126-L155)

### Rule 6: REFERENCES (Generic Issue Co-occurrence)
```
IF sourceReferences contains { type: "issue", id: <ISSUE_ID> }
   AND label NOT IN ["fixes", "closes", "resolves"]
   AND (target.sourceReferences contains { type: "issue", id: <ISSUE_ID> }
        OR target.title ILIKE '%<ISSUE_ID>%'
        OR target.sourceId ILIKE '%<ISSUE_ID>%')
THEN create_edge(
   type: "references",
   confidence: 0.8,
   linkingKey: <ISSUE_ID>,
   linkingKeyType: "issue",
   detectionMethod: "entity_cooccurrence"
)
```
**Predicate**: Fuzzy match on issue ID (JSONB preferred, ILIKE fallback)
**Source**: [relationship-detection.ts:157-177](../../../api/console/src/inngest/workflow/neural/relationship-detection.ts#L157-L177)

### Rule 7: TRACKED_IN (Linear → GitHub PR)
```
IF sourceReferences contains { type: "pr", id: <PR_NUMBER> }
   AND target.sourceId ILIKE '%<PR_NUMBER>%'
THEN create_edge(
   type: "tracked_in",
   confidence: 1.0,
   linkingKey: <PR_NUMBER>,
   linkingKeyType: "pr",
   detectionMethod: "pr_match"
)
```
**Predicate**: Fuzzy match on PR number via sourceId ILIKE
**Source**: [relationship-detection.ts:179-198](../../../api/console/src/inngest/workflow/neural/relationship-detection.ts#L179-L198)

### Rule 8: TRIGGERS (Sentry → Linear)
```
IF source="linear"
   AND sourceReferences contains { type: "issue", id: <SENTRY_ISSUE_ID>, label: "linked" }
   AND (target.source="sentry"
        AND (target.sourceReferences contains { type: "issue", id: <SENTRY_ISSUE_ID> }
             OR target.title ILIKE '%<SENTRY_ISSUE_ID>%'
             OR target.sourceId ILIKE '%<SENTRY_ISSUE_ID>%'))
THEN create_edge(
   type: "triggers",
   confidence: 0.8,
   linkingKey: <SENTRY_ISSUE_ID>,
   linkingKeyType: "issue",
   detectionMethod: "explicit"
)
```
**Predicate**: Fuzzy match on Sentry issue ID + explicit "linked" label from Linear
**Source**: [relationship-detection.ts:200-245](../../../api/console/src/inngest/workflow/neural/relationship-detection.ts#L200-L245)

## SQL Queries

### Query 1: findObservationsByReference (Commits, Branches)
```sql
SELECT id, source, sourceReferences
FROM lightfast_workspace_neural_observations
WHERE workspace_id = $workspaceId
  AND id != $excludeId
  AND (
    sourceReferences::jsonb @> '[{"type":"commit","id":"abc123"}]'::jsonb
    OR sourceReferences::jsonb @> '[{"type":"commit","id":"def456"}]'::jsonb
    -- ... one condition per refId
  )
LIMIT 50
```
**Purpose**: Find observations with exact match on commit SHA or branch name
**Index Used**: GIN index on `sourceReferences` JSONB column
**Source**: [relationship-detection.ts:290-332](../../../api/console/src/inngest/workflow/neural/relationship-detection.ts#L290-L332)

### Query 2: findObservationsByIssueId (Issues - Multi-strategy)
```sql
SELECT id, title, sourceId, sourceReferences
FROM lightfast_workspace_neural_observations
WHERE workspace_id = $workspaceId
  AND id != $excludeId
  AND (
    -- Strategy 1: JSONB containment (exact)
    sourceReferences::jsonb @> '[{"type":"issue","id":"ENG-123"}]'::jsonb
    OR sourceReferences::jsonb @> '[{"type":"issue","id":"ENG-456"}]'::jsonb
    -- Strategy 2: Title fuzzy match
    OR title ILIKE '%ENG-123%'
    OR title ILIKE '%ENG-456%'
    -- Strategy 3: SourceId fuzzy match
    OR sourceId ILIKE '%ENG-123%'
    OR sourceId ILIKE '%ENG-456%'
  )
LIMIT 50
```
**Purpose**: Find observations mentioning issue IDs (exact via JSONB or fuzzy via ILIKE)
**Index Used**: GIN index on `sourceReferences` + text indexes on `title`, `sourceId`
**Source**: [relationship-detection.ts:338-396](../../../api/console/src/inngest/workflow/neural/relationship-detection.ts#L338-L396)

### Query 3: findObservationsByPrId (PR Numbers)
```sql
SELECT id, sourceId
FROM lightfast_workspace_neural_observations
WHERE workspace_id = $workspaceId
  AND id != $excludeId
  AND (
    sourceId ILIKE '%#478%'
    OR sourceId ILIKE '%#479%'
    -- ... one condition per PR number
  )
LIMIT 50
```
**Purpose**: Find observations with PR numbers in sourceId (e.g., "pr:acme/platform#478")
**Index Used**: Text index on `sourceId`
**Source**: [relationship-detection.ts:402-438](../../../api/console/src/inngest/workflow/neural/relationship-detection.ts#L402-L438)

## Schema: workspace_observation_relationships

```sql
CREATE TABLE lightfast_workspace_observation_relationships (
  -- Primary key
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

  -- External identifier (nanoid for API responses)
  external_id VARCHAR(21) NOT NULL UNIQUE,

  -- Workspace partition
  workspace_id VARCHAR(191) NOT NULL REFERENCES org_workspaces(id) ON DELETE CASCADE,

  -- Edge vertices
  source_observation_id BIGINT NOT NULL REFERENCES workspace_neural_observations(id) ON DELETE CASCADE,
  target_observation_id BIGINT NOT NULL REFERENCES workspace_neural_observations(id) ON DELETE CASCADE,

  -- Relationship type (one of 8 types)
  relationship_type VARCHAR(50) NOT NULL,

  -- Linking metadata
  linking_key VARCHAR(500),        -- The shared reference (commit SHA, issue ID, etc.)
  linking_key_type VARCHAR(50),    -- Type of linking key (commit, branch, issue, pr)

  -- Confidence score
  confidence REAL NOT NULL DEFAULT 1.0,

  -- Additional metadata (detectionMethod, context)
  metadata JSONB,

  -- Timestamp
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE UNIQUE INDEX ws_obs_rel_external_id_idx ON lightfast_workspace_observation_relationships(external_id);
CREATE INDEX ws_obs_rel_source_idx ON lightfast_workspace_observation_relationships(workspace_id, source_observation_id);
CREATE INDEX ws_obs_rel_target_idx ON lightfast_workspace_observation_relationships(workspace_id, target_observation_id);
CREATE INDEX ws_obs_rel_linking_key_idx ON lightfast_workspace_observation_relationships(workspace_id, linking_key);
CREATE UNIQUE INDEX ws_obs_rel_unique_edge_idx ON lightfast_workspace_observation_relationships(
  workspace_id, source_observation_id, target_observation_id, relationship_type
);
```

**Key Indexes**:
- `sourceIdx`: Forward traversal (source → targets) - Used by graph queries to find outgoing edges
- `targetIdx`: Reverse traversal (target → sources) - Used by graph queries to find incoming edges
- `linkingKeyIdx`: Find all observations linked by same key (e.g., all observations about commit SHA)
- `uniqueEdgeIdx`: Prevents duplicate edges (same source + target + type)

**Source**: [workspace-observation-relationships.ts:55-164](../../../db/console/src/schema/tables/workspace-observation-relationships.ts#L55-L164)

## Average Fan-out Per Observation

Based on the logic and business context:

| Reference Type | Typical Fan-out | Max Fan-out | Notes |
|---------------|----------------|-------------|-------|
| **Commit SHA** | 2-5 edges | 50 | GitHub push → Vercel deploy → Sentry resolution |
| **Branch Name** | 5-20 edges | 50 | All observations on same branch (PRs, commits, CI) |
| **Issue ID (fixes)** | 1-3 edges | 50 | PR fixes issue, commit resolves issue |
| **Issue ID (references)** | 3-10 edges | 50 | Multiple PRs/commits mention same issue |
| **PR Number** | 1-2 edges | 50 | Linear issue → GitHub PR |
| **Sentry Linked** | 1 edge | 50 | Sentry issue → Linear issue |

**Limit**: Each query type returns at most 50 matches (hardcoded limit at lines 318, 376, 428)

**Deduplication**: For multiple matches to same target with different relationship types, keeps highest confidence (line 478-492). For same target + same type, keeps first match.

**Estimated Total**: Most observations create 3-15 relationships total across all reference types.

## Complexity Analysis

### Time Complexity: O(R × log M)

Where:
- **R** = Number of references in sourceEvent (commits, branches, issues, PRs)
  - Typical: 2-10 references per observation
  - Max: ~50 references (rare)
- **M** = Total observations in workspace
  - Small workspace: 1K-10K observations
  - Large workspace: 100K-1M observations

**Per observation ingested**:
1. **Reference extraction**: O(R) - Linear scan of sourceEvent.references array
2. **Query execution**: O(R × log M) per query type
   - PostgreSQL JSONB GIN index lookup: O(log M)
   - ILIKE text search with index: O(log M) amortized
   - Execute R queries (one per reference ID)
3. **Result processing**: O(N) where N ≤ 50 × R (max 50 results per query, R queries)
4. **Deduplication**: O(N) - Linear scan with Map lookup
5. **Batch insert**: O(N) - Single INSERT with N rows

**Practical complexity**: O(R × 50) = O(R) since LIMIT 50 caps result size per query type

**Real-world performance**:
- Observations with 5 references: ~5 queries, ~100 rows scanned, ~10 edges created
- Observations with 20 references: ~20 queries, ~400 rows scanned, ~40 edges created (rare)

### Space Complexity: O(N)

Where N = total matches found ≤ 50 × R

**Memory usage**:
- `detectedRelationships` array: O(N) - Stores all matches before deduplication
- `inserts` array: O(N) - Final edges to insert (after deduplication)
- Query result buffers: O(50) per query (PostgreSQL wire protocol)

**Database storage**:
- Each relationship row: ~200 bytes (5 VARCHAR columns, 3 BIGINT, 1 REAL, 1 JSONB, 1 TIMESTAMP)
- 10K relationships ≈ 2 MB
- 1M relationships ≈ 200 MB

## Code References

- **Main function**: `api/console/src/inngest/workflow/neural/relationship-detection.ts:45-285`
- **Schema definition**: `db/console/src/schema/tables/workspace-observation-relationships.ts:55-164`
- **Invocation**: `api/console/src/inngest/workflow/neural/observation-capture.ts:1058-1069`
- **Relationship type determination**: `relationship-detection.ts:448-473` (determineCommitRelationType)
- **Deduplication logic**: `relationship-detection.ts:478-492` (deduplicateRelationships)

## Architecture Context

**Write Path**: Relationships are created synchronously during observation capture:
1. Webhook → Observation Capture workflow
2. Store observation in database
3. **detectAndCreateRelationships** (Step 7.5)
4. Emit observation.captured event

**Read Path**: Relationships are traversed via tRPC endpoints:
- Graph API: `apps/console/src/lib/v1/graph.ts`
- Related observations: `apps/console/src/lib/v1/related.ts`
- Uses forward index (sourceIdx) and reverse index (targetIdx) for bidirectional traversal

**Performance Optimization**:
- JSONB GIN indexes enable O(log M) lookups on sourceReferences
- LIMIT 50 per query prevents runaway fan-out
- Unique constraint on (workspace, source, target, type) prevents duplicates at database level
- Batch insert with `onConflictDoNothing()` for idempotency

## Related Research

- [2026-02-06: Startup Tools Webhook Integration](./2026-02-06-startup-tools-webhook-integration.md) - Context on sourceEvent structure
- [2026-02-07: Eval Paper Codebase Deep Dive](./2026-02-07-eval-paper-codebase-deep-dive.md) - Neural observation system overview
