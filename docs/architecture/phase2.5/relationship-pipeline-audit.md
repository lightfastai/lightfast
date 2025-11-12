# Relationship Pipeline Audit & Design

**Status:** Analysis
**Date:** 2025-11-12
**Goal:** Evaluate current relationship extraction and design robust pipeline

---

## Executive Summary

**Current State:** Basic regex-based relationship extraction runs inline during document ingestion. Only processes new documents (LIFO bias).

**Key Problems:**
1. **LIFO bias** - Old documents lack relationships with newer content
2. **No bidirectional updates** - When A references B, B doesn't know about A
3. **Regex-only** - Misses semantic relationships and implicit references
4. **No confidence scoring** - All relationships treated equally
5. **No backfill mechanism** - No way to retroactively build relationships

**Recommendation:** Implement a **multi-stage relationship pipeline** with:
- Deterministic extraction (current, improved)
- Bidirectional relationship building
- Backfill and reprocessing capabilities
- LLM-assisted semantic extraction (Phase 2)
- Confidence scoring and evidence tracking

---

## Current Implementation Analysis

### What Exists (api/console/src/inngest/workflow/shared/extract-relationships.ts:1-377)

**Workflow:** `extractRelationships` - Inngest function that:
1. Receives document after ingestion
2. Parses content with source-specific regex patterns
3. Extracts relationships (e.g., "Closes LIN-123", PR URLs)
4. Stores in document's `relationships` JSONB field

**Source Parsers:**
- `parseGitHubRelationships` - Extracts Linear issue refs, GitHub issue refs
- `parseLinearRelationships` - Extracts GitHub PR URLs
- `parseNotionRelationships` - Extracts GitHub/Linear URLs
- `parseSentryRelationships` - Extracts commit SHAs
- `parseVercelRelationships` - Extracts commit SHA, PR number
- `parseZendeskRelationships` - Extracts GitHub issue URLs

**Relationship Types:**
- `resolves` - GitHub PR resolves Linear/GitHub issue
- `references` - Generic mention
- `duplicates` - Sentry issue duplicates another
- `depends_on` - Document depends on another
- `child_of` - Hierarchical relationship
- `deployed_by` - Vercel deployment by GitHub commit

**Storage:**
```typescript
// Stored in docsDocuments.relationships JSONB:
{
  extracted: Relationship[],
  extractedAt: string
}
```

### Critical Problems

#### 1. LIFO Bias (Last In, First Out)

**Problem:** Only newly ingested documents get relationships extracted.

**Example Scenario:**
- Day 1: Ingest 100 GitHub PRs (no Linear issues yet → no relationships)
- Day 2: Ingest 50 Linear issues referencing those PRs
- Result: Linear issues have relationships TO PRs, but PRs don't know they're referenced

**Impact:**
- Graph is unidirectional and incomplete
- Old documents appear "disconnected" in queries
- Search/retrieval can't leverage full relationship graph

#### 2. No Bidirectional Updates

**Problem:** Relationships are unidirectional.

**Example:**
```
Document A (PR): "Closes LIN-123"
  → relationships: { type: "resolves", targetId: "LIN-123" }

Document B (LIN-123): <no mention of PR>
  → relationships: {} ❌ Should know it's resolved by PR!
```

**Impact:**
- Can't answer "what PRs resolved this issue?"
- Can't show "resolved by" in UI
- Graph traversal is one-way only

#### 3. Regex-Only Extraction

**Problem:** Current extraction is pattern-based only.

**Misses:**
- Implicit references: "Fixed the auth bug" (no ticket number)
- Semantic relationships: "Similar to the problem in..."
- Cross-doc patterns: "As discussed in yesterday's meeting..."
- Natural language: "This addresses the issue mentioned by @user"

**Example:**
```markdown
# PR Description
Fixed the authentication timeout issue that was causing production errors.
The root cause was incorrect session management in the auth middleware.

Related to the discussion in https://linear.app/team/issue/AUTH-456
and the Sentry error from last week.
```

