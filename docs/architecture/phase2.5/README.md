# Phase 2.5: Relationship Extraction & Graph

**Status:** Planning
**Date:** 2025-11-12
**Goal:** Build comprehensive relationship extraction system with cross-source entity resolution

---

## What is Phase 2.5?

Phase 2.5 builds on Phase 2's multi-source ingestion (GitHub PRs/issues/commits, Linear, Notion, Sentry, Vercel, Zendesk) to **extract and link relationships between documents across sources**.

**Key Principle:** You can't extract relationships without proper entities. Phase 2.5 comes after we have:
- ✅ GitHub PRs, issues, commits as first-class documents (Phase 2)
- ✅ Linear issues, Notion pages, Sentry errors, etc. (Phase 2)
- ✅ Multi-source infrastructure complete (Phase 1.5)

---

## Phase Breakdown

### Phase 1: Core Infrastructure
- Next.js apps (www, console, docs, chat, auth)
- Database schema (PlanetScale)
- Vector storage (Pinecone)
- Basic document ingestion

### Phase 1.5: Multi-Source Infrastructure (CURRENT)
**Goal:** Generic multi-source document system

**What we're building NOW:**
- ✅ Source-agnostic document schema (`sourceType`, `sourceId`, `sourceMetadata`)
- ✅ Generic ingestion workflows (`process-documents.ts`, `delete-documents.ts`)
- ✅ GitHub adapter (files only for now)
- ✅ Multi-source connection tracking (`lightfast_connected_sources`)
- ✅ Event tracking (`lightfast_ingestion_events`)

**What's NOT in 1.5:**
- ❌ GitHub PRs/issues/commits ingestion → Phase 2
- ❌ Relationship extraction → Phase 2.5
- ❌ Entity resolution → Phase 2.5

### Phase 2: Multi-Source Document Ingestion
**Goal:** Ingest documents from all sources

**Documents to ingest:**
- **GitHub:**
  - Pull requests (metadata, reviews, linked issues)
  - Issues (metadata, comments)
  - Commits (metadata, file changes)
  - Files (already done in 1.5)

- **Linear:**
  - Issues/tickets
  - Comments
  - Projects

- **Notion:**
  - Pages
  - Databases
  - Blocks

- **Sentry:**
  - Errors/issues
  - Releases

- **Vercel:**
  - Deployments
  - Build logs

- **Zendesk:**
  - Tickets
  - Comments

**Deliverables:**
- Webhook handlers for each source
- API adapters for each source
- Document type discrimination (`documentType: "pull_request" | "issue" | "file" | ...`)
- Full source metadata in JSONB

### Phase 2.5: Relationship Extraction (THIS PHASE)
**Goal:** Extract and link relationships between documents

**Components:**

#### 1. Schema Migration
- `entities` table (people, repos, services, etc.)
- `entity_aliases` table (cross-source identity mapping)
- `relationships` table (typed edges between entities)
- `relationship_evidence` table (evidence for each relationship)
- `pending_relationships` table (unresolved cross-source refs)

#### 2. Deterministic Extraction (API + Regex)
- GitHub PR → author, assignees, reviewers (from API)
- GitHub PR → linked issues, changed files (from API)
- Linear → GitHub PR links (from API)
- URL extraction (full URLs with domains)
- Pattern matching ("Closes LIN-123", "#456", commit SHAs)

**Target:** 80-90% of relationships, 95%+ precision

#### 3. Entity Resolution
- Person identity across sources (GitHub @alice = Linear alice@company.com)
- Artifact identity (LIN-123 string → actual Linear issue document)
- Canonical entity graph
- Alias management

#### 4. Bidirectional Relationships
- For every A→B, create B→A
- Pending relationships for unresolved targets
- Backfill when new sources connected

#### 5. Semantic Extraction (Vector + LLM)
- Vector search for relationship candidates
- LLM evaluation with confidence scoring
- Confidence gating (≥0.80 auto, 0.60-0.79 review, <0.60 discard)
- Evidence tracking and reasoning

