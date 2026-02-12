---
date: 2026-02-07
researcher: codebase-agent
topic: "AI eval pipeline continuation + paper topic identification — codebase analysis"
tags: [research, codebase, ai-evaluation, paper-topics, multi-view-embedding, hybrid-retrieval, significance-scoring, relationship-graph, actor-resolution]
status: complete
---

# Codebase Deep Dive: Eval Pipeline + Paper Topics

## Research Question
What aspects of Lightfast's AI pipeline are novel and paper-worthy, and what deeper implementation details are needed for the evaluation pipeline design?

## Summary

This deep dive goes significantly beyond the prior codebase analysis (2026-02-07-ai-eval-pipeline-codebase-deep-dive.md) to document the **exact implementation details, scoring mathematics, and novelty assessment** across seven key areas of the Lightfast system. The prior document catalogued what exists at a file-level; this document traces exact algorithms, formulas, and data flows with line-level references.

The most promising paper-worthy contributions are: (1) **Multi-view embedding with MAX aggregation** for engineering event retrieval — where title, content, and summary views each capture different semantic facets of a webhook event, and query-time aggregation takes the max score across views per observation; (2) **Significance scoring as an ingestion quality gate** — a novel pre-indexing filter that uses rule-based scoring to prevent noise from polluting the retrieval corpus, unlike standard RAG systems that ingest everything; (3) **Automatic relationship graph construction from webhook events** — detecting cross-source relationships (GitHub→Vercel→Sentry→Linear) using reference linking keys (commit SHAs, branch names, issue IDs) to build a traversable graph; and (4) **Four-path parallel hybrid retrieval with entity confirmation boosting** — a retrieval architecture that fuses dense vector search, structured entity matching, topic cluster search, and actor profile search into a single result set.

The test data corpus analysis reveals 56 webhook events across 4 datasets and 20 query scenarios that can bootstrap a golden evaluation dataset, though significant ground-truth annotation work is still required.

## Detailed Findings

### 1. Multi-View Embedding Architecture

#### Implementation Details

**Location**: `api/console/src/inngest/workflow/neural/observation-capture.ts:711-754`

Each observation generates **3 separate embeddings** in a single batch API call to Cohere:

| View | Vector ID Pattern | Input Text | Purpose |
|------|-------------------|------------|---------|
| **Title** | `obs_title_{sanitizedSourceId}` | `sourceEvent.title` | Captures the concise semantic intent (e.g., commit message, PR title) |
| **Content** | `obs_content_{sanitizedSourceId}` | `sourceEvent.body` | Full body text with implementation details |
| **Summary** | `obs_summary_{sanitizedSourceId}` | `sourceEvent.title + "\n\n" + sourceEvent.body.slice(0, 1000)` | Hybrid of title + truncated body for balanced retrieval |

**Embedding model**: Cohere `embed-english-v3.0`, 1024 dimensions
**Batch processing**: All 3 texts embedded in a single `embed()` call (observation-capture.ts:729)
**Asymmetric retrieval**: Documents indexed with `inputType: "search_document"`, queries embedded with `inputType: "search_query"` (four-path-search.ts:385)

**Pinecone storage** (observation-capture.ts:852-918): Each view is stored as a **separate vector** with shared base metadata plus a `view` discriminator field:
```
Base metadata (shared across all 3 vectors):
  layer: "observations"
  observationType: string
  source: string
  sourceType: string
  sourceId: string
  occurredAt: string
  actorName: string
  observationId: string  // Pre-generated nanoid for direct lookup

View-specific:
  view: "title" | "content" | "summary"
  title: string  // Always the observation title
  snippet: string  // Varies by view (title text, body[:500], title+body[:300])
```

#### Query-Time Aggregation: MAX Score Across Views

**Location**: `apps/console/src/lib/neural/four-path-search.ts:82-210` (`normalizeVectorIds()`)