**Current extraction:** Finds Linear URL only
**Misses:** Sentry relationship, semantic connection to "session management" docs

#### 4. No Evidence Tracking

**Problem:** No record of WHERE in the document the relationship was found.

**Architecture requires** (from docs/architecture/memory/graph.md:166-173):
```typescript
RELATIONSHIP_EVIDENCE {
  relationshipId: string;
  documentId: string;
  chunkId: string;      // Which chunk contains the reference
  observationId: string;
  weight: number;
}
```

**Current implementation:** None of this exists.

**Impact:**
- Can't show users "why" relationships exist
- Can't rank relationships by evidence strength
- Can't debug false positives
- Can't build "rationale" for graph queries

#### 5. No Confidence Scoring

**Problem:** All extracted relationships treated equally.

**Should have:**
- Deterministic (regex match): confidence = 1.0
- LLM-assisted: confidence = 0.6-0.95
- Manual: confidence = 1.0

**Impact:**
- Can't filter low-quality relationships
- Can't prioritize in UI/search
- Can't build quality metrics

---

## Architecture Vision (From Docs)

From `docs/architecture/memory/graph.md` and `docs/architecture/memory/spec.md`:

### Target Schema

**Tables:**
1. `entities` - Canonical entities (person, repo, PR, issue, doc)
2. `entity_aliases` - Alternative names/IDs for entities
3. `document_entities` - Which entities appear in which documents
4. `relationships` - Typed edges between entities
5. `relationship_evidence` - Supporting evidence for relationships

**Current implementation uses:** `docsDocuments.relationships` JSONB only ❌

### Relationship Extraction Phases

**Phase 0** (Current): Schema + deterministic edges
**Phase 1**: Redis adjacency + rationale surfaces
**Phase 2**: LLM-assisted proposals + adjudication
**Phase 3**: Graph-aware bias in retrieval
**Phase 4**: Quality loop + drift/alerting

**Current status:** Partially in Phase 0 (no schema tables, just JSONB)

### Quality Targets

From `docs/architecture/memory/spec.md:20-36`:
- Deterministic relationships: **≥95% precision**
- LLM-assisted relationships: **≥85% precision** (after review)
- Evidence sufficiency score: **≥0.9**
- Graph-influenced answers include rationale: **100%**

---

## Proposed Pipeline Design

### High-Level Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    DOCUMENT INGESTION                            │
│  (processDocuments workflow - api/console/src/inngest/...)      │
└─────────────────────────────────────────────────────────────────┘
                               ↓