**Target:** Additional 10-20% of relationships, 80-85% precision

#### 6. Backfill Pipeline
- Trigger on new source connection
- Trigger on extractor updates
- Rate-limited, batched reprocessing
- Manual trigger capability

### Phase 3: Retrieval & Search
**Goal:** Graph-aware search and retrieval

- Graph bias in vector search
- Short-hop traversal (1-2 hops)
- Rationale generation
- Router modes (knowledge | neural | hybrid)

---

## Phase 2.5 Deliverables

### Week 1-2: Schema & Foundation
1. **Database schema migration**
   - Create `entities`, `entity_aliases`, `relationships`, `relationship_evidence`, `pending_relationships` tables
   - Add indexes for graph queries
   - RLS policies for workspace isolation

2. **Basic entity resolution**
   - Person identity resolution by email
   - Document resolution by sourceType + sourceId
   - Alias management functions

### Week 3-4: Deterministic Extraction
3. **API-based extraction**
   - GitHub PR relationships (author, assignees, reviewers, linked issues, files)
   - GitHub issue relationships
   - Linear relationships (from API attachments)
   - CODEOWNERS parsing for ownership

4. **Pattern-based extraction**
   - URL extraction (full URLs with domains)
   - Ticket ID patterns (LIN-123, TEAM-456)
   - Commit SHA patterns
   - Evidence tracking (matched text, position)

### Week 5-6: Bidirectional & Backfill
5. **Bidirectional relationship building**
   - Auto-create reverse relationships
   - Pending relationships for unresolved targets
   - Resolution when target appears

6. **Backfill pipeline**
   - Trigger on new source connection
   - Batched reprocessing
   - Progress tracking
   - Manual trigger endpoints

### Week 7-8: Semantic Extraction (LLM)
7. **Vector search integration**
   - Candidate finding for relationship discovery
   - Similarity thresholds and filtering

8. **LLM evaluation**
   - Prompt design and optimization
   - Confidence gating
   - Evidence extraction
   - Adjudication queue for medium confidence

### Week 9-10: Production Ready
9. **Testing & Evaluation**
   - Build test sets (GitHub↔Linear, Notion→GitHub, Zendesk→Code)
   - Measure precision/recall
   - Calibrate confidence thresholds

10. **Monitoring & Optimization**
    - Cost monitoring ($0.02-0.08 per document)
    - Quality metrics (precision, recall, resolution rate)
    - Performance optimization
    - Prompt caching and batching

---

## Success Criteria

### Relationship Quality
- **Deterministic precision:** ≥95%
- **LLM precision:** ≥85% (after review)
- **Recall:** ≥85% overall
- **Evidence quality:** 100% have valid evidence

### Pipeline Health
- **Pending resolution rate:** ≥95% within 24h
- **Bidirectional coverage:** ≥99%
- **Processing latency:** P95 <10s deterministic, <60s semantic
- **Cost:** <$0.05 per document

### Cross-Source Integration
- **Person identity accuracy:** ≥98%
- **Entity resolution accuracy:** ≥95%
- **LIFO bias:** <5% of documents missing expected relationships

---

## Dependencies

**Requires from Phase 2:**
- GitHub PRs, issues, commits as documents
- Linear issues as documents
- Notion pages as documents
- Sentry errors as documents
- Full source metadata available

**Blocks Phase 3:**
- Graph-aware retrieval needs relationship data
- Rationale generation needs relationship evidence
- Short-hop traversal needs bidirectional graph

---

## Architecture Documents

Detailed designs moved to Phase 2.5:
- `relationship-pipeline-audit.md` - Full pipeline design
- `relationship-reality-check.md` - Why we need GitHub entities, not just files
- `cross-source-relationships.md` - Cross-source extraction strategies
- `semantic-relationship-extraction.md` - Vector search + LLM approach
- `llm-cost-analysis.md` - Cost estimation and optimization