At query time, a single Pinecone query returns matches from **all three views** (since they're in the same namespace with the same `layer: "observations"` filter). The normalization algorithm:

1. **Phase 3 path** (new vectors): Reads `observationId` directly from Pinecone metadata — zero database queries
2. **Phase 2 path** (legacy vectors): Falls back to database lookup mapping `embeddingTitleId/ContentId/SummaryId → externalId`
3. **Grouping**: Results grouped by `observationId` into `Map<observationId, ViewMatch[]>`
4. **Aggregation**: `Math.max(...group.matches.map(m => m.score))` — **MAX score wins** (four-path-search.ts:196)
5. **View tracking**: Each result preserves `matchedViews: ViewMatch[]` for analytics (which views contributed)

**The MAX aggregation strategy means**: If a query matches well against the title (0.92) but poorly against the content (0.55) and summary (0.78), the observation gets score 0.92. This is critical because engineering events have heterogeneous content — a commit with a precise title like "fix: OAuth token rotation" may have a body full of diff noise.

#### Novelty Assessment

**Novelty: MEDIUM-HIGH.** Multi-view embeddings exist in the literature (multi-vector document representations), but this specific application to engineering events with title/content/summary views and MAX aggregation is not well-documented. The closest work is:
- ColBERT-style multi-vector representations (per-token, not per-view)
- Document expansion techniques (generating queries from documents)
- Multi-field indexing in Elasticsearch (but not dense vectors)

The novel aspect is the **domain-specific view decomposition for engineering events**: the insight that a commit title captures different semantic information than the commit body or a summary thereof, and that MAX aggregation handles the heterogeneity of engineering event content where one view may be noise.

**Paper angle**: "Multi-View Dense Retrieval for Engineering Event Streams" — could evaluate each view's retrieval contribution independently and show that multi-view outperforms single-view.

---

### 2. Four-Path Parallel Search — Scoring Mathematics

#### Architecture

**Location**: `apps/console/src/lib/neural/four-path-search.ts:362-524` (`fourPathParallelSearch()`)

All 4 paths execute via `Promise.all()` (four-path-search.ts:400):

| Path | Implementation | Always Runs? | Score Range |
|------|---------------|--------------|-------------|
| **1. Vector Similarity** | Pinecone query with `embed-english-v3.0` | Yes | 0.0–1.0 (cosine similarity) |
| **2. Entity Search** | DB pattern matching on extracted entities | Yes | Derived (see below) |
| **3. Cluster Context** | Pinecone query on cluster centroids | Only if `hasClusters` | Informational (not merged into candidates) |
| **4. Actor Profiles** | DB text matching on display names + identities | Only if `hasActors` | Informational (not merged into candidates) |

**Key insight**: Paths 3 and 4 are **informational only** — they provide context (topic clusters, contributor profiles) but their results are NOT merged into the candidate set. Only Paths 1 and 2 contribute to the scored candidates.

#### Path 1: Vector Similarity (always executed)

1. Generate query embedding: `createEmbeddingProviderForWorkspace()` with `inputType: "search_query"` (four-path-search.ts:379-389)
2. Query Pinecone: `pineconeClient.query(indexName, { vector, topK, filter, includeMetadata: true }, namespace)` (four-path-search.ts:405-414)
3. Metadata filter: `{ layer: "observations" }` + optional source/type/actor/date filters (four-path-search.ts:272-307)
4. Raw scores: Pinecone cosine similarity scores (0.0–1.0)
5. Normalization: `normalizeVectorIds()` groups multi-view matches, takes MAX per observation

#### Path 2: Entity Search (always executed)

**Location**: `apps/console/src/lib/neural/entity-search.ts:71-153`

1. **Extract entities from query** (`extractQueryEntities()`, entity-search.ts:44-61):
   - `@mentions` → category: "engineer"
   - `#123` or `ENG-123` → category: "project"
   - `GET /api/users` → category: "endpoint"
2. **Exact key match** in `workspaceNeuralEntities` table (entity-search.ts:85-102)
3. **Fetch linked observations** via `sourceObservationId` FK (entity-search.ts:119-127)
4. **Result format**: `{ observationId, observationTitle, observationSnippet, occurrenceCount, confidence }`

Entity search only triggers when the query contains recognizable entity patterns. Most natural language queries return 0 entity matches.

#### Merge Algorithm: `mergeSearchResults()`

**Location**: `apps/console/src/lib/neural/four-path-search.ts:313-354`

The merge operates on a `Map<observationId, FilterCandidate>`:

**Step 1**: Add all normalized vector results to the map:
```
resultMap.set(observationId, { id, title, snippet, score: maxVectorScore })
```

**Step 2**: Iterate entity results:
- **If observation already in map** (vector + entity match): **Entity confirmation boost**
  ```typescript
  existing.score = Math.min(1.0, existing.score + 0.2)  // +0.2 boost, capped at 1.0
  ```
- **If observation NOT in map** (entity-only match): **Entity-only score**
  ```typescript
  score = 0.85 * entity.confidence  // e.g., 0.85 × 0.95 = 0.8075
  ```

**Step 3**: Sort by score descending, take top `limit`

#### Scoring Math Summary

| Scenario | Formula | Example |
|----------|---------|---------|
| Vector only | `MAX(view_scores)` | MAX(0.92, 0.55, 0.78) = **0.92** |
| Entity only | `0.85 × entity.confidence` | 0.85 × 0.95 = **0.8075** |
| Vector + Entity confirmed | `MIN(1.0, MAX(view_scores) + 0.2)` | MIN(1.0, 0.92 + 0.2) = **1.0** |
| Entity confirmed (lower vector) | `MIN(1.0, MAX(view_scores) + 0.2)` | MIN(1.0, 0.65 + 0.2) = **0.85** |

**When paths disagree**: The merge is additive, not competitive. If vector says A is top (score 0.9) and entity says B is relevant (confidence 0.95), both appear in results. B gets score 0.85 × 0.95 = 0.8075. A keeps its vector score 0.9. A ranks higher unless entity confirmation boosts B.

#### Deduplication

Deduplication is implicit via the `Map<observationId, FilterCandidate>` structure — the observation ID is the key, so duplicate IDs from different paths merge naturally. Entity results that match vector results boost rather than duplicate.

#### Path 3: Cluster Context Search

**Location**: `apps/console/src/lib/neural/cluster-search.ts:19-94`

1. Query Pinecone for cluster centroids: `filter: { layer: "clusters" }`, `topK: 3` (cluster-search.ts:30-39)
2. Fetch cluster metadata from DB by `topicEmbeddingId` (cluster-search.ts:49-64)
3. Returns: `{ topicLabel, summary, keywords, score, observationCount }`
4. **NOT merged into candidates** — used for context in API response

#### Path 4: Actor Profile Search

**Location**: `apps/console/src/lib/neural/actor-search.ts:50-195`

1. Extract `@mentions` from query (actor-search.ts:24-40)
2. **Org-level identity search**: Match usernames in `orgActorIdentities` table (actor-search.ts:73-128)
   - Mention matches get score: **0.95**
3. **Workspace-level name search**: ILIKE match on `displayName` in `workspaceActorProfiles` (actor-search.ts:132-176)
   - Name matches get score: **0.75**
4. Sort by score, then by `observationCount`
5. **NOT merged into candidates** — used for context in API response

#### Novelty Assessment

**Novelty: MEDIUM.** Hybrid retrieval (dense + sparse/structured) is well-established in the literature (ColBERT, SPLADE, BM25+DPR fusion). However, the specific combination of:
- Dense vector search with multi-view aggregation
- Structured entity confirmation boosting (+0.2 additive)
- Topic cluster context (informational, not scored)
- Actor profile context (informational, not scored)

...as a unified architecture for engineering event retrieval is novel. The +0.2 entity confirmation boost is a pragmatic heuristic rather than a learned fusion weight.

**Paper angle**: Ablation study showing contribution of each path, especially the entity confirmation boost's impact on precision for queries containing entity references.

---

### 3. Significance Scoring — Ingestion Quality Gate

#### Implementation Details

**Location**: `api/console/src/inngest/workflow/neural/scoring.ts:78-118` (`scoreSignificance()`)

**Scoring Formula** (5 components, clamped to 0-100):

```
score = baseWeight(eventType) + Σ signalWeights + referenceBonus + contentBonus
score = clamp(score, 0, 100)
```

**Component 1: Event Type Base Weight** (scoring.ts:82-84)

Source of truth: `packages/console-types/src/integrations/event-types.ts:25-87`

| Event Type | Base Weight | Category |
|-----------|-------------|----------|
| `release.published` | 75 | High significance |
| `release.created` | 70 | High significance |
| `deployment.error` | 70 | High significance |
| `deployment.canceled` | 65 | High significance |
| `pull-request.merged` | 60 | Medium-high |
| `pull-request.opened` | 50 | Medium |
| `pull-request.closed` | 45 | Medium |
| `pull-request.ready-for-review` | 45 | Medium |
| `issue.opened` | 45 | Medium |
| `issue.closed` | 40 | Medium |
| `deployment.succeeded` | 40 | Medium |
| `deployment.ready` | 40 | Medium |
| `discussion.answered` | 40 | Medium |
| `issue.reopened` | 40 | Medium |
| `pull-request.reopened` | 40 | Medium |
| `discussion.created` | 35 | Low-medium |
| `push` | 30 | Low |
| `deployment.created` | 30 | Low |
| Unknown event type | 35 | Default |

**Component 2: Content Signal Matching** (scoring.ts:52-66)

Applied to concatenated `title + body` text:

| Signal Category | Pattern | Weight | Factor Name |
|----------------|---------|--------|-------------|
| Critical keywords | `breaking, critical, urgent, security, vulnerability, CVE-\d+` | **+20** | `critical_keyword` |
| Incident keywords | `hotfix, emergency, incident, outage, downtime` | **+15** | `incident_keyword` |
| Important keywords | `major, important, significant, release, deploy` | **+10** | `important_keyword` |
| Feature keywords | `feature, feat, new` | **+8** | `feature_keyword` |
| Fix keywords | `fix, bug, patch, resolve` | **+5** | `fix_keyword` |
| Routine keywords | `chore, deps, dependencies, bump, update, upgrade` | **-10** | `routine_keyword` |
| Trivial keywords | `typo, whitespace, formatting, lint` | **-15** | `trivial_keyword` |
| WIP keywords | `wip, draft, temp, test` | **-10** | `wip_keyword` |

**Component 3: Reference Density Bonus** (scoring.ts:97-102)
```
refBonus = min(refCount × 3, 15)  // Max 15 points for 5+ references
```

**Component 4: Content Substance Bonus** (scoring.ts:105-113)
```
bodyLength > 500 chars → +5 points ("substantial_content")
bodyLength > 200 chars → +2 points ("moderate_content")
```

**Component 5: Clamp** (scoring.ts:115)
```
score = max(0, min(100, round(score)))
```

#### Threshold

**SIGNIFICANCE_THRESHOLD = 40** (scoring.ts:16)

Events scoring below 40 are logged but not stored. The gate is at observation-capture.ts:587:
```typescript
if (significance.score < SIGNIFICANCE_THRESHOLD) {
  // Log, complete job as "filtered: below_threshold", record metric, return early
}
```

#### Score Examples

| Event | Base | Signals | Refs | Content | Total | Pass? |
|-------|------|---------|------|---------|-------|-------|
| Push: "feat(auth): Add OAuth2 rotation" | 30 | +8 (feat) | +3 (1 ref) | +5 (long body) | **46** | Yes |
| Push: "chore: bump deps" | 30 | -10 (chore) -10 (deps/bump) | 0 | 0 | **10** | No |
| PR merged: "fix: resolve auth bug" | 60 | +5 (fix/resolve) | +9 (3 refs) | +2 (200+ body) | **76** | Yes |
| Push: "wip: temp test" | 30 | -10 (wip) -10 (test) | 0 | 0 | **10** | No |
| Release published: "v2.0.0" | 75 | +10 (release) | +6 (2 refs) | 0 | **91** | Yes |
| Issue opened: "typo in docs" | 45 | -15 (typo) | 0 | 0 | **30** | No |
| Deployment error | 70 | +15 (incident) | 0 | +5 (long body) | **90** | Yes |

#### Filtering Rate Estimate

Based on the base weights alone:
- `push` events (base 30) need +10 from signals to pass → many routine pushes filtered
- `deployment.created` (base 30) same situation
- `discussion.created` (base 35) needs only +5 → moderate filtering
- Everything else starts at 40+ → passes unless negative signals outweigh

**Estimated filtering rate**: ~30-50% of events (primarily routine pushes and low-signal deployments). This is not measured in production — no metrics track the overall filtering rate. The `observation_below_threshold` metric records individual filtered events but there's no dashboard or aggregate.

#### Novelty Assessment

**Novelty: HIGH.** Most RAG systems ingest everything and rely on retrieval quality to surface relevant results. Lightfast's significance scoring acts as a **pre-indexing quality gate** that:
1. Prevents noise from polluting the vector space (dependency bumps, formatting fixes)
2. Reduces storage costs (fewer vectors in Pinecone)
3. Improves retrieval quality by increasing the signal-to-noise ratio in the corpus

This is analogous to **document importance scoring in web search** (PageRank, HITS) but applied at ingestion time for engineering events. The rule-based approach with event-type weights and content signals is pragmatic and interpretable.

**Paper angle**: "Significance-Gated Indexing for Engineering Knowledge Retrieval" — could measure retrieval quality improvement from filtering vs. ingesting everything, and compare rule-based gating vs. LLM-based gating (the TODO in the code).

---

### 4. Answer Agent Tool-Use Orchestration

#### Agent Architecture

**Location**: `apps/console/src/app/(api)/v1/answer/[...v]/route.ts:43-217`

**Model**: `anthropic/claude-sonnet-4-5-20250929` via `@ai-sdk/gateway` (route.ts:32)
**Framework**: Custom `@lightfastai/ai-sdk/agent` with `createAgent()` (route.ts:88)
**Stop condition**: `stepCountIs(8)` — max 8 tool call steps per conversation turn (route.ts:180)
**Streaming**: `smoothStream({ delayInMs: 10 })` for UI rendering (route.ts:179)
**Memory**: `AnswerRedisMemory` — ephemeral sessions with 1-hour TTL in Upstash Redis (route.ts:184)

#### Available Tools (5 tools)

**Defined in**: `packages/console-ai/src/` (tool definitions) → handlers wired in route.ts:92-176

| Tool | Direct Logic Call | Purpose |
|------|-------------------|---------|
| `workspaceSearch` | `searchLogic()` | Full 4-path parallel search + rerank pipeline |
| `workspaceContents` | `contentsLogic()` | Fetch full observation content by IDs |
| `workspaceFindSimilar` | `findsimilarLogic()` | Vector similarity from a given observation |
| `workspaceGraph` | `graphLogic()` | BFS relationship graph traversal (1-3 hops) |
| `workspaceRelated` | `relatedLogic()` | Direct relationship edges for an observation |

**Critical**: Tools call the V1 logic functions **directly** (in-process), not over HTTP. This means the answer agent gets the same code path as the public API but without network overhead.

#### System Prompt Analysis

**Location**: `apps/console/src/ai/prompts/system-prompt.ts:1-33`

The system prompt (`buildAnswerSystemPrompt()`) instructs:

1. **Identity**: "You are Lightfast Answer, an AI assistant that helps developers understand their workspace activity across GitHub, Linear, Vercel, and Sentry."
2. **Workspace context**: Injects project name + description (currently hardcoded to Lightfast's own project — HARDCODED_WORKSPACE_CONTEXT at line 29)
3. **Tool usage**: "Always use your tools to find information. Never make up facts about the workspace."
4. **Citation format**: "When answering, cite the specific observations you found (include their IDs and URLs)."
5. **Search strategy**: "Use workspaceSearch first for broad questions, then workspaceContents to get full details."
6. **Graph traversal**: "Use workspaceGraph and workspaceRelated to trace cross-source connections."
7. **Style**: "Keep answers concise and developer-focused. Format responses with markdown."

**Notable**: No structured citation format is enforced (no `[1]`, `[obs_id]` template). The prompt says "include their IDs and URLs" but doesn't specify formatting. This makes citation extraction for evaluation more challenging.

#### Tool Selection Behavior

The agent (Claude Sonnet 4.5) decides tool selection autonomously based on the system prompt guidance. Typical patterns:

1. **Broad question** → `workspaceSearch` first → `workspaceContents` for details → generate answer
2. **Actor question** → `workspaceSearch` (which triggers actor path) → `workspaceContents` → generate
3. **Relationship question** → `workspaceSearch` → `workspaceGraph` on top result → generate
4. **Multi-hop** → Multiple `workspaceSearch` calls with refined queries → `workspaceGraph` → generate

The 8-step limit means the agent can make up to 8 tool calls. In practice, most questions resolve in 2-4 steps.

#### Novelty Assessment

**Novelty: LOW-MEDIUM.** Tool-use agents with retrieval tools are well-established (RAG agents, ReAct, Toolformer). The specific combination of 5 specialized tools (search, contents, similar, graph, related) providing different retrieval modalities is a good engineering design but not novel in the research sense.

**Paper angle**: Could study tool selection patterns — which tools are used for which query types, and whether the agent's tool selection strategy is optimal.

---

### 5. Cross-Source Identity Resolution

#### Implementation Details

**Location**: `api/console/src/inngest/workflow/neural/actor-resolution.ts:86-138`

The actor resolution system handles identity linking across sources:

**GitHub events**: Direct — uses numeric GitHub user ID
```typescript
actorId = `github:${sourceActor.id}`  // e.g., "github:12345678"
```

**Vercel events**: Indirect — attempts to resolve username to numeric GitHub ID via commit SHA linkage

The Vercel resolution algorithm (actor-resolution.ts:37-78):
1. Extract commit SHA from Vercel deployment references
2. Query DB: Find a GitHub observation with the same commit SHA in `sourceReferences` (JSONB containment query)
3. If found: Extract `actor.id` from the GitHub observation
4. If numeric: Use it as the canonical ID → `github:${numericId}`
5. If not found: Fall back to `github:${username}` (non-numeric)

**Cross-source reconciliation** (observation-capture.ts:244-329 `reconcileVercelActorsForCommit()`):
When a GitHub push arrives AFTER a Vercel deployment:
1. Extract commit SHAs from the push event
2. Find Vercel observations referencing those same commits
3. Update Vercel observations' actor data with the numeric GitHub ID

This is a **bidirectional reconciliation**: Vercel→GitHub (at resolution time) and GitHub→Vercel (post-hoc when push arrives later).

**Org-level identity** (used in actor search):
- `orgActorIdentities` table stores cross-org identity mappings
- `canonicalActorId` links to `workspaceActorProfiles.actorId`
- Identity includes `sourceUsername`, `avatarUrl`, Clerk linking

#### Limitations

1. **GitHub-centric**: Only resolves to GitHub numeric IDs. Linear/Sentry users are not cross-linked.
2. **Commit SHA dependent**: Vercel→GitHub linking only works if a GitHub push with the same commit exists in the workspace.
3. **No fuzzy matching**: Username "alice" in GitHub won't match "Alice Smith" in Linear without explicit linking.
4. **No cross-platform**: A developer's GitHub identity is not linked to their Linear or Sentry identity.

#### Novelty Assessment

**Novelty: MEDIUM.** Cross-source identity resolution is a known problem (entity resolution, record linkage). The commit-SHA-based linking strategy is practical but limited. The bidirectional reconciliation (forward + retroactive) is a nice engineering touch.

**Paper angle**: Could explore more sophisticated identity resolution using profile similarity, timing correlation, and naming heuristics across engineering platforms.

---

### 6. Test Data Corpus Analysis

#### Dataset Inventory

| Dataset | File | Webhooks | Event Types | Sources |
|---------|------|----------|-------------|---------|
| `comprehensive` | `datasets/comprehensive.json` | **35** | push, PR (opened/closed/merged), issues, releases, deployments | GitHub, Vercel |
| `demo-incident` | `datasets/demo-incident.json` | **15** | Sentry issues, Linear issues, GitHub PRs/pushes, Vercel deployments | Sentry, Linear, GitHub, Vercel |
| `performance` | `datasets/performance.json` | **3** | PR merged, issue opened, deployment succeeded | GitHub, Vercel |
| `security` | `datasets/security.json` | **3** | PR merged, issue opened, push | GitHub |

**Total**: 56 webhook events across 4 datasets

#### Query Scenarios

**Location**: `docs/examples/query-scenarios/query_scenarios.json` — 20 scenarios

| ID | Intent | Query Type (for eval) | Has Filters | Uses Graph |
|----|--------|----------------------|-------------|------------|
| Q001 | incident_search | temporal | Yes (sentry, after date) | No |
| Q002 | ownership | actor | Yes | Yes |
| Q003 | dependency | technical | Yes | Yes |
| Q004 | decision | technical | Yes | No |
| Q005 | deployment_history | temporal | Yes (vercel, after date) | No |
| Q006 | change_evidence | technical | Yes | No |
| Q007 | temporal_diff | temporal | Yes (after date) | No |
| Q008 | similar | technical | Yes | No |
| Q009 | expertise | actor | Yes | Yes |
| Q010 | error_search | technical | Yes (sentry) | No |
| Q011 | incident_history | temporal | Yes (after date) | No |
| Q012 | infra_changes | technical | Yes | No |
| Q013 | summary | multi-hop | Yes (date range) | No |
| Q014 | review_search | technical | Yes (after date) | No |
| Q015 | impact_analysis | multi-hop | Yes (date range) | Yes |
| Q016 | agent_context | technical | Yes | Yes |
| Q017 | important_changes | temporal | Yes (after date) | No |
| Q018 | root_cause | multi-hop | Yes | No |
| Q019 | build_failures | temporal | Yes (after date) | No |
| Q020 | contributors | actor | Yes (after date) | No |

#### Query Type Distribution

| Query Type | Count | Scenarios |
|-----------|-------|-----------|
| temporal | 6 | Q001, Q005, Q007, Q011, Q017, Q019 |
| technical | 6 | Q003, Q004, Q006, Q010, Q012, Q014 |
| multi-hop | 3 | Q013, Q015, Q018 |
| actor | 3 | Q002, Q009, Q020 |
| status | 0 | — |
| null | 0 | — |

**Missing**: No status queries, no null queries (queries that should return nothing).

#### Conversion Feasibility

**Can these be directly converted to eval golden dataset entries?**

**Partially, with significant work needed:**

1. **Query scenarios** (20): The queries are well-crafted but have **no ground truth**. They specify `expectedSignals` (which search paths should fire) but NOT `expectedObservationIds`. To convert, you'd need to:
   - Ingest test data into an eval workspace
   - Manually identify which observations from the test data are relevant to each query
   - Most scenarios reference sources (Sentry, PagerDuty, Pulumi) that don't exist in the test data

2. **Test data** (56 webhooks): Good diversity of event types but:
   - `comprehensive.json` (35 events) covers GitHub + Vercel only
   - `demo-incident.json` (15 events) adds Sentry + Linear cross-source
   - Missing: PagerDuty, Pulumi, Terraform events referenced in queries
   - Actors: Limited cast (alice, bob, charlie, sarah, etc.)

3. **Realistic conversion**: ~10-12 of the 20 query scenarios could be meaningfully mapped to the existing test data. The rest reference sources or event types not in the corpus.

4. **Test infrastructure**: The `@repo/console-test-data` package already has CLI tools for injection (`pnpm inject`), verification (`pnpm verify`), and programmatic usage. The pipeline flows through the **real production workflow** (significance scoring, entity extraction, embeddings, cluster assignment).

#### Test Data Architecture Note

Test data uses **raw webhook payloads** (not SourceEvents). The `transformWebhook()` function routes through the same production transformers as real webhooks:
- `transformGitHubPush`, `transformGitHubPullRequest`, `transformGitHubIssue`
- `transformVercelDeployment`

This is good for eval — tests exercise the full pipeline including transformation.

---

### 7. Relationship Detection — Graph Construction

#### Detection Algorithm

**Location**: `api/console/src/inngest/workflow/neural/relationship-detection.ts:45-285`

When a new observation is captured, `detectAndCreateRelationships()` runs and attempts to link it to existing observations via 5 detection strategies:

#### Strategy 1: Commit SHA Matching (relationship-detection.ts:70-103)

- Extract `commit` references from the new observation
- Query DB: Find existing observations whose `sourceReferences` JSONB **contains** the same commit SHA
  ```sql
  sourceReferences::jsonb @> '[{"type":"commit","id":"abc123"}]'::jsonb
  ```
- Relationship type determined by `determineCommitRelationType()`:
  - Sentry observation with `label: "resolved_by"` → type: `resolves` (confidence: 1.0)
  - Vercel ↔ GitHub commit → type: `deploys` (confidence: 1.0)
  - Any other source pair → type: `same_commit` (confidence: 1.0)

#### Strategy 2: Branch Name Matching (relationship-detection.ts:106-124)

- Extract `branch` references
- Query DB: Find observations with same branch in `sourceReferences`
- Relationship type: `same_branch` (confidence: 0.9)

#### Strategy 3: Issue ID Matching — Explicit Fixes (relationship-detection.ts:127-177)

- Extract `issue` references with labels "fixes", "closes", "resolves"
- Query DB: Find observations mentioning those issue IDs (JSONB containment + title ILIKE + sourceId ILIKE)
- Relationship type: `fixes` (confidence: 1.0, detection method: "explicit")

- For non-"fixes" issue mentions:
  - Relationship type: `references` (confidence: 0.8, detection method: "entity_cooccurrence")

#### Strategy 4: PR ID Matching (relationship-detection.ts:179-198)

- Extract `pr` references
- Query DB: Find observations with matching PR numbers in `sourceId` (ILIKE)
- Relationship type: `tracked_in` (confidence: 1.0)

#### Strategy 5: Sentry→Linear Triggering (relationship-detection.ts:200-245)

- For Linear issues with `label: "linked"` Sentry references:
- Find matching Sentry observations by issue ID
- Relationship type: `triggers` (confidence: 0.8)

#### Deduplication (relationship-detection.ts:478-493)

Key: `${targetObservationId}-${relationshipType}` — keeps highest confidence per target+type combination.

#### Relationship Types

| Type | Meaning | Example | Detection |
|------|---------|---------|-----------|
| `resolves` | Commit fixes a Sentry issue | Sentry issue → GitHub commit with `resolved_by` | Explicit label |
| `deploys` | Deployment includes commit | GitHub push → Vercel deployment | Commit SHA match |
| `same_commit` | Same commit referenced | Two observations referencing same SHA | Commit SHA match |
| `same_branch` | Same branch | PR + push on same branch | Branch name match |
| `fixes` | PR fixes issue | PR with "fixes #123" → Issue #123 | Explicit label |
| `references` | Mentions same issue | Two observations mentioning same issue | Entity co-occurrence |
| `tracked_in` | Linear tracked in PR | Linear issue → GitHub PR | PR ID match |
| `triggers` | Error triggers work | Sentry issue → Linear issue | Explicit link |

#### Graph Traversal

**Location**: `apps/console/src/lib/v1/graph.ts:51-201`

BFS traversal from a root observation:
1. Get root observation by `externalId` (graph.ts:60-74)
2. BFS loop with `depth = min(input.depth, 3)` — max 3 hops (graph.ts:88-89)
3. Each hop: Query `workspaceObservationRelationships` for both source and target directions (graph.ts:91-102)
4. Optional: Filter by `allowedTypes` (graph.ts:105-108)
5. Fetch new node details from `workspaceNeuralObservations` (graph.ts:122-139)
6. Build edges with `{ source, target, type, linkingKey, confidence }` (graph.ts:143-155)

**Output**: `{ root, nodes[], edges[], meta: { depth, nodeCount, edgeCount, took } }`

#### Novelty Assessment

**Novelty: HIGH.** Automatic relationship graph construction from engineering webhook events is a genuinely novel contribution. Key aspects:

1. **Multi-strategy detection**: 5 different linking strategies covering explicit (labels), structural (SHA matching), and co-occurrence patterns
2. **Cross-source linking**: Automatically connects GitHub commits → Vercel deployments → Sentry errors → Linear issues
3. **Confidence-graded**: Explicit links (1.0) vs. co-occurrence (0.8) vs. branch matching (0.9)
4. **Bidirectional**: Each new observation is linked to ALL existing matching observations, building the graph incrementally
5. **Traversable**: BFS graph traversal enables multi-hop queries through the answer agent

This is not just knowledge graph construction — it's **automatic engineering event graph construction** from heterogeneous webhook streams. Most knowledge graph systems require manual schema design and entity linking; Lightfast derives relationships automatically from structured metadata (commit SHAs, branch names, issue IDs).

**Paper angle**: "Automatic Engineering Activity Graph Construction from Heterogeneous Webhook Streams" — could evaluate graph completeness, precision of detected relationships, and impact on multi-hop query answering.

---

## Novelty Summary

| Rank | Topic | Novelty | Paper Feasibility | Eval Impact |
|------|-------|---------|-------------------|-------------|
| 1 | **Significance-Gated Indexing** | HIGH | HIGH — Clear experiment: gated vs. ungated corpus, measure retrieval quality | HIGH — Directly measurable via retrieval metrics |
| 2 | **Automatic Relationship Graph from Webhooks** | HIGH | HIGH — Novel system, measurable graph quality, multi-hop query improvement | HIGH — Graph completeness and traversal accuracy are evaluable |
| 3 | **Multi-View Embedding for Engineering Events** | MEDIUM-HIGH | HIGH — Ablation study: single-view vs. multi-view, per-view contribution analysis | HIGH — Can measure each view's retrieval contribution |
| 4 | **Four-Path Hybrid Retrieval with Entity Boosting** | MEDIUM | MEDIUM — Ablation study, but hybrid retrieval is well-trodden | MEDIUM — Path contribution already partially logged |
| 5 | **Cross-Source Identity Resolution** | MEDIUM | LOW — Limited scope (GitHub-only), need more sources for interesting paper | LOW — Hard to evaluate without ground truth identity mapping |
| 6 | **Answer Agent Tool Orchestration** | LOW-MEDIUM | LOW — Tool-use agents are well-established | MEDIUM — Tool selection patterns are evaluable |

**Recommended first paper**: Combine #1 + #2 + #3 as a **systems paper** describing the end-to-end pipeline for engineering knowledge retrieval, with ablation studies on each novel component. Title suggestion: *"Significance-Gated Multi-View Retrieval with Automatic Relationship Graphs for Engineering Event Streams"*

---

## Code References

### Multi-View Embedding
- `api/console/src/inngest/workflow/neural/observation-capture.ts:711-754` — 3-view embedding generation
- `api/console/src/inngest/workflow/neural/observation-capture.ts:852-918` — Multi-view Pinecone upsert with view-specific metadata
- `apps/console/src/lib/neural/four-path-search.ts:82-210` — `normalizeVectorIds()` with MAX aggregation
- `packages/console-embed/src/utils.ts:150-160` — Workspace-bound embedding provider (model locking)

### Four-Path Search
- `apps/console/src/lib/neural/four-path-search.ts:362-524` — `fourPathParallelSearch()` main function
- `apps/console/src/lib/neural/four-path-search.ts:313-354` — `mergeSearchResults()` with entity boost
- `apps/console/src/lib/neural/entity-search.ts:71-153` — `searchByEntities()` pattern matching
- `apps/console/src/lib/neural/cluster-search.ts:19-94` — `searchClusters()` centroid query
- `apps/console/src/lib/neural/actor-search.ts:50-195` — `searchActorProfiles()` identity + name search

### Significance Scoring
- `api/console/src/inngest/workflow/neural/scoring.ts:78-118` — `scoreSignificance()` function
- `api/console/src/inngest/workflow/neural/scoring.ts:52-66` — `SIGNIFICANCE_SIGNALS` patterns
- `packages/console-types/src/integrations/event-types.ts:25-87` — `INTERNAL_EVENT_TYPES` with base weights
- `api/console/src/inngest/workflow/neural/observation-capture.ts:582-632` — Significance gate in workflow

### Answer Agent
- `apps/console/src/app/(api)/v1/answer/[...v]/route.ts:43-217` — Answer API route (POST handler)
- `apps/console/src/ai/prompts/system-prompt.ts:1-33` — System prompt builder
- `packages/console-ai/src/` — Tool definitions (5 tools)

### Actor Resolution
- `api/console/src/inngest/workflow/neural/actor-resolution.ts:86-138` — `resolveActor()` function
- `api/console/src/inngest/workflow/neural/actor-resolution.ts:37-78` — Vercel→GitHub via commit SHA
- `api/console/src/inngest/workflow/neural/observation-capture.ts:244-329` — `reconcileVercelActorsForCommit()`

### Relationship Detection
- `api/console/src/inngest/workflow/neural/relationship-detection.ts:45-285` — `detectAndCreateRelationships()`
- `api/console/src/inngest/workflow/neural/relationship-detection.ts:448-473` — `determineCommitRelationType()`
- `apps/console/src/lib/v1/graph.ts:51-201` — `graphLogic()` BFS traversal

### Test Data
- `packages/console-test-data/datasets/comprehensive.json` — 35 webhooks (GitHub + Vercel)
- `packages/console-test-data/datasets/demo-incident.json` — 15 webhooks (Sentry + Linear + GitHub + Vercel)
- `packages/console-test-data/datasets/performance.json` — 3 webhooks
- `packages/console-test-data/datasets/security.json` — 3 webhooks
- `docs/examples/query-scenarios/query_scenarios.json` — 20 query scenarios
- `packages/console-test-data/src/cli/inject.ts` — Test data injection CLI

### Entity Extraction
- `api/console/src/inngest/workflow/neural/entity-extraction-patterns.ts:18-86` — Regex patterns (7 categories)
- `api/console/src/inngest/workflow/neural/entity-extraction-patterns.ts:129-164` — `extractEntities()` text extraction
- `api/console/src/inngest/workflow/neural/entity-extraction-patterns.ts:170-210` — `extractFromReferences()` structured extraction
- `api/console/src/inngest/workflow/neural/llm-entity-extraction.ts:68-139` — `extractEntitiesWithLLM()` semantic extraction

### Cluster Assignment
- `api/console/src/inngest/workflow/neural/cluster-assignment.ts:48-111` — `assignToCluster()` with multi-signal affinity
- `api/console/src/inngest/workflow/neural/cluster-assignment.ts:117-166` — `calculateClusterAffinity()` scoring (embedding 40 + entity 30 + actor 20 + temporal 10 = 100)

---

## Integration Points

### How Components Connect

```
Webhook → SourceEvent → Significance Gate (40 threshold)
                                |
                     [score < 40: FILTERED]
                                |
                     [score >= 40: PROCESS]
                                |
                    ┌───────────┼───────────────┐
                    ↓           ↓               ↓
              Classification  Multi-View     Entity Extraction
              (Claude Haiku)  Embeddings     (regex + LLM)
                    ↓        (3 vectors)          ↓
                    ↓           ↓               ↓
                    ↓      Cluster Assignment    ↓
                    ↓      (affinity scoring)    ↓
                    ↓           ↓               ↓
                    └───────────┼───────────────┘
                                ↓
                         Store (DB + Pinecone)
                                ↓
                    Relationship Detection
                    (5 linking strategies)
                                ↓
                    Actor Reconciliation
                    (bidirectional GitHub↔Vercel)
```

```
Search Query → Embedding (Cohere search_query)
                    ↓
            ┌───────┼───────┐───────┐
            ↓       ↓       ↓       ↓
         Vector   Entity  Cluster  Actor
         Search   Search  Search   Search
            ↓       ↓       ↓       ↓
            └───┬───┘       └───┬───┘
                ↓               ↓
           Merge+Boost     Context (informational)
           (candidates)    (clusters, actors)
                ↓
            Reranking
         (fast/balanced/thorough)
                ↓
            Enrichment
         (DB metadata + entities)
                ↓
            API Response
```

---

## Gaps Identified

### For Evaluation Pipeline
1. **No ground truth**: Query scenarios have no `expectedObservationIds` — cannot be used for retrieval metrics without manual annotation
2. **No view contribution tracking**: Which of the 3 embedding views (title/content/summary) contributed to each result is tracked in `matchedViews` during normalization but NOT exposed in the API response or logged
3. **No path effectiveness logging**: The `paths` field in search results shows which paths succeeded but NOT which results came from which path
4. **No significance filtering rate tracking**: No aggregate metric for what percentage of events get filtered
5. **Missing test data sources**: No Sentry, Linear, PagerDuty, Pulumi test data in most datasets (only `demo-incident.json` has Sentry + Linear)

### For Paper
1. **No A/B comparisons**: Cannot measure multi-view vs. single-view, gated vs. ungated, etc. without the eval pipeline
2. **No per-view analytics**: Need to log which view scored highest per retrieval hit for ablation study
3. **No relationship graph quality metrics**: No measure of graph precision/recall (are detected relationships correct? are real relationships missed?)
4. **Citation format not structured**: Answer agent uses free-form citations, making citation evaluation harder
5. **No production query logs for dataset**: Activity logging records queries but no relevance judgments

### For Production Quality
1. **Entity confirmation boost (+0.2) is hardcoded**: No principled justification for this value; should be calibrated via eval
2. **Significance threshold (40) not calibrated**: Chosen heuristically; should measure impact on retrieval quality
3. **Cluster affinity threshold (60) not calibrated**: Same situation
4. **No rerank lift measurement**: Don't know if reranking actually improves results (no before/after comparison)