┌─────────────────────────────────────────────────────────────────┐
│              STAGE 1: Deterministic Extraction                   │
│  • Regex patterns (GitHub PR #, Linear issues, URLs)            │
│  • Confidence: 1.0                                               │
│  • Fast, inline during ingestion                                 │
│  • Output: Forward relationships only                            │
└─────────────────────────────────────────────────────────────────┘
                               ↓
┌─────────────────────────────────────────────────────────────────┐
│              STAGE 2: Bidirectional Building                     │
│  • For each extracted relationship A→B:                          │
│    - Enqueue bidirectional update job                            │
│    - Update document B with reverse relationship B←A            │
│  • Batched, async                                                │
│  • Output: Bidirectional graph                                   │
└─────────────────────────────────────────────────────────────────┘
                               ↓
┌─────────────────────────────────────────────────────────────────┐
│              STAGE 3: Entity Resolution                          │
│  • Extract entities from relationships                           │
│  • Resolve to canonical entities (deduplication)                 │
│  • Build entity graph (person→PR, PR→issue, etc.)               │
│  • Store in entities/relationships tables (when implemented)     │
└─────────────────────────────────────────────────────────────────┘
                               ↓
┌─────────────────────────────────────────────────────────────────┐
│         STAGE 4: LLM-Assisted Extraction (Phase 2)              │
│  • Semantic relationship detection                               │
│  • Confidence scoring (0.6-0.95)                                 │
│  • Evidence tracking (chunk IDs)                                 │
│  • Adjudication queue for low confidence (0.6-0.8)              │
│  • Never overwrite deterministic relationships                   │
└─────────────────────────────────────────────────────────────────┘
                               ↓
┌─────────────────────────────────────────────────────────────────┐
│                  STAGE 5: Backfill Pipeline                      │
│  • Periodic job to reprocess old documents                       │
│  • Triggered on:                                                 │
│    - New document types ingested (e.g., first Linear issue)     │
│    - Relationship extractors updated                             │
│    - Manual backfill requests                                    │
│  • Rate-limited, low priority                                    │
└─────────────────────────────────────────────────────────────────┘
```

### Detailed Stage Design

#### Stage 1: Deterministic Extraction (Current, Enhanced)

**When:** Inline during document ingestion

**Extractors:**
```typescript
// Enhanced version of current parseXRelationships
interface DeterministicRelationship {
  type: RelationType;
  sourceType: string;
  sourceId: string;
  targetType: string;
  targetId: string;
  confidence: 1.0; // Always 1.0 for deterministic
  chunkIndex?: number; // NEW: Which chunk had the match
  evidence: {
    pattern: string; // NEW: Which regex matched
    matchedText: string; // NEW: Actual text matched
  };
}
```

**Improvements:**
1. Track which chunk contained the match
2. Record the matched text (for evidence)
3. Extract line/position info
4. Support more patterns (e.g., "Fixes #123", "Related to...")

**Example:**
```typescript
// Input (GitHub PR body, chunk 2):
"Closes LIN-123 and fixes the auth timeout"

// Output:
{
  type: "resolves",
  sourceType: "github",
  sourceId: "lightfastai/lightfast/pull/456",
  targetType: "linear",
  targetId: "LIN-123",
  confidence: 1.0,
  chunkIndex: 2,
  evidence: {
    pattern: "Closes (LIN-\\d+)",
    matchedText: "Closes LIN-123"
  }
}
```

#### Stage 2: Bidirectional Building (NEW)

**When:** Async, immediately after Stage 1

**Workflow:** `buildBidirectionalRelationships`

```typescript
export const buildBidirectionalRelationships = inngest.createFunction(
  {
    id: "apps-console/build-bidirectional-relationships",
    name: "Build Bidirectional Relationships",
    retries: 3,
    concurrency: { limit: 10, key: "event.data.workspaceId" },
  },
  { event: "apps-console/relationships.extracted" },
  async ({ event, step }) => {
    const { documentId, relationships } = event.data;

    // For each relationship A→B, create reverse B→A
    await step.run("create-reverse-relationships", async () => {
      for (const rel of relationships) {
        // Find target document
        const targetDoc = await findDocumentBySourceId(
          rel.targetType,
          rel.targetId
        );

        if (!targetDoc) {
          // Target doesn't exist yet - store as pending
          await storePendingRelationship(rel);
          continue;
        }

        // Add reverse relationship to target document
        await addReverseRelationship(targetDoc.id, {
          type: getReverseType(rel.type), // resolves → resolved_by
          sourceType: rel.targetType,
          sourceId: rel.targetId,
          targetType: rel.sourceType,
          targetId: rel.sourceId,
          confidence: rel.confidence,
          evidence: rel.evidence,
        });
      }
    });

    // Process any pending relationships for this document
    await step.run("process-pending", async () => {
      const pending = await getPendingRelationships(documentId);
      for (const rel of pending) {
        await addReverseRelationship(documentId, rel);
        await deletePendingRelationship(rel.id);
      }
    });
  }
);
```

**Example:**
```
Initial state:
  PR#456: { relationships: [{ type: "resolves", target: "LIN-123" }] }
  LIN-123: { relationships: [] }

After bidirectional building:
  PR#456: { relationships: [{ type: "resolves", target: "LIN-123" }] }
  LIN-123: { relationships: [{ type: "resolved_by", target: "PR#456" }] }
```

**Benefits:**
- Enables "what PRs resolved this issue?" queries
- Supports graph traversal in both directions
- Powers UI features like "Related PRs", "Resolved by"

#### Stage 3: Entity Resolution (Phase 1)

**When:** After bidirectional building, batched

**Workflow:** `resolveEntities`

**Goal:** Build canonical entity graph from relationships

```typescript
// Extract entities from relationships
const entities = extractEntities(relationships);
// Example: { type: "pull_request", id: "456", repo: "lightfastai/lightfast" }
//          { type: "linear_issue", id: "LIN-123", team: "ENG" }

// Resolve to canonical entities
const canonicalEntities = await resolveToCanonical(entities);
// Deduplication: PR "456" = entity_xyz
//                 PR "#456" = entity_xyz (same)
//                 "https://github.com/.../456" = entity_xyz (same)

// Store in entities table (Phase 1)
await upsertEntities(canonicalEntities);
await upsertRelationships(relationships, canonicalEntities);
```

**Schema Migration (Phase 1):**
```sql
-- From docs/architecture/data-model.md
CREATE TABLE entities (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  kind TEXT NOT NULL, -- 'repo', 'pull_request', 'issue', 'person', etc.
  name TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE relationships (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  type TEXT NOT NULL, -- 'RESOLVES', 'REFERENCES', etc.
  from_id TEXT NOT NULL REFERENCES entities(id),
  to_id TEXT NOT NULL REFERENCES entities(id),
  confidence REAL NOT NULL,
  since TIMESTAMP,
  until TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE relationship_evidence (
  id TEXT PRIMARY KEY,
  relationship_id TEXT NOT NULL REFERENCES relationships(id),
  document_id TEXT REFERENCES docs_documents(id),
  chunk_id TEXT REFERENCES docs_chunks(id),
  observation_id TEXT,
  weight REAL NOT NULL DEFAULT 1.0
);
```

#### Stage 4: LLM-Assisted Extraction (Phase 2)

**When:** After entity resolution, batched

**Workflow:** `extractSemanticRelationships`

```typescript
export const extractSemanticRelationships = inngest.createFunction(
  {
    id: "apps-console/extract-semantic-relationships",
    name: "Extract Semantic Relationships (LLM)",
    retries: 2,
    concurrency: { limit: 5, key: "event.data.workspaceId" },
  },
  { event: "apps-console/documents.semantic-extraction-requested" },
  async ({ event, step }) => {
    const { documentId, chunkIds } = event.data;

    const proposals = await step.run("llm-extraction", async () => {
      const chunks = await getChunks(chunkIds);
      const context = await getRelatedDocuments(documentId); // Vector search

      // Prompt LLM to extract relationships
      const response = await callLLM({
        model: "claude-3-5-sonnet-20241022",
        prompt: buildRelationshipExtractionPrompt(chunks, context),
      });

      return parseRelationshipProposals(response);
    });

    // Gate proposals by confidence
    await step.run("gate-proposals", async () => {
      for (const proposal of proposals) {
        if (proposal.confidence >= 0.8) {
          // High confidence - auto-accept
          await upsertRelationship(proposal);
        } else if (proposal.confidence >= 0.6) {
          // Medium confidence - send to adjudication queue
          await enqueueAdjudication(proposal);
        } else {
          // Low confidence - discard
          await logDiscardedProposal(proposal);
        }
      }
    });
  }
);
```

**LLM Prompt Example:**
```
You are an expert at extracting relationships between documents.

Given this document:
---
[Document content]
---

And these related documents:
---
[Context documents]
---

Extract semantic relationships:
1. Type: REFERENCES | RESOLVES | DEPENDS_ON | RELATES_TO | IMPLEMENTS
2. Target: Which document/entity is referenced?
3. Evidence: Quote the exact text
4. Confidence: 0.0-1.0

Output JSON:
[
  {
    "type": "RELATES_TO",
    "target": { "type": "document", "id": "doc_xyz" },
    "evidence": "Similar to the issue in...",
    "confidence": 0.85,
    "reasoning": "The description mentions a similar problem pattern"
  }
]
```

**Guardrails:**
- Never overwrite deterministic relationships (confidence=1.0)
- Require evidence field (must quote source text)
- Require reasoning field (for auditing)
- Confidence thresholds configurable per workspace

#### Stage 5: Backfill Pipeline (NEW)

**When:**
- Triggered on new source type ingestion
- Manual backfill requests
- Periodic reprocessing (weekly?)

**Workflow:** `backfillRelationships`

```typescript
export const backfillRelationships = inngest.createFunction(
  {
    id: "apps-console/backfill-relationships",
    name: "Backfill Relationships",
    retries: 3,
    concurrency: { limit: 5, key: "event.data.workspaceId" },
  },
  { event: "apps-console/relationships.backfill-requested" },
  async ({ event, step }) => {
    const { workspaceId, sourceTypes, reason } = event.data;

    // Get all documents that need reprocessing
    const documents = await step.run("find-documents", async () => {
      return await db
        .select({ id: docsDocuments.id })
        .from(docsDocuments)
        .where(
          and(
            eq(docsDocuments.storeId, workspaceId),
            inArray(docsDocuments.sourceType, sourceTypes),
            or(
              // Never processed
              isNull(docsDocuments.relationships),
              // Processed before cutoff
              lt(
                sql`(relationships->>'extractedAt')::timestamp`,
                cutoffDate
              )
            )
          )
        );
    });

    // Reprocess in batches
    await step.run("reprocess-batches", async () => {
      const batchSize = 100;
      for (let i = 0; i < documents.length; i += batchSize) {
        const batch = documents.slice(i, i + batchSize);

        // Emit extraction events for each document
        await inngest.send(
          batch.map((doc) => ({
            name: "apps-console/relationships.extract",
            data: {
              documentId: doc.id,
              reason: "backfill",
            },
          }))
        );

        // Rate limit: wait between batches
        await sleep(5000); // 5s between batches
      }
    });

    return {
      status: "completed",
      documentsProcessed: documents.length,
      reason,
    };
  }
);
```

**Trigger Scenarios:**

**Scenario 1: New Source Type**
```
Event: First Linear issue ingested
Trigger: Backfill all GitHub PRs (to find "Closes LIN-X" that we missed)
```

**Scenario 2: Extractor Updates**
```
Event: New relationship pattern added (e.g., "Implements SPEC-123")
Trigger: Backfill recent PRs (last 30 days) with new pattern
```

**Scenario 3: Manual Request**
```
Event: User reports missing relationships
Trigger: Backfill specific repository or time range
```

---

## Data Flow Examples

### Example 1: GitHub PR → Linear Issue

**Step 1: Ingest PR**
```
Document: PR#456
Content: "Closes LIN-123\n\nFixed the auth timeout bug."
```

**Step 2: Extract (deterministic)**
```json
{
  "type": "resolves",
  "sourceType": "github",
  "sourceId": "lightfastai/lightfast/pull/456",
  "targetType": "linear",
  "targetId": "LIN-123",
  "confidence": 1.0,
  "chunkIndex": 0,
  "evidence": {
    "pattern": "Closes (LIN-\\d+)",
    "matchedText": "Closes LIN-123"
  }
}
```

**Step 3: Build bidirectional**
```
PR#456.relationships += { type: "resolves", target: "LIN-123" }
LIN-123.relationships += { type: "resolved_by", target: "PR#456" }
```

**Step 4: Entity resolution**
```
Entity: pull_request/github/lightfastai/lightfast/456
Entity: linear_issue/LIN-123
Relationship: (PR#456) --[RESOLVES]--> (LIN-123)
Evidence: document_id=PR#456, chunk_id=chunk_0, weight=1.0
```

### Example 2: Backfill Scenario

**Initial State (Day 1):**
```
PR#100: { relationships: [] }  // Ingested before Linear connected
PR#101: { relationships: [] }
PR#102: { relationships: [] }
```

**Day 2: Connect Linear, ingest issues**
```
LIN-50: { relationships: [{ type: "resolved_by", target: "PR#100" }] }
```

**Problem:** PR#100 doesn't know it resolves LIN-50!

**Solution: Trigger backfill**
```javascript
await inngest.send({
  name: "apps-console/relationships.backfill-requested",
  data: {
    workspaceId: "ws_abc",
    sourceTypes: ["github"],
    reason: "linear_first_connected",
  },
});
```

**Result:**
```
PR#100: { relationships: [{ type: "resolves", target: "LIN-50" }] }
PR#101: { relationships: [] } // No Linear refs found
PR#102: { relationships: [{ type: "resolves", target: "LIN-51" }] }
```

---

## Implementation Roadmap

### Phase 0: Schema Migration (Week 1)

**Goal:** Implement proper relationship schema

**Tasks:**
- [ ] Create migration for `entities`, `relationships`, `relationship_evidence` tables
- [ ] Update `docsDocuments` to reference entities
- [ ] Add indexes for relationship queries
- [ ] Migrate existing JSONB relationships to new schema (if any)

**Acceptance:**
- Schema matches `docs/architecture/data-model.md:130-173`
- All tables have proper indexes
- RLS policies for workspace isolation

### Phase 1: Enhanced Deterministic Extraction (Week 2)

**Goal:** Improve current extraction with evidence tracking

**Tasks:**
- [ ] Add chunk-level tracking to extraction
- [ ] Record matched text and patterns
- [ ] Store in relationship_evidence table
- [ ] Update all parse functions with evidence

**Acceptance:**
- All extracted relationships have evidence
- Can query "show me proof of this relationship"
- Precision ≥95% on test set

### Phase 2: Bidirectional Building (Week 3)

**Goal:** Eliminate LIFO bias with reverse relationships

**Tasks:**
- [ ] Implement `buildBidirectionalRelationships` workflow
- [ ] Create pending relationships table (for unresolved targets)
- [ ] Add reverse relationship types mapping
- [ ] Emit events after extraction to trigger bidirectional

**Acceptance:**
- Every relationship A→B has reverse B→A
- Pending relationships processed when targets arrive
- Can query relationships in both directions

### Phase 3: Backfill Pipeline (Week 4)

**Goal:** Fix historical data with missing relationships

**Tasks:**
- [ ] Implement `backfillRelationships` workflow
- [ ] Add backfill triggers (new source, extractor update)
- [ ] Rate limiting and batching
- [ ] Monitoring dashboard for backfill progress

**Acceptance:**
- Can reprocess documents without duplication
- Backfill completes within SLA (e.g., 10k docs in 1 hour)
- No impact on ingestion performance

### Phase 4: Entity Resolution (Week 5-6)

**Goal:** Build canonical entity graph

**Tasks:**
- [ ] Entity extraction from relationships
- [ ] Deduplication logic (same entity, different IDs)
- [ ] Entity aliases table population
- [ ] Entity-centric queries

**Acceptance:**
- Entities deduplicated correctly (PR "456" = PR "#456")
- Can query "all PRs by person X"
- Can query "all issues for repo Y"

### Phase 5: LLM-Assisted Extraction (Week 7-8)

**Goal:** Semantic relationship extraction

**Tasks:**
- [ ] LLM prompt design and testing
- [ ] Confidence gating (auto-accept ≥0.8, queue 0.6-0.8)
- [ ] Adjudication queue UI
- [ ] Never overwrite deterministic relationships

**Acceptance:**
- LLM proposals precision ≥85% (after review)
- Deterministic relationships never modified
- Adjudication queue functional

---

## Evaluation Criteria

### Relationship Quality Metrics

**Precision:** (True Positives) / (True Positives + False Positives)
- Target: ≥95% deterministic, ≥85% LLM-assisted

**Recall:** (True Positives) / (True Positives + False Negatives)
- Target: ≥90% deterministic, ≥80% LLM-assisted

**Evidence Faithfulness:** % of relationships with valid evidence
- Target: 100% deterministic, ≥90% LLM-assisted

### Pipeline Health Metrics

**LIFO Bias Score:** % of documents missing expected relationships
- Target: <5%

**Bidirectional Coverage:** % of forward relationships with reverse
- Target: ≥99%

**Backfill Lag:** Time to complete backfill after trigger
- Target: <24 hours

**Processing Latency:** Time from document ingest to relationships extracted
- Target: P95 <10 seconds (deterministic), <60 seconds (full pipeline)

### Test Sets

**Gold Set 1: GitHub PR → Linear Issue**
- 100 PRs with "Closes LIN-X" patterns
- Manual verification of relationships
- Test: Precision, recall, evidence quality

**Gold Set 2: Bidirectional Completeness**
- 50 PRs, 50 Linear issues with cross-references
- Test: All relationships bidirectional?

**Gold Set 3: Backfill Scenarios**
- Ingest 100 PRs, then 50 Linear issues
- Trigger backfill
- Test: PRs updated with Linear relationships?

**Gold Set 4: Semantic Relationships (Phase 2)**
- 100 documents with implicit references
- LLM extractions vs human labels
- Test: Precision, recall, confidence calibration

---

## Open Questions

### Technical

1. **Storage:** Use JSONB in `docsDocuments` or dedicated `relationships` table?
   - **Recommendation:** Dedicated table (matches architecture docs)
   - **Reasoning:** Better queries, indexes, evidence tracking

2. **Entity resolution:** How to handle ambiguous entities?
   - Example: "PR #123" - which repo?
   - **Recommendation:** Require context (repo name) or use aliases

3. **Backfill strategy:** Reprocess all or incremental?
   - **Recommendation:** Incremental with cutoff date
   - **Reasoning:** Avoids duplicate work, faster

4. **LLM costs:** How many documents to process with LLM?
   - **Recommendation:** Start with high-value docs (PRs, specs)
   - **Reasoning:** Budget control, focus on impact

### Product

1. **UI:** Show relationships in document view?
   - **Recommendation:** Yes - "Related" section with evidence links

2. **Search:** Boost related documents in results?
   - **Recommendation:** Yes - graph-aware ranking (Phase 3)

3. **Notifications:** Alert on new relationships?
   - **Recommendation:** Phase 2 - "PR #456 was mentioned in LIN-789"

### Operational

1. **Monitoring:** What alerts to set up?
   - Relationship extraction failures
   - Backfill queue depth
   - LIFO bias score increase
   - Evidence missing rate

2. **Rollback:** How to revert bad extractions?
   - **Recommendation:** Version relationships, keep history

---

## References

- `docs/architecture/memory/graph.md` - Graph rationale and signals
- `docs/architecture/memory/spec.md` - Neural memory system spec
- `docs/architecture/data-model.md` - ERD and schema
- `docs/architecture/ingestion/sync-design.md` - Ingestion pipeline
- `api/console/src/inngest/workflow/shared/extract-relationships.ts` - Current implementation

---

## Next Steps

1. **Review this document** with team
2. **Prioritize phases** based on product needs
3. **Create GitHub issues** for each phase
4. **Start with Phase 0** (schema migration)
5. **Build test sets** for evaluation

**Estimated Timeline:** 8 weeks for Phases 0-4, +2 weeks for Phase 5 (LLM)