---

## What Changes in Phase 1.5?

**Phase 1.5 stays focused on infrastructure only:**

**KEEP in Phase 1.5:**
- ✅ Multi-source document schema
- ✅ Generic workflows (process/delete documents)
- ✅ GitHub file ingestion (current)
- ✅ Source connection tracking
- ✅ Event tracking

**REMOVE from Phase 1.5:**
- ❌ `extract-relationships.ts` workflow (move to 2.5 or deprecate)
- ❌ Relationship extraction during ingestion (too early)
- ❌ Cross-source reference parsing (need entities first)

**Phase 1.5 goal:** Prove the multi-source infrastructure works with GitHub files. Don't try to extract relationships yet.

---

## Migration Path

### Current State (Phase 1.5)
```
GitHub Webhook (push)
  ↓
docsIngestion (filter files)
  ↓
githubProcessAdapter (fetch file content)
  ↓
processDocuments (chunk, embed, store)
  ↓
[extractRelationships - currently exists but limited value]
```

### Phase 2: Add Entity Ingestion
```
GitHub Webhook (PR/issue/push)
  ↓
GitHub PR/Issue/Commit Ingestion
  ↓
Store as documents with full metadata
  ↓
[No relationships yet]
```

### Phase 2.5: Add Relationship Extraction
```
Document Ingested
  ↓
Deterministic Extraction (API + Regex)
  ↓
Entity Resolution
  ↓
Bidirectional Building
  ↓
Semantic Extraction (Vector + LLM, async)
  ↓
Backfill (when needed)
```

---

## Key Insights from Investigation

### 1. Can't Extract Without Entities
**Problem:** Current implementation only ingests GitHub files, not PRs/issues/commits.
**Impact:** Regex on file content finds almost nothing useful.
**Solution:** Phase 2 ingests GitHub PRs/issues as documents, THEN Phase 2.5 extracts relationships.

### 2. API > Regex > LLM (Priority Order)
**90% of relationships:** API fields (author, assignees, linked issues)
**10% additional:** Regex patterns (URLs, ticket IDs)
**10% additional:** LLM semantic matching

**Total: ~90% recall** (some overlap between methods)

### 3. Cross-Source Needs Pending Resolution
**Problem:** PR mentions "LIN-123" but Linear not connected yet.
**Solution:** Store as pending, resolve when Linear ingested, create bidirectional.

### 4. LLM Enables Valuable Semantics
**Use case:** Zendesk ticket → find buggy code (no explicit reference)
**Method:** Vector search for candidates + LLM evaluation
**Cost:** $0.02-0.08 per document
**Value:** Finds relationships impossible with regex

### 5. Bidirectional is Non-Negotiable
**Every relationship needs reverse:**
- PR → RESOLVES → Issue
- Issue → RESOLVED_BY → PR

**Enables:** Graph traversal in both directions, "what PRs fixed this issue?" queries

---

## Next Steps

1. **Complete Phase 1.5** (multi-source infrastructure)
   - Finish testing GitHub file ingestion
   - Deploy to staging
   - Verify infrastructure works

2. **Start Phase 2** (entity ingestion)
   - Design GitHub PR/issue/commit webhooks
   - Implement PR/issue as documents
   - Add `documentType` discrimination

3. **Begin Phase 2.5 planning**
   - Finalize schema design
   - Build test sets for evaluation
   - Prototype deterministic extraction

**Timeline:**
- Phase 1.5 complete: Week of 2025-01-20
- Phase 2 complete: Week of 2025-02-10
- Phase 2.5 complete: Week of 2025-04-07 (10 weeks)

---

## Questions?

See detailed design docs in this directory:
- `relationship-pipeline-audit.md`
- `relationship-reality-check.md`
- `cross-source-relationships.md`
- `semantic-relationship-extraction.md`
- `llm-cost-analysis.md`
