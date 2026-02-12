---
date: 2026-02-10T05:36:21Z
git_commit: 593bc567
branch: main
repository: lightfast-search-perf-improvements
type: formal-specification
status: complete
---

# Formal Architecture Specification: Four-Path Parallel Search

**Extracted**: 2026-02-10 @ 593bc567
**Method**: parallel sub-agent extraction via extract-math
**Notation**: algorithms=formal, schemas=tables, scoring=math, enums=mappings

---


═══ T02: enrichSearchResults - Score Fusion and Enrichment ═══
FILES: four-path-search.ts:313-354, four-path-search.ts:553-657, v1/search.ts:87-91

FUSION: mergeSearchResults
  INPUT STREAMS:
    S₁: normalizedVectorResults[] — vector ANN from Pinecone
    S₂: entityResults[] — entity pattern matching from Postgres

  NORMALIZE: (implicit in merge)
    S₁[i].score → kept as-is from Pinecone cosine similarity
    S₂[j].confidence → 0.85 × confidence (four-path-search.ts:345)

  MERGE:
    IF observationId ∈ S₁ ∩ S₂ :
      final_score(x) = min(1.0, S₁.score + 0.2)  (four-path-search.ts:335)
      metadata: prefer S₂ title/snippet over S₁ (four-path-search.ts:337-338)
    ELSE IF observationId ∈ S₁ \ S₂ :
      final_score(x) = S₁.score
    ELSE IF observationId ∈ S₂ \ S₁ :
      final_score(x) = 0.85 × S₂.confidence

  DEDUP: Map<observationId, FilterCandidate> (four-path-search.ts:318)
  SORT:  descending by final_score (four-path-search.ts:352)
  LIMIT: topK (four-path-search.ts:353)

ENRICHMENT: enrichSearchResults
  STAGE 1: Fetch observations (four-path-search.ts:569-586)
    TABLE:  workspaceNeuralObservations
    FILTER: workspaceId = ? AND externalId IN [resultIds]
    INDEX:  idx_workspace_external_id (inferred)
    CARD:   |results| = k (batch query)
    COLS:   id, externalId, title, source, observationType, occurredAt, metadata, sourceReferences

  STAGE 2: Fetch entities (four-path-search.ts:593-606)
    TABLE:  workspaceNeuralEntities
    FILTER: workspaceId = ? AND sourceObservationId IN [internalObsIds]
    INDEX:  idx_workspace_observation_id (inferred)
    CARD:   ≤ k × E_avg  (where E_avg = avg entities per observation)
    COLS:   sourceObservationId, key, category

  STAGE 3: In-memory join (four-path-search.ts:628-656)
    JOIN:   results LEFT JOIN observations ON results.id = observations.externalId
            LEFT JOIN entityMap ON results.id = entityMap[externalId]
            LEFT JOIN candidateMap ON results.id = candidateMap[id]
    OP:     Map construction → O(k) lookups
    OUT:    EnrichedResult[]

CONSTANTS:
  ENTITY_BOOST = 0.2 (four-path-search.ts:335)
  ENTITY_SCORE_WEIGHT = 0.85 (four-path-search.ts:345)
  MAX_SCORE = 1.0 (four-path-search.ts:335)

COMPLEXITY:
  Fusion: O(|S₁| + |S₂| + k log k)  — union + sort
  Enrichment:
    DB queries: O(k) per query (indexed lookups)
    In-memory join: O(k + E_total)  where E_total = Σ entities per obs
    Total: O(k log k + E_total)

CALLS → 
  db.select() (four-path-search.ts:569, 593)
  Map.set() (four-path-search.ts:322, 341, 618, 619)

CALLED_BY ← searchLogic (v1/search.ts:87)
═══ END T02 ═══

═══ T01: fourPathParallelSearch - Four Parallel Search Paths ═══
FILES: four-path-search.ts:362-524, entity-search.ts:71-140, cluster-search.ts:19-68, actor-search.ts:50-109

PIPELINE: fourPathParallelSearch
  ┌─ STAGE 0: Embedding Generation ──────────────────────────┐
  │  IN:  query: string                                       │
  │  OP:  createEmbeddingProviderForWorkspace().embed()       │
  │  OUT: queryVector: number[]  |  DIM: d (workspace config) │
  │  COMPLEXITY: O(1) API call                                │
  │  SOURCE: four-path-search.ts:378-394                      │
  └───────────────────────────────────────────────────────────┘
       │ [feed vector to paths 1,3 | text to paths 2,4]
       ▼
  ┌─ PATH 1: Vector Similarity (ANN) ────────────────────────┐
  │  IN:  queryVector: number[], topK: int, filters          │
  │  OP:  Pinecone.query(indexName, namespace)               │
  │      METRIC: cosine (implicit in Pinecone config)        │
  │  OUT: VectorMatch[] { id, score, metadata }              │
  │      CARD: ≤ topK matches                                │
  │  COMPLEXITY: O(log n) [HNSW approximate]                 │
  │  SOURCE: four-path-search.ts:400-420                     │
  │  POST: normalizeVectorIds() → observationId              │
  │        Splits Phase 3 (metadata.observationId present)   │
  │        vs Phase 2 (DB lookup via embedding*Id cols)      │
  │        SOURCE: four-path-search.ts:82-201                │
  │        COMPLEXITY: O(k) or O(k + DB_query) if legacy     │
  └──────────────────────────────────────────────────────────┘
       │
       ▼
  ┌─ PATH 2: Entity Pattern Matching (SQL) ──────────────────┐
  │  IN:  query: string, workspaceId, topK                   │
  │  OP:  (1) extractQueryEntities(query) → entity keys      │
  │       (2) SELECT FROM workspaceNeuralEntities            │
  │           WHERE key IN (extracted_keys)                  │
  │           ORDER BY occurrenceCount DESC                  │
  │       (3) JOIN workspaceNeuralObservations               │
  │           ON sourceObservationId                         │
  │  OUT: EntitySearchResult[] {                             │
  │         observationId, title, snippet, confidence        │
  │       }                                                   │
  │  CARD: ≤ topK matches                                    │
  │  COMPLEXITY: O(|entities| + k·log k) [index scan + sort] │
  │  SOURCE: entity-search.ts:71-140                         │
  └──────────────────────────────────────────────────────────┘
       │
       ▼
  ┌─ PATH 3: Cluster Context (ANN + SQL) ────────────────────┐
  │  GATE: hasClusters (workspace config flag)               │
  │        four-path-search.ts:435                           │
  │  IN:  queryVector: number[], topK=3                      │
  │  OP:  (1) Pinecone.query(filter: layer="clusters")       │
  │       (2) SELECT FROM workspaceObservationClusters       │
  │           WHERE topicEmbeddingId IN (pinecone_ids)       │
  │  OUT: ClusterSearchResult[] {                            │
  │         topicLabel, summary, keywords, score             │
  │       }                                                   │
  │  CARD: ≤ 3 clusters                                      │
  │  COMPLEXITY: O(log n_clusters) [HNSW] + O(k) [DB fetch]  │
  │  SOURCE: cluster-search.ts:19-68                         │
  └──────────────────────────────────────────────────────────┘
       │
       ▼
  ┌─ PATH 4: Actor Profile Matching (SQL Pattern) ───────────┐
  │  GATE: hasActors (workspace config flag)                 │
  │        four-path-search.ts:447                           │
  │  IN:  query: string, topK=5                              │
  │  OP:  (1) extractActorMentions(query) → @usernames       │
  │       (2) SELECT FROM orgActorIdentities                 │
  │           WHERE sourceUsername ILIKE mentions            │
  │       (3) JOIN workspaceActorProfiles                    │
  │           ON actorId                                     │
  │  OUT: ActorSearchResult[] {                              │
  │         displayName, expertiseDomains, score             │
  │       }                                                   │
  │  CARD: ≤ 5 actors                                        │
  │  COMPLEXITY: O(|actors|) [full scan if no idx on username] │
  │  SOURCE: actor-search.ts:50-109                          │
  └──────────────────────────────────────────────────────────┘
       │
       ▼ [ALL PATHS COMPLETE via Promise.all]
       │
  ┌─ STAGE 5: Result Fusion ─────────────────────────────────┐
  │  IN:  NormalizedVectorResult[], EntitySearchResult[]     │
  │  OP:  mergeSearchResults(vector, entity, topK)           │
  │       Map<observationId, Candidate>:                     │
  │         - Vector result → score (as is)                  │
  │         - Entity match ∩ vector → score + 0.2 (boost)    │
  │         - Entity-only → score = 0.85 * confidence        │
  │       Sort DESC by score, slice(0, topK)                 │
  │  OUT: FilterCandidate[] { id, title, snippet, score }   │
  │  CARD: ≤ topK candidates                                 │
  │  COMPLEXITY: O(k·log k) [merge + sort]                   │
  │  SOURCE: four-path-search.ts:313-354                     │
  └──────────────────────────────────────────────────────────┘

PARALLELISM: Paths 1-4 run concurrently (Promise.all at :400)
  - No inter-path dependencies
  - Fallback: empty result if path fails (catch blocks)
  - Skipped paths (no clusters/actors) resolve immediately

SCORING FUSION:
  Vector-only:         score_v (from Pinecone cosine similarity)
  Vector + Entity:     min(1.0, score_v + 0.2)  (four-path-search.ts:335)
  Entity-only:         0.85 * confidence         (four-path-search.ts:345)
  Clusters/Actors:     metadata only (no score fusion into candidates)

CONSTANTS:
  ENTITY_BOOST = 0.2 (four-path-search.ts:335)
  ENTITY_ONLY_FACTOR = 0.85 (four-path-search.ts:345)
  CLUSTER_DEFAULT_TOPK = 3 (four-path-search.ts:438)
  ACTOR_DEFAULT_TOPK = 5 (four-path-search.ts:450)
  MAX_SCORE_CAP = 1.0 (four-path-search.ts:335)

COMPLEXITY:
  Embedding:     O(1) [API call]
  Path 1 (ANN):  O(log n + k·[1 or log k_DB]) [HNSW + optional DB normalize]
  Path 2 (SQL):  O(|entities| + k·log k)
  Path 3 (ANN):  O(log n_clusters + k)
  Path 4 (SQL):  O(|actors| + k)
  Merge:         O(k·log k)
  TOTAL:         O(log n + k·log k) [dominated by vector search + merge]

CALLS → 
  createEmbeddingProviderForWorkspace() (four-path-search.ts:379)
  buildPineconeFilter() (four-path-search.ts:397)
  pineconeClient.query() (four-path-search.ts:405)
  searchByEntities() (entity-search.ts:71)
  searchClusters() (cluster-search.ts:19)
  searchActorProfiles() (actor-search.ts:50)
  normalizeVectorIds() (four-path-search.ts:82)
  mergeSearchResults() (four-path-search.ts:313)

CALLED_BY ← 
  ~/lib/v1/search.ts:38 (searchLogic wrapper)
═══ END T01 ═══


═══ T03: detectAndCreateRelationships - Relationship Detection Rules ═══
FILES: api/console/src/inngest/workflow/neural/relationship-detection.ts:L45-L285, db/console/src/schema/tables/workspace-observation-relationships.ts:L1-L171

ENUM: RelationshipType
  fixes        → PR/commit fixes an issue
  resolves     → Commit resolves a Sentry issue
  triggers     → Sentry error triggers Linear issue
  deploys      → Vercel deployment deploys a commit
  references   → Generic reference link
  same_commit  → Two observations about the same commit
  same_branch  → Two observations about the same branch
  tracked_in   → GitHub PR tracked in Linear via attachment
SOURCE: db/console/src/schema/tables/workspace-observation-relationships.ts:L27-L35
CARDINALITY: |RelationshipType| = 8

DETECTION RULES (IF-THEN):
┌────────────────────────────────────────────────────────────────────────────────┐
│ RULE 1: COMMIT SHA MATCH → {resolves | deploys | same_commit}                 │
├────────────────────────────────────────────────────────────────────────────────┤
│ INPUT:  sourceEvent.references where type="commit"                             │
│ QUERY:  sourceReferences::jsonb @> [{"type":"commit","id":"<sha>"}]::jsonb     │
│ LIMIT:  50 (relationship-detection.ts:318)                                     │
│ TYPE LOGIC (relationship-detection.ts:L448-L473):                              │
│   IF (source="sentry" ∧ label="resolved_by") → "resolves" | conf=1.0          │
│   IF (source∈{vercel,github} ∧ match∈{github,vercel}) → "deploys" | conf=1.0  │
│   ELSE → "same_commit" | conf=1.0                                              │
│ DETECTION_METHOD:                                                              │
│   label="resolved_by" → "explicit" (relationship-detection.ts:92)             │
│   ELSE → "commit_match" (relationship-detection.ts:92)                        │
└────────────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────────────┐
│ RULE 2: BRANCH NAME MATCH → same_branch                                       │
├────────────────────────────────────────────────────────────────────────────────┤
│ INPUT:  sourceEvent.references where type="branch"                             │
│ QUERY:  sourceReferences::jsonb @> [{"type":"branch","id":"<name>"}]::jsonb    │
│ LIMIT:  50 (relationship-detection.ts:318)                                     │
│ OUTPUT: relationshipType="same_branch" | conf=0.9 (relationship-detection.ts:120) │
│ DETECTION_METHOD: "branch_match" (relationship-detection.ts:121)              │
└────────────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────────────┐
│ RULE 3: ISSUE ID MATCH (EXPLICIT) → fixes                                     │
├────────────────────────────────────────────────────────────────────────────────┤
│ INPUT:  sourceEvent.references where type="issue" ∧ label∈{"fixes","closes","resolves"} │
│ QUERY:  sourceReferences::jsonb @> [{"type":"issue","id":"<id>"}]::jsonb OR    │
│         title ILIKE '%<id>%' OR sourceId ILIKE '%<id>%'                        │
│ LIMIT:  50 (relationship-detection.ts:376)                                     │
│ OUTPUT: relationshipType="fixes" | conf=1.0 (relationship-detection.ts:151)    │
│ DETECTION_METHOD: "explicit" (relationship-detection.ts:152)                  │
└────────────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────────────┐
│ RULE 4: ISSUE ID MATCH (NON-EXPLICIT) → references                            │
├────────────────────────────────────────────────────────────────────────────────┤
│ INPUT:  sourceEvent.references where type="issue" ∧ label∉{fixes,closes,resolves} │
│ QUERY:  Same as RULE 3                                                         │
│ OUTPUT: relationshipType="references" | conf=0.8 (relationship-detection.ts:172) │
│ DETECTION_METHOD: "entity_cooccurrence" (relationship-detection.ts:173)       │
└────────────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────────────┐
│ RULE 5: PR NUMBER MATCH → tracked_in                                          │
├────────────────────────────────────────────────────────────────────────────────┤
│ INPUT:  sourceEvent.references where type="pr"                                 │
│ QUERY:  sourceId ILIKE '%<prId>%'                                              │
│ LIMIT:  50 (relationship-detection.ts:428)                                     │
│ OUTPUT: relationshipType="tracked_in" | conf=1.0 (relationship-detection.ts:194) │
│ DETECTION_METHOD: "pr_match" (relationship-detection.ts:195)                  │
│ USE CASE: Linear issue → GitHub PR via attachments                            │
└────────────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────────────┐
│ RULE 6: SENTRY ATTACHMENT (LINEAR) → triggers                                 │
├────────────────────────────────────────────────────────────────────────────────┤
│ INPUT:  source="linear" ∧ references where type="issue" ∧ label="linked"       │
│ QUERY:  sourceReferences::jsonb @> [{"type":"issue","id":"<id>"}]::jsonb OR    │
│         title/sourceId ILIKE '%<id>%'                                          │
│ LIMIT:  50 per query (relationship-detection.ts:318,376)                      │
│ DEDUP:  Map<number, {id,linkingKey}> (relationship-detection.ts:228-233)      │
│ OUTPUT: relationshipType="triggers" | conf=0.8 (relationship-detection.ts:241) │
│ DETECTION_METHOD: "explicit" (relationship-detection.ts:242)                  │
│ USE CASE: Sentry issue triggers Linear work                                   │
└────────────────────────────────────────────────────────────────────────────────┘

SCHEMA: lightfast_workspace_observation_relationships
┌──────────────────────┬─────────────────────┬──────────┬─────────────────┐
│ Column               │ Type                │ Nullable │ Default         │
├──────────────────────┼─────────────────────┼──────────┼─────────────────┤
│ id                   │ bigint              │ N        │ IDENTITY        │
│ externalId           │ varchar(21)         │ N        │ nanoid()        │
│ workspaceId          │ varchar(191)        │ N        │ —               │
│ sourceObservationId  │ bigint              │ N        │ —               │
│ targetObservationId  │ bigint              │ N        │ —               │
│ relationshipType     │ varchar(50)         │ N        │ —               │
│ linkingKey           │ varchar(500)        │ Y        │ NULL            │
│ linkingKeyType       │ varchar(50)         │ Y        │ NULL            │
│ confidence           │ real                │ N        │ 1.0             │
│ metadata             │ jsonb               │ Y        │ NULL            │
│ createdAt            │ timestamp w/tz      │ N        │ CURRENT_TS      │
└──────────────────────┴─────────────────────┴──────────┴─────────────────┘
SOURCE: workspace-observation-relationships.ts:L55-L131

INDEXES:
  ws_obs_rel_external_id_idx ON (externalId) [UNIQUE] (workspace-observation-relationships.ts:L134-L136)
  ws_obs_rel_source_idx ON (workspaceId, sourceObservationId) (workspace-observation-relationships.ts:L139-L142)
  ws_obs_rel_target_idx ON (workspaceId, targetObservationId) (workspace-observation-relationships.ts:L145-L148)
  ws_obs_rel_linking_key_idx ON (workspaceId, linkingKey) (workspace-observation-relationships.ts:L151-L154)
  ws_obs_rel_unique_edge_idx ON (workspaceId, sourceObservationId, targetObservationId, relationshipType) [UNIQUE] (workspace-observation-relationships.ts:L157-L162)

FK:
  workspaceId → orgWorkspaces.id (ON DELETE CASCADE)
  sourceObservationId → workspaceNeuralObservations.id (ON DELETE CASCADE)
  targetObservationId → workspaceNeuralObservations.id (ON DELETE CASCADE)

DEDUPLICATION:
  STRATEGY: Map<targetId-relType, DetectedRelationship> (relationship-detection.ts:L478-L493)
  POLICY: Keep highest confidence for (targetObservationId, relationshipType) pair
  INSERT: .onConflictDoNothing() (relationship-detection.ts:271)

CONSTANTS:
  QUERY_LIMIT = 50 (relationship-detection.ts:318,376,428)
  CONFIDENCE_EXPLICIT = 1.0 (fixes, resolves, deploys, tracked_in, same_commit)
  CONFIDENCE_INFERRED_HIGH = 0.9 (same_branch)
  CONFIDENCE_INFERRED_MED = 0.8 (references, triggers)

METADATA:
  detectionMethod ∈ {"explicit", "commit_match", "branch_match", "pr_match", "entity_cooccurrence"}
  SOURCE: workspace-observation-relationships.ts:L42-L47

QUERY PATTERNS:
  JSONB_CONTAINS: sourceReferences::jsonb @> [{"type":"<T>","id":"<K>"}]::jsonb
  FUZZY_MATCH: title ILIKE '%<K>%' OR sourceId ILIKE '%<K>%'
  COMBINED: OR(jsonbConditions, titleConditions, sourceIdConditions)

COMPLEXITY:
  PER OBSERVATION: O(R·log(N)) where R = |references|, N = |observations in workspace|
    - Extract R reference keys: O(R)
    - Query per reference type (4 types max): O(R·log(N)) via indexes
    - Deduplicate: O(M) where M ≤ 50·|ref_types| (LIMIT=50 per query)
    - Insert batch: O(M)
  TOTAL PER OBSERVATION: O(R·log(N) + M)

AVG FAN-OUT:
  ESTIMATED: 2-5 relationships per observation (inferable from LIMIT=50, dedup logic)
  UPPER BOUND: 50·|{commit,branch,issue,pr}| = 200 pre-dedup (relationship-detection.ts:318,376,428)

CALLS → findObservationsByReference (relationship-detection.ts:290), findObservationsByIssueId (relationship-detection.ts:338), findObservationsByPrId (relationship-detection.ts:402), determineCommitRelationType (relationship-detection.ts:448), deduplicateRelationships (relationship-detection.ts:478)
CALLED_BY ← observation-capture workflow (api/console/src/inngest/workflow/neural/observation-capture.ts)
═══ END T03 ═══

---

## Extraction Summary

| Task | Target | Status | Lines |
|------|--------|--------|-------|
| T01  | fourPathParallelSearch (4 paths) | ✓ | 135 |
| T02  | enrichSearchResults (fusion) | ✓ | 65 |
| T03  | detectAndCreateRelationships | ✓ | 149 |

**Total extractions**: 3 tasks
**Completed**: 3 / 3

---
_Generated by extract-math @ 593bc567_

═══ T05: assignToCluster Clustering Algorithm ═══
FILES: api/console/src/inngest/workflow/neural/cluster-assignment.ts:48-111, :117-166, :171-193, :198-207, :212-270, :275-311

CLASS: Incremental nearest-centroid with affinity scoring
INPUT: (workspaceId, embeddingVector: ℝⁿ, vectorId, topics: string[], entityIds: string[], actorId: string | null, occurredAt: timestamp, title, indexName, namespace)
OUTPUT: { clusterId: int, isNew: bool, affinityScore: float | null }
METRIC: Cosine similarity (embedding) + Jaccard (entity/actor) + temporal decay

STEPS:
  1. Fetch recent clusters — O(1)
     SELECT * FROM workspaceObservationClusters
     WHERE workspaceId = ? AND status = 'open' AND lastObservationAt >= (now - 7d)
     ORDER BY lastObservationAt DESC LIMIT 10
     → recentClusters[] (cluster-assignment.ts:54-68)

  2. Score each cluster in parallel — O(k) where k = |recentClusters| ≤ 10
     affinity(cluster, obs) = f_emb + f_entity + f_actor + f_time
     → affinities[] (cluster-assignment.ts:76-81)

  3. Select best match — O(k log k)
     bestMatch = argmax_{c ∈ recentClusters} affinity(c, obs) s.t. affinity ≥ 60
     → bestMatch (cluster-assignment.ts:84-86)

  4a. IF bestMatch EXISTS → assign to cluster (cluster-assignment.ts:88-106)
      updateClusterMetrics(clusterId, obs) — O(1)
      RETURN { clusterId, isNew: false, affinityScore }

  4b. ELSE → create new cluster (cluster-assignment.ts:110)
      centroidId = cluster_${nanoid()}
      Pinecone.upsert(centroidId, embeddingVector, layer="clusters")
      INSERT INTO workspaceObservationClusters(...)
      RETURN { clusterId, isNew: true, affinityScore: null }

TERMINATION: Single-pass assignment (greedy)
TOTAL COMPLEXITY: O(k + d) where k ≤ 10, d = embedding_dim (Pinecone query)

AFFINITY SCORING FORMULA:
  S(cluster, obs) = w₁·sim(emb_cluster, emb_obs) + w₂·J(E_cluster, E_obs) + w₃·δ(A_cluster ∩ A_obs) + w₄·decay(Δt)

FACTORS:
  f_emb    = cosine(cluster.topicEmbeddingId, obs.embeddingVector) × 40  | weight: 40 | range: [0, 40]  (cluster-assignment.ts:123-141)
  f_entity = J(cluster.primaryEntities, obs.entityIds) × 30             | weight: 30 | range: [0, 30]  (cluster-assignment.ts:143-147)
  f_actor  = 20 if obs.actorId ∈ cluster.primaryActors else 0           | weight: 20 | range: [0, 20]  (cluster-assignment.ts:149-153)
  f_time   = max(0, 10 - Δt_hours)                                      | weight: 10 | range: [0, 10]  (cluster-assignment.ts:155-163)

  where:
    J(A, B) = |A ∩ B| / |A ∪ B|  (Jaccard)  (cluster-assignment.ts:198-207)
    Δt_hours = differenceInHours(obs.occurredAt, cluster.lastObservationAt)

THRESHOLD: 60/100 (cluster-assignment.ts:22)
OUTPUT RANGE: [0, 100]
TYPE: Heuristic

CONSTANTS:
  CLUSTER_AFFINITY_THRESHOLD = 60 (cluster-assignment.ts:22)
  MAX_RECENT_CLUSTERS = 10 (cluster-assignment.ts:23)
  CLUSTER_LOOKBACK_DAYS = 7 (cluster-assignment.ts:24)
  MAX_PRIMARY_ENTITIES = 20 (cluster-assignment.ts:295)
  MAX_PRIMARY_ACTORS = 10 (cluster-assignment.ts:298)

COMPLEXITY: O(k + d) per assignment, k ≤ 10, d = Pinecone query cost

DATA SOURCES:
  • Postgres: workspaceObservationClusters (SELECT recent open clusters)
  • Pinecone: layer="clusters" (cosine similarity query for centroid matching)

CALLS → 
  consolePineconeClient.query(indexName, {vector, topK:1, filter:{layer:"clusters"}}, namespace) (cluster-assignment.ts:179-188)
  consolePineconeClient.upsertVectors(indexName, {ids, vectors, metadata}, namespace) (cluster-assignment.ts:225-233)
  invalidateWorkspaceConfig(workspaceId) (cluster-assignment.ts:257)

CALLED_BY ← 
  neural/observation-capture.ts:877 (after entity extraction, actor resolution, relationship detection)
═══ END T05 ═══


═══ T06: scoreSignificance Scoring Function ═══
FILES: api/console/src/inngest/workflow/neural/scoring.ts:78-118, packages/console-types/src/integrations/event-types.ts:177-472

S(e) = clamp(w_base + Σw_signal + w_ref + w_content, 0, 100)

FACTORS:
  f₁: base_event_weight = EVENT_REGISTRY[e.sourceType].weight    | weight: varies by type | range: [20, 75]
  f₂: content_signals   = Σ SIGNIFICANCE_SIGNALS[pattern_match] | weight: [-15, +20]    | range: additive
  f₃: reference_bonus   = min(|e.references| × 3, 15)            | weight: dynamic       | range: [0, 15]
  f₄: content_length    = { 5 if len(body)>500, 2 if >200, 0 }  | weight: fixed         | range: [0, 5]

BASE EVENT WEIGHTS (event-types.ts:177-472):
  github:release.published           = 75
  sentry:metric-alert                = 70
  vercel:deployment.error            = 70
  github:pull-request.merged         = 60
  sentry:event-alert                 = 65
  sentry:issue.created               = 55
  github:pull-request.opened         = 50
  linear:issue.created               = 50
  github:issue.opened                = 45
  github:push                        = 30
  linear:comment.created             = 25
  sentry:issue.ignored               = 25
  vercel:deployment.check-rerequested= 25
  linear:comment.updated             = 20
  linear:comment.deleted             = 20
  * (unknown event)                  = 35 (default)

CONTENT SIGNAL PATTERNS (scoring.ts:52-66):
  /breaking|critical|urgent|security|vulnerability|CVE-\d+/i  → +20  (critical_keyword)
  /hotfix|emergency|incident|outage|downtime/i                → +15  (incident_keyword)
  /major|important|significant|release|deploy/i               → +10  (important_keyword)
  /feature|feat|new/i                                         → +8   (feature_keyword)
  /fix|bug|patch|resolve/i                                    → +5   (fix_keyword)
  /chore|deps|dependencies|bump|update|upgrade/i              → -10  (routine_keyword)
  /typo|whitespace|formatting|lint/i                          → -15  (trivial_keyword)
  /wip|draft|temp|test/i                                      → -10  (wip_keyword)

REFERENCE BONUS (scoring.ts:96-102):
  refBonus = min(|sourceEvent.references| × 3, 15)
  Applied when |references| > 0

CONTENT LENGTH BONUS (scoring.ts:104-112):
  bodyLength > 500 → +5 (substantial_content)
  bodyLength > 200 → +2 (moderate_content)
  else → 0

CONSTANTS:
  SIGNIFICANCE_THRESHOLD = 40 (scoring.ts:16)

THRESHOLD: 40
OUTPUT RANGE: [0, 100]
TYPE: heuristic (rule-based)

COMPLEXITY: O(|SIGNIFICANCE_SIGNALS| × |text|) ≈ O(1) for bounded signal set

CALLS → getEventWeight (event-types.ts:499), Math.min, Math.max, Math.round
CALLED_BY ← api/console/src/inngest/workflow/neural/observation-capture.ts, api/console/src/inngest/workflow/notifications/dispatch.ts
═══ END T06 ═══


═══ T08: Reranking Implementations ═══
FILES: packages/console-rerank/src/factory.ts:35-48, packages/console-rerank/src/providers/passthrough.ts:24-54, packages/console-rerank/src/providers/cohere.ts:52-200, packages/console-rerank/src/providers/llm.ts:97-290

CLASS: Mode-dispatched reranking (factory pattern)
INPUT: query: string, candidates: RerankCandidate[], options?: RerankOptions
OUTPUT: RerankResponse { results: RerankResult[], latency: number, provider: string, filtered: number, bypassed: boolean, fallback?: boolean }

MODE DISPATCH:
  fast       → PassthroughRerankProvider
  balanced   → CohereRerankProvider
  thorough   → LLMRerankProvider

┌─ MODE: fast (Passthrough) ────────────────────────────────────────────────┐
│ TYPE: Identity function (no reranking)                                    │
│ ALGORITHM:                                                                 │
│   S_final(c) = S_vector(c)                                                │
│   Filter: S_final ≥ threshold                                             │
│   Sort: descending by S_final                                             │
│   Limit: topK                                                              │
│                                                                            │
│ CONSTANTS:                                                                 │
│   threshold_default = 0 (passthrough.ts:32)                               │
│                                                                            │
│ COMPLEXITY: O(n log n) — sort only                                        │
│   n = |candidates|                                                         │
└────────────────────────────────────────────────────────────────────────────┘

┌─ MODE: balanced (Cohere) ──────────────────────────────────────────────────┐
│ TYPE: Cross-encoder reranking via Cohere API                              │
│ ALGORITHM:                                                                 │
│   1. Format docs: d_i = title_i || ": " || content_i                      │
│   2. API call: relevance_i ← Cohere.rerank(query, [d_1, ..., d_n])       │
│   3. S_final(c_i) = relevance_i                                            │
│   4. Filter: S_final ≥ threshold                                           │
│      IF |filtered| < minResults:                                           │
│        Return top min(topK, minResults) by S_final (bypass threshold)     │
│   5. Sort: descending by S_final                                           │
│   6. Limit: topK                                                           │
│                                                                            │
│ CONSTANTS:                                                                 │
│   model = "rerank-v3.5" (cohere.ts:67)                                    │
│   threshold_default = 0.4 (cohere.ts:68)                                  │
│   minResults_default = 0 (cohere.ts:79)                                   │
│                                                                            │
│ FALLBACK:                                                                  │
│   On API failure → S_final(c) = S_vector(c), sort, slice(topK)           │
│                                                                            │
│ COMPLEXITY: O(n · d · e) + O(n log n)                                     │
│   n = |candidates|                                                         │
│   d = avg document length                                                  │
│   e = cross-encoder inference cost (model-dependent, ~100-200ms for n=100)│
└────────────────────────────────────────────────────────────────────────────┘

┌─ MODE: thorough (LLM) ─────────────────────────────────────────────────────┐
│ TYPE: LLM-based structured scoring (Claude Haiku 4.5)                     │
│ ALGORITHM:                                                                 │
│   BYPASS GATE: IF n ≤ bypassThreshold → use S_vector only                 │
│                                                                            │
│   1. Format prompt: query + candidates (truncate content to 200 chars)    │
│   2. LLM call: relevance_i ← generateObject(schema, prompt)               │
│      Schema: { scores: Array<{id: string, relevance: [0,1]}> }            │
│      Temperature = 0.1 (llm.ts:159)                                        │
│   3. Weighted fusion:                                                      │
│      S_final(c_i) = w_llm · relevance_i + w_vec · S_vector(c_i)           │
│      Missing LLM scores default to 0.5 (llm.ts:179)                       │
│   4. Filter: relevance_i ≥ threshold (filters on LLM score, NOT final)    │
│      IF |filtered| < minResults:                                           │
│        Return top min(topK, minResults) by S_final (bypass threshold)     │
│   5. Sort: descending by S_final                                           │
│   6. Limit: topK                                                           │
│                                                                            │
│ CONSTANTS:                                                                 │
│   model = "anthropic/claude-haiku-4.5" (llm.ts:78)                        │
│   w_llm = 0.6 (llm.ts:79)                                                 │
│   w_vec = 0.4 (llm.ts:80)                                                 │
│   threshold_default = 0.4 (llm.ts:81)                                     │
│   bypassThreshold = 5 (llm.ts:82)                                         │
│   minResults_default = 0 (llm.ts:113)                                     │
│                                                                            │
│ FALLBACK:                                                                  │
│   On LLM failure → S_final(c) = S_vector(c), sort, slice(topK)           │
│                                                                            │
│ COMPLEXITY:                                                                │
│   IF n ≤ 5: O(n log n)                                                    │
│   ELSE: O(n · L) + O(n log n)                                             │
│     L = LLM inference latency (model-dependent, ~1-3s for n=100)          │
└────────────────────────────────────────────────────────────────────────────┘

SHARED FILTERING LOGIC:
  1. Apply threshold: results = filter(r => r.relevance >= threshold)
  2. Check minResults guarantee:
     IF |results| < minResults:
       results = top(candidates, min(topK, minResults)) by S_final
       fallback = true

SCORING FORMULA SUMMARY:
┌────────────┬───────────────────────────────────────────────────────────────┐
│ Mode       │ S_final(c)                                                    │
├────────────┼───────────────────────────────────────────────────────────────┤
│ fast       │ S_vector(c)                                                   │
│ balanced   │ Cohere_relevance(query, c)                                    │
│ thorough   │ 0.6·LLM_relevance(query, c) + 0.4·S_vector(c)                │
└────────────┴───────────────────────────────────────────────────────────────┘

CALLS → None (terminal nodes, invoke external APIs)
CALLED_BY ← four-path-search.ts (to be extracted in T06)
═══ END T08 ═══


═══ T04: Neural Memory Schema Tables ═══
FILES: workspace-neural-observations.ts:48-256, workspace-neural-entities.ts:26-165, workspace-observation-relationships.ts:55-164, workspace-observation-clusters.ts:19-150, workspace-actor-profiles.ts:61-135

TABLE: workspaceNeuralObservations
┌───────────────────────┬──────────────────────┬──────────┬──────────────────────┐
│ Column                │ Type                 │ Nullable │ Default              │
├───────────────────────┼──────────────────────┼──────────┼──────────────────────┤
│ id                    │ bigint               │ N        │ GENERATED IDENTITY   │
│ externalId            │ varchar(21)          │ N        │ nanoid()             │
│ workspaceId           │ varchar(191)         │ N        │ —                    │
│ clusterId             │ bigint               │ Y        │ null                 │
│ occurredAt            │ timestamp+tz         │ N        │ —                    │
│ capturedAt            │ timestamp+tz         │ N        │ CURRENT_TIMESTAMP    │
│ actor                 │ jsonb                │ Y        │ null                 │
│ actorId               │ bigint               │ Y        │ null                 │
│ observationType       │ varchar(100)         │ N        │ —                    │
│ title                 │ text                 │ N        │ —                    │
│ content               │ text                 │ N        │ —                    │
│ topics                │ jsonb                │ Y        │ null                 │
│ significanceScore     │ real                 │ Y        │ null                 │
│ source                │ varchar(50)          │ N        │ —                    │
│ sourceType            │ varchar(100)         │ N        │ —                    │
│ sourceId              │ varchar(255)         │ N        │ —                    │
│ sourceReferences      │ jsonb                │ Y        │ null                 │
│ metadata              │ jsonb                │ Y        │ null                 │
│ embeddingVectorId     │ varchar(191)         │ Y        │ null (deprecated)    │
│ embeddingTitleId      │ varchar(191)         │ Y        │ null                 │
│ embeddingContentId    │ varchar(191)         │ Y        │ null                 │
│ embeddingSummaryId    │ varchar(191)         │ Y        │ null                 │
│ ingestionSource       │ varchar(20)          │ N        │ 'webhook'            │
│ createdAt             │ timestamp+tz         │ N        │ CURRENT_TIMESTAMP    │
└───────────────────────┴──────────────────────┴──────────┴──────────────────────┘

INDEXES:
  obs_external_id_idx ON (externalId) UNIQUE btree (workspace-neural-observations.ts:212)
  obs_workspace_occurred_idx ON (workspaceId, occurredAt) btree (workspace-neural-observations.ts:215)
  obs_cluster_idx ON (clusterId) btree (workspace-neural-observations.ts:221)
  obs_source_idx ON (workspaceId, source, sourceType) btree (workspace-neural-observations.ts:224)
  obs_source_id_idx ON (workspaceId, sourceId) btree (workspace-neural-observations.ts:231)
  obs_type_idx ON (workspaceId, observationType) btree (workspace-neural-observations.ts:237)
  obs_embedding_title_idx ON (workspaceId, embeddingTitleId) btree (workspace-neural-observations.ts:243)
  obs_embedding_content_idx ON (workspaceId, embeddingContentId) btree (workspace-neural-observations.ts:247)
  obs_embedding_summary_idx ON (workspaceId, embeddingSummaryId) btree (workspace-neural-observations.ts:251)

FK: workspaceId → orgWorkspaces.id (workspace-neural-observations.ts:71)
EST. ROW WIDTH: ~1200 bytes (id:8 + externalId:21 + workspaceId:191 + clusterId:8 + timestamps:32 + actor:128 + actorId:8 + observationType:100 + title:~150 + content:~400 + topics:~64 + significanceScore:4 + source:50 + sourceType:100 + sourceId:255 + sourceReferences:~64 + metadata:~128 + embeddingIds:~200 + ingestionSource:20)

---

TABLE: workspaceNeuralEntities
┌──────────────────────┬──────────────────────┬──────────┬──────────────────────┐
│ Column               │ Type                 │ Nullable │ Default              │
├──────────────────────┼──────────────────────┼──────────┼──────────────────────┤
│ id                   │ bigint               │ N        │ GENERATED IDENTITY   │
│ externalId           │ varchar(21)          │ N        │ nanoid()             │
│ workspaceId          │ varchar(191)         │ N        │ —                    │
│ category             │ varchar(50)          │ N        │ —                    │
│ key                  │ varchar(500)         │ N        │ —                    │
│ value                │ text                 │ Y        │ null                 │
│ aliases              │ jsonb                │ Y        │ null                 │
│ sourceObservationId  │ bigint               │ Y        │ null                 │
│ evidenceSnippet      │ text                 │ Y        │ null                 │
│ confidence           │ real                 │ Y        │ 0.8                  │
│ extractedAt          │ timestamp+tz         │ N        │ CURRENT_TIMESTAMP    │
│ lastSeenAt           │ timestamp+tz         │ N        │ CURRENT_TIMESTAMP    │
│ occurrenceCount      │ integer              │ N        │ 1                    │
│ createdAt            │ timestamp+tz         │ N        │ CURRENT_TIMESTAMP    │
│ updatedAt            │ timestamp+tz         │ N        │ CURRENT_TIMESTAMP    │
└──────────────────────┴──────────────────────┴──────────┴──────────────────────┘

INDEXES:
  entity_external_id_idx ON (externalId) UNIQUE btree (workspace-neural-entities.ts:138)
  entity_workspace_category_key_idx ON (workspaceId, category, key) UNIQUE btree (workspace-neural-entities.ts:141)
  entity_workspace_category_idx ON (workspaceId, category) btree (workspace-neural-entities.ts:148)
  entity_workspace_key_idx ON (workspaceId, key) btree (workspace-neural-entities.ts:154)
  entity_workspace_last_seen_idx ON (workspaceId, lastSeenAt) btree (workspace-neural-entities.ts:160)

FK: workspaceId → orgWorkspaces.id (workspace-neural-entities.ts:49)
FK: sourceObservationId → workspaceNeuralObservations.id (workspace-neural-entities.ts:81)
EST. ROW WIDTH: ~900 bytes (id:8 + externalId:21 + workspaceId:191 + category:50 + key:500 + value:~100 + aliases:~64 + sourceObservationId:8 + evidenceSnippet:~100 + confidence:4 + timestamps:40 + occurrenceCount:4)

---

TABLE: workspaceObservationRelationships
┌──────────────────────┬──────────────────────┬──────────┬──────────────────────┐
│ Column               │ Type                 │ Nullable │ Default              │
├──────────────────────┼──────────────────────┼──────────┼──────────────────────┤
│ id                   │ bigint               │ N        │ GENERATED IDENTITY   │
│ externalId           │ varchar(21)          │ N        │ nanoid()             │
│ workspaceId          │ varchar(191)         │ N        │ —                    │
│ sourceObservationId  │ bigint               │ N        │ —                    │
│ targetObservationId  │ bigint               │ N        │ —                    │
│ relationshipType     │ varchar(50)          │ N        │ —                    │
│ linkingKey           │ varchar(500)         │ Y        │ null                 │
│ linkingKeyType       │ varchar(50)          │ Y        │ null                 │
│ confidence           │ real                 │ N        │ 1.0                  │
│ metadata             │ jsonb                │ Y        │ null                 │
│ createdAt            │ timestamp+tz         │ N        │ CURRENT_TIMESTAMP    │
└──────────────────────┴──────────────────────┴──────────┴──────────────────────┘

INDEXES:
  ws_obs_rel_external_id_idx ON (externalId) UNIQUE btree (workspace-observation-relationships.ts:134)
  ws_obs_rel_source_idx ON (workspaceId, sourceObservationId) btree (workspace-observation-relationships.ts:139)
  ws_obs_rel_target_idx ON (workspaceId, targetObservationId) btree (workspace-observation-relationships.ts:145)
  ws_obs_rel_linking_key_idx ON (workspaceId, linkingKey) btree (workspace-observation-relationships.ts:151)
  ws_obs_rel_unique_edge_idx ON (workspaceId, sourceObservationId, targetObservationId, relationshipType) UNIQUE btree (workspace-observation-relationships.ts:157)

FK: workspaceId → orgWorkspaces.id (workspace-observation-relationships.ts:78)
FK: sourceObservationId → workspaceNeuralObservations.id (workspace-observation-relationships.ts:85)
FK: targetObservationId → workspaceNeuralObservations.id (workspace-observation-relationships.ts:92)
EST. ROW WIDTH: ~400 bytes (id:8 + externalId:21 + workspaceId:191 + sourceObservationId:8 + targetObservationId:8 + relationshipType:50 + linkingKey:500 + linkingKeyType:50 + confidence:4 + metadata:~64 + createdAt:8)

ENUMERATION:
  RelationshipType (workspace-observation-relationships.ts:27-35):
    "fixes" → PR/commit fixes an issue
    "resolves" → Commit resolves a Sentry issue
    "triggers" → Sentry error triggers Linear issue
    "deploys" → Vercel deployment deploys a commit
    "references" → Generic reference link
    "same_commit" → Two observations about the same commit
    "same_branch" → Two observations about the same branch
    "tracked_in" → GitHub PR tracked in Linear via attachment
  CARDINALITY: |RelationshipType| = 8

---

TABLE: workspaceObservationClusters
┌───────────────────────┬──────────────────────┬──────────┬──────────────────────┐
│ Column                │ Type                 │ Nullable │ Default              │
├───────────────────────┼──────────────────────┼──────────┼──────────────────────┤
│ id                    │ bigint               │ N        │ GENERATED IDENTITY   │
│ externalId            │ varchar(21)          │ N        │ nanoid()             │
│ workspaceId           │ varchar(191)         │ N        │ —                    │
│ topicLabel            │ varchar(255)         │ N        │ —                    │
│ topicEmbeddingId      │ varchar(191)         │ Y        │ null                 │
│ keywords              │ jsonb                │ Y        │ null                 │
│ primaryEntities       │ jsonb                │ Y        │ null                 │
│ primaryActors         │ jsonb                │ Y        │ null                 │
│ status                │ varchar(50)          │ N        │ 'open'               │
│ summary               │ text                 │ Y        │ null                 │
│ summaryGeneratedAt    │ timestamp+tz         │ Y        │ null                 │
│ observationCount      │ integer              │ N        │ 0                    │
│ firstObservationAt    │ timestamp+tz         │ Y        │ null                 │
│ lastObservationAt     │ timestamp+tz         │ Y        │ null                 │
│ createdAt             │ timestamp+tz         │ N        │ CURRENT_TIMESTAMP    │
│ updatedAt             │ timestamp+tz         │ N        │ CURRENT_TIMESTAMP    │
└───────────────────────┴──────────────────────┴──────────┴──────────────────────┘

INDEXES:
  cluster_external_id_idx ON (externalId) UNIQUE btree (workspace-observation-clusters.ts:136)
  cluster_workspace_status_idx ON (workspaceId, status) btree (workspace-observation-clusters.ts:139)
  cluster_last_observation_idx ON (workspaceId, lastObservationAt) btree (workspace-observation-clusters.ts:145)

FK: workspaceId → orgWorkspaces.id (workspace-observation-clusters.ts:42)
EST. ROW WIDTH: ~800 bytes (id:8 + externalId:21 + workspaceId:191 + topicLabel:255 + topicEmbeddingId:191 + keywords:~64 + primaryEntities:~64 + primaryActors:~64 + status:50 + summary:~150 + summaryGeneratedAt:8 + observationCount:4 + firstObservationAt:8 + lastObservationAt:8 + timestamps:16)

---

TABLE: workspaceActorProfiles
┌──────────────────────┬──────────────────────┬──────────┬──────────────────────┐
│ Column               │ Type                 │ Nullable │ Default              │
├──────────────────────┼──────────────────────┼──────────┼──────────────────────┤
│ id                   │ bigint               │ N        │ GENERATED IDENTITY   │
│ externalId           │ varchar(21)          │ N        │ nanoid()             │
│ workspaceId          │ varchar(191)         │ N        │ —                    │
│ actorId              │ varchar(191)         │ N        │ —                    │
│ displayName          │ varchar(255)         │ N        │ —                    │
│ email                │ varchar(255)         │ Y        │ null                 │
│ observationCount     │ integer              │ N        │ 0                    │
│ lastActiveAt         │ timestamp+tz         │ Y        │ null                 │
│ profileConfidence    │ real                 │ Y        │ null                 │
│ createdAt            │ timestamp+tz         │ N        │ CURRENT_TIMESTAMP    │
│ updatedAt            │ timestamp+tz         │ N        │ CURRENT_TIMESTAMP    │
└──────────────────────┴──────────────────────┴──────────┴──────────────────────┘

INDEXES:
  actor_profile_external_id_idx ON (externalId) UNIQUE btree (workspace-actor-profiles.ts:115)
  actor_profile_unique_idx ON (workspaceId, actorId) UNIQUE btree (workspace-actor-profiles.ts:120)
  actor_profile_workspace_idx ON (workspaceId) btree (workspace-actor-profiles.ts:126)
  actor_profile_last_active_idx ON (workspaceId, lastActiveAt) btree (workspace-actor-profiles.ts:129)

FK: workspaceId → orgWorkspaces.id (workspace-actor-profiles.ts:81)
EST. ROW WIDTH: ~500 bytes (id:8 + externalId:21 + workspaceId:191 + actorId:191 + displayName:255 + email:255 + observationCount:4 + lastActiveAt:8 + profileConfidence:4 + timestamps:16)

NOTE: actorId format = "{source}:{sourceId}", e.g. "github:12345678" (workspace-actor-profiles.ts:46-48)
NOTE: avatarUrl and clerkUserId moved to orgActorIdentities (org-level identity table) (workspace-actor-profiles.ts:87-88)

═══ END T04 ═══


═══ T09: Embedding Configuration ═══
FILES: packages/console-validation/src/constants/embedding.ts:32-39
       packages/console-embed/src/utils.ts:150-160, 175-194
       api/console/src/inngest/workflow/processing/process-documents.ts:282-291, 491
       apps/console/src/lib/neural/four-path-search.ts:385
       vendor/embed/src/provider/cohere.ts:22-54, 91-93
       packages/console-validation/src/schemas/store.ts:105-112

PROVIDER: Cohere (fixed)
  API_KEY: embedEnv.COHERE_API_KEY (vendor/embed/env)
  MODEL: "embed-english-v3.0" (embedding.ts:36)
  DIMENSION: 1024 (embedding.ts:38)

AVAILABLE_MODELS:
┌──────────────────────────────────┬───────────┬──────────┐
│ Model                            │ Dimension │ Language │
├──────────────────────────────────┼───────────┼──────────┤
│ embed-english-v3.0               │ 1024      │ EN       │
│ embed-multilingual-v3.0          │ 1024      │ Multi    │
│ embed-english-light-v3.0         │ 384       │ EN       │
│ embed-multilingual-light-v3.0    │ 384       │ Multi    │
│ embed-english-v2.0               │ 4096      │ EN       │
│ embed-multilingual-v2.0          │ 768       │ Multi    │
└──────────────────────────────────┴───────────┴──────────┘
SOURCE: store.ts:105-112

INPUT_TYPE_ENUM: "search_query" | "search_document" | "classification" | "clustering"
  (cohere.ts:22-26)

EMBEDDING_STRATEGY:
  INDEXING (documents):
    inputType: "search_document" (process-documents.ts:289)
    embeds: chunk.text (single view, process-documents.ts:498)
    vectorId: `${docId}#${chunkIndex}` (process-documents.ts:491)
    
  RETRIEVAL (queries):
    inputType: "search_query" (four-path-search.ts:385)
    embeds: query string (single view)
    match_against: chunk.text vectors

MULTI_VIEW: NONE
  Current: Single content embedding per chunk
  No title/summary views
  No multiple embeddings per document

BATCH_PROCESSING:
  limit: 96 texts/batch (Cohere API constraint, utils.ts:180)
  default: 96 (utils.ts:180)
  implementation: embedTextsInBatches() (utils.ts:175-194)

VECTOR_ID_CONVENTION:
  format: `${docId}#${chunkIndex}` (process-documents.ts:491)
  example: "doc_abc123#0", "doc_abc123#1", ...
  scope: unique per (workspace, namespace)

CHUNKING:
  maxTokens: 512 (default, embedding.ts:46)
  overlap: 50 (default, embedding.ts:48)
  range: maxTokens ∈ [64, 4096], overlap ∈ [0, 1024], overlap < maxTokens

NAMESPACE:
  workspace.settings.embedding.namespaceName (process-documents.ts:513)
  pinecone_index: workspace.settings.embedding.indexName (embedding.ts:20 → "lightfast-v1")

COMPLEXITY: O(n/96) API calls for n texts

CALLS → embedTextsInBatches() → provider.embed()
CALLED_BY ← processDocuments workflow, fourPathSearch
═══ END T09 ═══


═══ T07: Entity Extraction Pipeline ═══
FILES: api/console/src/inngest/workflow/neural/entity-extraction-patterns.ts:L1-L210
       api/console/src/inngest/workflow/neural/llm-entity-extraction.ts:L1-L139
       api/console/src/inngest/workflow/neural/observation-capture.ts:L813-L833
       packages/console-validation/src/schemas/entities.ts:L9-L17
       packages/console-config/src/neural.ts:L16-L31

PIPELINE: Entity Extraction (3-stage: Pattern → Reference → LLM → Merge)
  ┌─ STAGE 1: Pattern-Based Extraction ──────────────────────────┐
  │  IN:  (title: string, content: string)                        │
  │  OP:  extractEntities() — regex matching on title+content     │
  │  OUT: ExtractedEntity[]  |  CARD: 0-30 per observation        │
  │  COMPLEXITY: O(|patterns| × |text|)                           │
  └───────────────────────────────────────────────────────────────┘
       ║ parallel
       ▼
  ┌─ STAGE 2: Reference-Based Extraction ────────────────────────┐
  │  IN:  ObservationReference[]                                  │
  │  OP:  extractFromReferences() — structured data mapping       │
  │  OUT: ExtractedEntity[]  |  CARD: 0-10 per observation        │
  │  COMPLEXITY: O(|references|)                                  │
  └───────────────────────────────────────────────────────────────┘
       ║ parallel (conditional: content.length ≥ 200)
       ▼
  ┌─ STAGE 3: LLM Extraction ────────────────────────────────────┐
  │  IN:  (title: string, content: string)                        │
  │  OP:  extractEntitiesWithLLM() — semantic extraction          │
  │  OUT: ExtractedEntity[]  |  CARD: 0-15 per observation        │
  │  GATE: content.length < 200 → skip                            │
  │  COMPLEXITY: O(1) LLM call, ~1-3s latency                     │
  └───────────────────────────────────────────────────────────────┘
       ║ sequential
       ▼
  ┌─ STAGE 4: Merge + Deduplication ─────────────────────────────┐
  │  IN:  [patternEntities, refEntities, llmEntities]             │
  │  OP:  Map-based dedup, sort by confidence, limit top 50       │
  │  OUT: ExtractedEntity[]  |  CARD: ≤50 per observation         │
  │  KEY: `${category}:${key.toLowerCase()}`                      │
  │  RULE: Keep highest confidence when duplicate                 │
  │  COMPLEXITY: O(n log n) for sort                              │
  └───────────────────────────────────────────────────────────────┘

═══ STAGE 1: Pattern-Based Extraction Rules ═══
┌──────────────┬─────────────────────────────────────────┬──────┬────────────┐
│ Category     │ Pattern                                 │ Conf │ Example    │
├──────────────┼─────────────────────────────────────────┼──────┼────────────┤
│ endpoint     │ (GET|POST|PUT|PATCH|DELETE)\s+(\/\S+)  │ 0.95 │ GET /users │
│ project      │ #\d{1,6}                                │ 0.95 │ #123       │
│ project      │ [A-Z]{2,10}-\d{1,6}                     │ 0.90 │ ENG-456    │
│ engineer     │ @([a-zA-Z0-9_-]{1,39})                  │ 0.90 │ @alice     │
│ config       │ [A-Z][A-Z0-9_]{2,}(?:_[A-Z0-9]+)+      │ 0.85 │ DB_URL     │
│ definition   │ src\/[^\s"'<>]+\.[a-z]{1,10}            │ 0.80 │ src/app.ts │
│ reference    │ [a-f0-9]{7,40}                          │ 0.70 │ abc1234    │
│ reference    │ branch[:\s]+([a-zA-Z0-9/_-]+)           │ 0.75 │ branch:fix │
└──────────────┴─────────────────────────────────────────┴──────┴────────────┘
SOURCE: entity-extraction-patterns.ts:L18-L86

BLACKLIST (false positive filters):
  - Pure HTTP verbs: ^(HTTP|HTTPS|GET|POST|PUT|DELETE|API|URL|ID|DB|SQL)$
  - Single chars: ^.$
  - Pure numbers: ^\d+$
SOURCE: entity-extraction-patterns.ts:L91-L98

EVIDENCE EXTRACTION:
  - Context window: ±50 chars around match
  - Truncation markers: "..." prefix/suffix if trimmed
SOURCE: entity-extraction-patterns.ts:L110-L120

═══ STAGE 2: Reference-Based Extraction Mapping ═══
┌────────────┬───────────────┬───────────────┬──────────────────┐
│ ref.type   │ → category    │ → key         │ confidence       │
├────────────┼───────────────┼───────────────┼──────────────────┤
│ issue      │ project       │ ref.id        │ 0.98             │
│ pr         │ project       │ ref.id        │ 0.98             │
│ commit     │ reference     │ ref.id[:7]    │ 0.98             │
│ branch     │ reference     │ branch:{id}   │ 0.98             │
│ assignee   │ engineer      │ @{ref.id}     │ 0.98             │
│ reviewer   │ engineer      │ @{ref.id}     │ 0.98             │
│ *          │ reference     │ ref.id        │ 0.98             │
└────────────┴───────────────┴───────────────┴──────────────────┘
SOURCE: entity-extraction-patterns.ts:L179-L198
CONFIDENCE: 0.98 (structured data) — entity-extraction-patterns.ts:L204

═══ STAGE 3: LLM Extraction ═══
MODEL: openai/gpt-5.1-instant (llm-entity-extraction.ts:L94)

PROMPT STRUCTURE:
  Input: OBSERVATION TITLE + OBSERVATION CONTENT
  Categories: engineer, project, endpoint, config, definition, service, reference
  Guidelines:
    - Only extract CLEARLY mentioned or strongly implied entities
    - Use canonical forms (lowercase, hyphenated)
    - Conservative: fewer high-confidence > many uncertain
    - Skip patterns already caught by Stage 1 (#123, @mentions, file paths)
    - Focus on contextual/semantic entities requiring understanding
  Output: Array<{category, key, value?, confidence, reasoning?}>
SOURCE: llm-entity-extraction.ts:L26-L51

EXAMPLES (entities LLM catches that regex cannot):
  - "Deployed the auth service to production" → service: auth-service
  - "Sarah and John reviewed the PR" → engineer: sarah, engineer: john
  - "Using the new caching layer" → definition: caching-layer
SOURCE: llm-entity-extraction.ts:L7-L10

FILTERING:
  - Min confidence: 0.65 (neural.ts:L21)
  - Max entities per LLM response: 15 (entities.ts:L59)
  - Min content length to trigger: 200 chars (neural.ts:L18)
  - Graceful degradation: return [] on LLM failure (llm-entity-extraction.ts:L136)

═══ STAGE 4: Merge + Deduplication ═══
DEDUP_KEY: `${category}:${key.toLowerCase()}`
  SOURCE: entity-extraction.ts:L90, observation-capture.ts:L823

CONFLICT RESOLUTION:
  IF duplicate key:
    THEN keep entity with MAX(confidence)
  SOURCE: entity-extraction.ts:L92, observation-capture.ts:L825

LIMITING:
  - Combined entities from all 3 stages
  - Sort by confidence DESC
  - Slice top 50 entities
  SOURCE: observation-capture.ts:L832

═══ ENTITY CATEGORIES (Full Enum) ═══
ENUM: EntityCategory
  engineer   → Team members, contributors (@mentions, emails)
  project    → Features, repos, tickets (#123, ENG-456)
  endpoint   → API routes (POST /api/users)
  config     → Environment variables (DATABASE_URL)
  definition → File paths, technical terms
  service    → External services, dependencies
  reference  → Generic references (commits, branches)

SOURCE: entities.ts:L9-L17
CARDINALITY: |EntityCategory| = 7

═══ CARDINALITY BOUNDS ═══
MAX_ENTITIES_PER_OBSERVATION = 50 (entity-extraction.ts:L31, observation-capture.ts:L832)

TYPICAL YIELD (estimated from code):
  Pattern-based: 0-30 entities
  Reference-based: 0-10 entities
  LLM-based: 0-15 entities (capped in schema, entities.ts:L59)
  Post-merge: ≤50 entities (hard limit)

COMPLEXITY: O(|patterns| × |text|) + O(|refs|) + O(LLM) + O(n log n)
            ≈ O(|text|) dominant factor for pattern stage
            + 1-3s LLM latency (when triggered)

CALLS → extractEntities() (entity-extraction-patterns.ts:L129)
        extractFromReferences() (entity-extraction-patterns.ts:L170)
        extractEntitiesWithLLM() (llm-entity-extraction.ts:L68)
        
CALLED_BY ← observation-capture.ts:L813 (inline, parallel with embeddings)
═══ END T07 ═══


---

## Extraction Summary (Tasks 4-9)

| Task | Target | Status | Details |
|------|--------|--------|---------|
| T04  | Neural schema tables | ✓ | 5 tables extracted: observations, entities, relationships, clusters, actor profiles |
| T05  | assignToCluster algorithm | ✓ | Incremental nearest-centroid with Pinecone vector similarity |
| T06  | scoreSignificance scoring | ✓ | Heuristic formula: base + signals + refs + content, threshold=40 |
| T07  | Entity extraction pipeline | ✓ | 4-stage: pattern→reference→LLM→merge, 7 categories, max 50/observation |
| T08  | Reranking implementations | ✓ | 3 modes: identity, cross-encoder, LLM-fusion |
| T09  | Embedding configuration | ✓ | Single-view strategy, 6 Cohere models, batch=96, default=v3.0@1024d |

**Total extractions**: 6 tasks  
**Completed**: 6 / 6


═══ T10: Pinecone Client Configuration ═══
FILES: vendor/pinecone/src/client.ts:1-348, packages/console-pinecone/src/client.ts:1-195, packages/console-validation/src/constants/embedding.ts:1-72, packages/console-config/src/private-config.ts:1-394, db/console/src/utils/workspace.ts:18-47, api/console/src/inngest/workflow/neural/observation-capture.ts:63-79

INDEX:
  NAME: "lightfast-v1" (embedding.ts:20)
  TYPE: Serverless (client.ts:54)
  CLOUD: "aws" (embedding.ts:24)
  REGION: "us-east-1" (embedding.ts:26)
  METRIC: "cosine" (embedding.ts:22, client.ts:43)
  DIMENSION: 1024 (embedding.ts:38)

ARCHITECTURE:
  PATTERN: Shared index, isolated namespaces per workspace
  NAMESPACE_FORMAT: "{clerkOrgId}:ws_{workspaceId}"
    Example: "org_abc123:ws_xyz789" (workspace.ts:22)
    Transform: lowercase, [^a-z0-9_-] → "", slice(0,50) (workspace.ts:28-30)
  MAX_NAMESPACES: 25,000 (private-config.ts:55)
  COST_MODEL: $50/month (shared) vs $7,500+/month (per-workspace indexes) (private-config.ts:52)

METADATA SCHEMA:
┌──────────────────┬─────────┬────────────────────────────────────────────┐
│ Field            │ Type    │ Purpose                                    │
├──────────────────┼─────────┼────────────────────────────────────────────┤
│ layer            │ string  │ "observations" | "documents" | "clusters"  │
│                  │         │ | "profiles" — vector layer filter         │
│ view             │ string  │ "title" | "content" | "summary" —          │
│                  │         │ multi-view retrieval (observation-capture) │
│ observationType  │ string  │ observation type enum                      │
│ source           │ string  │ source system (e.g., "github")             │
│ sourceType       │ string  │ event type (e.g., "pr.opened")             │
│ sourceId         │ string  │ unique source ID (e.g., "pr:org/repo#123") │
│ title            │ string  │ observation title                          │
│ snippet          │ string  │ preview text                               │
│ occurredAt       │ string  │ ISO8601 timestamp (filterable)             │
│ actorName        │ string  │ actor identifier (filterable)              │
│ observationId    │ string  │ database nanoid (direct lookup)            │
└──────────────────┴─────────┴────────────────────────────────────────────┘

QUERY FILTERS:
  layer = { $eq: "observations" } (four-path-search.ts:276,280)
  source = { $in: [sourceTypes] } (four-path-search.ts:284)
  observationType = { $in: [types] } (four-path-search.ts:288)
  actorName = { $in: [names] } (four-path-search.ts:292)
  occurredAt = { $gte: start, $lte: end } (four-path-search.ts:296-303)

BATCH SIZES:
  UPSERT: 100 vectors/batch (private-config.ts:112)
  DELETE: 100 vector IDs/batch (private-config.ts:122)
  EMBED: 96 texts/batch (private-config.ts:193, Cohere limit)

EMBEDDING:
  PROVIDER: "cohere" (embedding.ts:34)
  MODEL: "embed-english-v3.0" (embedding.ts:36)
  DIMENSION: 1024 (embedding.ts:38)

OPERATIONS:
  query(indexName, { vector, topK, filter }, namespace?) → { matches: [{id, score, metadata}] }
    - Targets namespace if provided (client.ts:224)
    - includeMetadata: true (default, client.ts:231)
  
  upsertVectors(indexName, { ids, vectors, metadata }, batchSize=100, namespace?)
    - Batches automatically (client.ts:116-127)
    - Returns { upsertedCount } (client.ts:130)
  
  deleteVectors(indexName, vectorIds[], batchSize=100, namespace?)
    - Batched deletion (client.ts:156-159)
  
  deleteByMetadata(indexName, filter, namespace?)
    - Deletes matching filter (client.ts:181)

COMPLEXITY:
  query: O(log n) (ANN, serverless)
  upsert: O(k·b) where k=vectors, b=batchSize
  delete: O(k·b) where k=IDs, b=batchSize

CONSTANTS:
  INDEX_NAME = "lightfast-v1" (embedding.ts:20)
  METRIC = "cosine" (embedding.ts:22)
  CLOUD = "aws" (embedding.ts:24)
  REGION = "us-east-1" (embedding.ts:26)
  DIMENSION = 1024 (embedding.ts:38)
  UPSERT_BATCH_SIZE = 100 (private-config.ts:112)
  DELETE_BATCH_SIZE = 100 (private-config.ts:122)
  EMBED_BATCH_SIZE = 96 (private-config.ts:193)
  MAX_INDEX_NAME_LENGTH = 45 (private-config.ts:132)
  DELETION_PROTECTION = "enabled" (private-config.ts:102)

CALLS → 
  new Pinecone({apiKey}) (client.ts:24)
  @pinecone-database/pinecone (client.ts:7)

CALLED_BY ←
  fourPathSearch() (four-path-search.ts)
  searchClusters() (cluster-search.ts)
  observation-capture workflow (observation-capture.ts)
  document processing workflows

NAMESPACE_ISOLATION:
  PHYSICAL: Serverless architecture provides compute isolation (private-config.ts:54)
  LOGICAL: Namespace prefix prevents cross-workspace access (workspace.ts:24-30)
  ENV_SEPARATION: Pinecone project-level (different API keys for prod/dev) (private-config.ts:48-49)
═══ END T10 ═══


═══ T14: SourceEvent Types + Webhook Transformers ═══
FILES: packages/console-types/src/neural/source-event.ts:1-77, packages/console-webhooks/src/transformers/github.ts:1-524, packages/console-webhooks/src/transformers/vercel.ts:1-166, packages/console-webhooks/src/transformers/sentry.ts:1-582, packages/console-webhooks/src/transformers/linear.ts:1-841

SCHEMA: SourceEvent

┌──────────────┬──────────────────────────────────┬──────────┬──────────────────────────────────────┐
│ Field        │ Type                             │ Nullable │ Description                          │
├──────────────┼──────────────────────────────────┼──────────┼──────────────────────────────────────┤
│ source       │ SourceType                       │ N        │ github | vercel | sentry | linear   │
│ sourceType   │ string                           │ N        │ kebab-case: "pull-request.opened"    │
│ sourceId     │ string                           │ N        │ Unique ID: "pr:owner/repo#123"       │
│ title        │ string                           │ N        │ ≤120 chars embeddable headline       │
│ body         │ string                           │ N        │ Full semantic content for embedding  │
│ actor        │ SourceActor                      │ Y        │ Who performed the action             │
│ occurredAt   │ string (ISO)                     │ N        │ ISO timestamp                        │
│ references   │ SourceReference[]                │ N        │ Relationship graph (PRs, issues...)  │
│ metadata     │ Record<string, unknown>          │ N        │ Source-specific structured data      │
└──────────────┴──────────────────────────────────┴──────────┴──────────────────────────────────────┘

SOURCE: packages/console-types/src/neural/source-event.ts:7-37

SCHEMA: SourceActor

┌───────────┬─────────┬──────────┬─────────────────────────────────────┐
│ Field     │ Type    │ Nullable │ Description                         │
├───────────┼─────────┼──────────┼─────────────────────────────────────┤
│ id        │ string  │ N        │ Source-specific ID (GitHub user ID) │
│ name      │ string  │ N        │ Display name                        │
│ email     │ string  │ Y        │ For cross-source identity linking   │
│ avatarUrl │ string  │ Y        │ Avatar image URL                    │
└───────────┴─────────┴──────────┴─────────────────────────────────────┘

SOURCE: packages/console-types/src/neural/source-event.ts:42-47

SCHEMA: SourceReference

┌───────┬────────────────────────────────────────────────────────────────────────────────────┬──────────┬────────────────────────┐
│ Field │ Type                                                                               │ Nullable │ Description            │
├───────┼────────────────────────────────────────────────────────────────────────────────────┼──────────┼────────────────────────┤
│ type  │ "commit"|"branch"|"pr"|"issue"|"deployment"|"project"|"cycle"|"assignee"|         │ N        │ Relationship type      │
│       │ "reviewer"|"team"|"label"                                                          │          │                        │
│ id    │ string                                                                             │ N        │ Entity identifier      │
│ url   │ string                                                                             │ Y        │ Entity URL             │
│ label │ string                                                                             │ Y        │ Qualifier: "fixes"...  │
└───────┴────────────────────────────────────────────────────────────────────────────────────┴──────────┴────────────────────────┘

SOURCE: packages/console-types/src/neural/source-event.ts:52-68

SCHEMA: TransformContext

┌────────────┬────────┬──────────┬──────────────────────────┐
│ Field      │ Type   │ Nullable │ Description              │
├────────────┼────────┼──────────┼──────────────────────────┤
│ deliveryId │ string │ N        │ Webhook delivery ID      │
│ receivedAt │ Date   │ N        │ When webhook was received│
└────────────┴────────┴──────────┴──────────────────────────┘

SOURCE: packages/console-types/src/neural/source-event.ts:73-76

ENUMERATION: GitHub Webhook Event → SourceType Mapping

┌──────────────────────┬────────────────────────────┬─────────────────────────────────────────┬──────────────────────────────────┐
│ Webhook Event        │ sourceType                 │ Transformer                             │ Source                           │
├──────────────────────┼────────────────────────────┼─────────────────────────────────────────┼──────────────────────────────────┤
│ push                 │ "push"                     │ transformGitHubPush                     │ github.ts:37-110                 │
│ pull_request.opened  │ "pull-request.opened"      │ transformGitHubPullRequest              │ github.ts:115-252                │
│ pull_request.closed  │ "pull-request.closed"      │   (merged → "pull-request.merged")      │ github.ts:206-213                │
│ pull_request.reopened│ "pull-request.reopened"    │                                         │                                  │
│ pull_request.*       │ "pull-request.{action}"    │                                         │                                  │
│ issues.opened        │ "issue.opened"             │ transformGitHubIssue                    │ github.ts:257-336                │
│ issues.closed        │ "issue.closed"             │                                         │                                  │
│ issues.reopened      │ "issue.reopened"           │                                         │                                  │
│ release.published    │ "release.published"        │ transformGitHubRelease                  │ github.ts:341-403                │
│ discussion.created   │ "discussion.created"       │ transformGitHubDiscussion               │ github.ts:408-472                │
│ discussion.answered  │ "discussion.answered"      │                                         │                                  │
└──────────────────────┴────────────────────────────┴─────────────────────────────────────────┴──────────────────────────────────┘

CARDINALITY: |GitHub Events| = 10 sourceType values

ENUMERATION: Vercel Webhook Event → SourceType Mapping

┌────────────────────────────────┬────────────────────────────┬─────────────────────────┬──────────────────┐
│ Webhook Event                  │ sourceType                 │ Transformer             │ Source           │
├────────────────────────────────┼────────────────────────────┼─────────────────────────┼──────────────────┤
│ deployment.created             │ "deployment.created"       │ transformVercelDeployment│ vercel.ts:17-161 │
│ deployment.succeeded           │ "deployment.succeeded"     │                         │                  │
│ deployment.ready               │ "deployment.ready"         │                         │                  │
│ deployment.canceled            │ "deployment.canceled"      │                         │                  │
│ deployment.error               │ "deployment.error"         │                         │                  │
│ deployment.check-rerequested   │ "deployment.check-req..."  │                         │                  │
└────────────────────────────────┴────────────────────────────┴─────────────────────────┴──────────────────┘

CARDINALITY: |Vercel Events| = 6 sourceType values

ENUMERATION: Sentry Webhook Event → SourceType Mapping

┌─────────────────────┬────────────────────────┬──────────────────────────┬──────────────────┐
│ Webhook Event       │ sourceType             │ Transformer              │ Source           │
├─────────────────────┼────────────────────────┼──────────────────────────┼──────────────────┤
│ issue.created       │ "issue.created"        │ transformSentryIssue     │ sentry.ts:247-359│
│ issue.resolved      │ "issue.resolved"       │                          │                  │
│ issue.assigned      │ "issue.assigned"       │                          │                  │
│ issue.ignored       │ "issue.ignored"        │                          │                  │
│ error               │ "error"                │ transformSentryError     │ sentry.ts:364-441│
│ event_alert         │ "event-alert"          │ transformSentryEventAlert│ sentry.ts:446-498│
│ metric_alert        │ "metric-alert"         │ transformSentryMetricAlert│sentry.ts:503-560│
└─────────────────────┴────────────────────────┴──────────────────────────┴──────────────────┘

CARDINALITY: |Sentry Events| = 7 sourceType values

ENUMERATION: Linear Webhook Event → SourceType Mapping

┌──────────────────────┬───────────────────────────┬────────────────────────────┬──────────────────┐
│ Webhook Event        │ sourceType                │ Transformer                │ Source           │
├──────────────────────┼───────────────────────────┼────────────────────────────┼──────────────────┤
│ Issue.create         │ "issue.created"           │ transformLinearIssue       │ linear.ts:346-509│
│ Issue.update         │ "issue.updated"           │                            │                  │
│ Issue.remove         │ "issue.deleted"           │                            │                  │
│ Comment.create       │ "comment.created"         │ transformLinearComment     │ linear.ts:514-576│
│ Comment.update       │ "comment.updated"         │                            │                  │
│ Comment.remove       │ "comment.deleted"         │                            │                  │
│ Project.create       │ "project.created"         │ transformLinearProject     │ linear.ts:581-673│
│ Project.update       │ "project.updated"         │                            │                  │
│ Project.remove       │ "project.deleted"         │                            │                  │
│ Cycle.create         │ "cycle.created"           │ transformLinearCycle       │ linear.ts:679-750│
│ Cycle.update         │ "cycle.updated"           │                            │                  │
│ Cycle.remove         │ "cycle.deleted"           │                            │                  │
│ ProjectUpdate.create │ "project-update.created"  │ transformLinearProjectUpdate│linear.ts:756-823│
│ ProjectUpdate.update │ "project-update.updated"  │                            │                  │
│ ProjectUpdate.remove │ "project-update.deleted"  │                            │                  │
└──────────────────────┴───────────────────────────┴────────────────────────────┴──────────────────┘

CARDINALITY: |Linear Events| = 15 sourceType values

METADATA FIELDS BY SOURCE:

GITHUB:
  deliveryId, repoFullName, repoId, branch, beforeSha, afterSha, commitCount, fileCount, forced (push)
  prNumber, action, merged, draft, additions, deletions, changedFiles, headRef, baseRef, headSha (PR)
  issueNumber, action, state (issue)
  tagName, targetCommitish, prerelease, draft (release)
  discussionNumber, action, category, answered (discussion)
  (github.ts:89-100, 226-242, 317-326, 382-393, 452-462)

VERCEL:
  deliveryId, webhookId, deploymentId, deploymentUrl, projectId, projectName, teamId, environment, branch, region,
  gitCommitSha, gitCommitRef, gitCommitMessage, gitCommitAuthor, gitRepo, gitOrg
  (vercel.ts:130-147)

SENTRY:
  deliveryId, issueId, shortId, projectId, projectSlug, projectName, level, platform, errorType, errorValue,
  filename, function, culprit, count, userCount, firstSeen, lastSeen, status, action, installationId (issue)
  eventId, projectId, platform, errorType, errorValue, filename, function, location, culprit, tags, sdkName,
  sdkVersion, webUrl, installationId (error)
  eventId, projectId, triggeredRule, platform, errorType, errorValue, webUrl, installationId (event_alert)
  alertId, alertRuleId, alertRuleName, organizationId, query, aggregate, timeWindow, thresholdType,
  resolveThreshold, dateStarted, dateDetected, dateClosed, action, installationId (metric_alert)
  (sentry.ts:329-349, 415-431, 478-488, 534-550)

LINEAR:
  deliveryId, issueId, identifier, number, teamId, teamKey, teamName, stateId, stateName, stateType,
  priority, priorityLabel, estimate, projectId, projectName, cycleId, cycleName, assigneeId, assigneeName,
  labels, branchName, dueDate, startedAt, completedAt, canceledAt, action, organizationId, webhookId, updatedFrom (issue)
  commentId, issueId, issueIdentifier, issueTitle, parentCommentId, editedAt, action, organizationId, webhookId (comment)
  projectId, projectName, slugId, state, progress, scope, targetDate, startDate, startedAt, completedAt,
  canceledAt, leadId, leadName, teamIds, memberIds, action, organizationId, webhookId (project)
  cycleId, cycleNumber, cycleName, teamId, teamKey, teamName, startsAt, endsAt, completedAt, progress, scope,
  action, organizationId, webhookId (cycle)
  updateId, projectId, projectName, health, editedAt, action, organizationId, webhookId (project_update)
  (linear.ts:469-499, 555-566, 644-664, 725-741, 803-813)

CONSTANTS:
  TITLE_MAX_LENGTH = 120 (source-event.ts:23)
  SANITIZATION = title ≤120 chars, body = full content (github.ts:75-76, vercel.ts:118-119, sentry.ts:319-320, linear.ts:457-458)

COMPLEXITY: O(1) per transformation | O(n) reference extraction where n = |relationships|

RELATIONSHIP EXTRACTION PATTERNS:
  GitHub: commit, branch, PR, issue (via regex: fixes #123, LIN-892), reviewer, assignee, label, merge_commit_sha
    (github.ts:44-189)
  Vercel: commit (githubCommitSha), branch (githubCommitRef), PR (githubPrId), deployment, project
    (vercel.ts:35-78)
  Sentry: issue (shortId), project, assignee, commit (from statusDetails.inCommit)
    (sentry.ts:254-286)
  Linear: issue, team, project, cycle, assignee, label, branch, GitHub PR attachment, Sentry issue attachment
    (linear.ts:353-428)

CALLS → validateSourceEvent (validation.js), sanitizeTitle (sanitize.js), sanitizeBody (sanitize.js), toExternalGitHubEventType, toExternalVercelEventType, toExternalSentryEventType, toExternalLinearEventType (@repo/console-types)
CALLED_BY ← apps/console/src/app/(github)/api/github/webhooks/route.ts:214-446, apps/console/src/app/(vercel)/api/vercel/webhooks/route.ts:78
═══ END T14 ═══


═══ T13: MCP Server/Tool Definitions ═══
FILES: core/mcp/src/server.ts:1-111, packages/console-ai/src/workspace-search.ts:1-64, packages/console-ai/src/workspace-contents.ts:1-37, packages/console-ai/src/workspace-find-similar.ts:1-51, packages/console-ai/src/workspace-graph.ts:1-51, packages/console-ai/src/workspace-related.ts:1-44, packages/console-types/src/api/v1/search.ts:1-247, packages/console-types/src/api/v1/contents.ts:1-62, packages/console-types/src/api/v1/findsimilar.ts:1-142, packages/console-types/src/api/v1/graph.ts:1-119

MCP SERVER: lightfast-mcp
VERSION: __SDK_VERSION__
TRANSPORT: StdioServerTransport (server.ts:105)
SDK: @modelcontextprotocol/sdk@1.20.1

┌──────────────────────────────────────────────────────────────────────────────────┐
│ TOOL DEFINITIONS (5 tools)                                                       │
└──────────────────────────────────────────────────────────────────────────────────┘

─── TOOL 1: lightfast_search ───────────────────────────────────────────────────────
NAME: lightfast_search (server.ts:36)
DESC: "Search through workspace neural memory for relevant documents and observations. 
       Returns semantically relevant results with scores, snippets, and metadata." 
       (server.ts:37)

MAPS_TO: Lightfast.search() → V1 Search API (workspace-search.ts:53)

INPUT SCHEMA (V1SearchRequestSchema):
┌───────────────────┬──────────────────┬──────────┬──────────────┬────────────────┐
│ Field             │ Type             │ Required │ Default      │ Range          │
├───────────────────┼──────────────────┼──────────┼──────────────┼────────────────┤
│ query             │ string           │ Y        │ —            │ min: 1 char    │
│ limit             │ int              │ N        │ 10           │ [1, 100]       │
│ offset            │ int              │ N        │ 0            │ [0, ∞)         │
│ mode              │ enum             │ N        │ "balanced"   │ {fast,         │
│                   │                  │          │              │  balanced,     │
│                   │                  │          │              │  thorough}     │
│ filters           │ object           │ N        │ —            │ see below      │
│ includeContext    │ boolean          │ N        │ true         │ {true, false}  │
│ includeHighlights │ boolean          │ N        │ true         │ {true, false}  │
└───────────────────┴──────────────────┴──────────┴──────────────┴────────────────┘

FILTERS SUBSCHEMA (search.ts:21-35):
  sourceTypes: string[] | undefined     // ["github", "linear", ...] (search.ts:23)
  observationTypes: string[] | undefined // ["commit", "issue", ...] (search.ts:25)
  actorNames: string[] | undefined       // ["@sarah", "@mike", ...] (search.ts:27)
  dateRange: { start?: datetime, end?: datetime } | undefined (search.ts:29-34)

MODE VALUES (search.ts:15):
  "fast"      → No reranking, vector scores only (~50ms) (search.ts:11)
  "balanced"  → Cohere rerank (~130ms) (search.ts:12)
  "thorough"  → LLM-based scoring (~600ms) (search.ts:13)

OUTPUT SCHEMA (V1SearchResponseSchema → search.ts:233-244):
  data: V1SearchResult[]
    ├─ id: string (obs_* | doc_*)
    ├─ title: string
    ├─ url: string
    ├─ snippet: string
    ├─ score: number (0-1 combined relevance)
    ├─ source: string (github | linear | vercel | sentry)
    ├─ type: string (commit | pull_request | issue | deployment)
    ├─ occurredAt?: datetime
    ├─ entities?: {key: string, category: string}[]
    ├─ references?: {type: string, id: string, url?: string, label?: string}[]
    └─ highlights?: {title?: string, snippet?: string}
  
  context?: V1SearchContext (if includeContext=true)
    ├─ clusters?: {topic: string?, summary: string?, keywords: string[]}[]
    └─ relevantActors?: {displayName: string, expertiseDomains: string[]}[]
  
  meta: V1SearchMeta
    ├─ total: int (total matches before pagination)
    ├─ limit: int
    ├─ offset: int
    ├─ took: number (ms)
    ├─ mode: enum {fast, balanced, thorough}
    └─ paths: {vector: bool, entity: bool, cluster: bool, actor: bool}
  
  latency: V1SearchLatency (see T6 for details)
  requestId: string (UUID)

─── TOOL 2: lightfast_contents ─────────────────────────────────────────────────────
NAME: lightfast_contents (server.ts:48)
DESC: "Fetch full content for documents and observations by their IDs. 
       Returns complete content including metadata." (server.ts:50)

MAPS_TO: Lightfast.contents() → V1 Contents API (workspace-contents.ts:27)

INPUT SCHEMA (V1ContentsRequestSchema → contents.ts:12-19):
┌───────────────────┬──────────────────┬──────────┬──────────────┬────────────────┐
│ Field             │ Type             │ Required │ Default      │ Range          │
├───────────────────┼──────────────────┼──────────┼──────────────┼────────────────┤
│ ids               │ string[]         │ Y        │ —            │ [1, 50]        │
└───────────────────┴──────────────────┴──────────┴──────────────┴────────────────┘

OUTPUT SCHEMA (V1ContentsResponseSchema → contents.ts:52-59):
  items: V1ContentItem[]
    ├─ id: string (doc_* | obs_*)
    ├─ title: string?
    ├─ url: string
    ├─ snippet: string
    ├─ content?: string (observations only)
    ├─ source: string (github | linear | vercel)
    ├─ type: string (pull_request | issue | file | deployment)
    ├─ occurredAt?: datetime
    └─ metadata?: Record<string, unknown>
  
  missing: string[] (IDs not found)
  requestId: string

─── TOOL 3: lightfast_find_similar ─────────────────────────────────────────────────
NAME: lightfast_find_similar (server.ts:65)
DESC: "Find content semantically similar to a given document or URL. Either 'id' or 
       'url' must be provided. Returns similar items with similarity scores." 
       (server.ts:66)

MAPS_TO: Lightfast.findSimilar() → V1 FindSimilar API (workspace-find-similar.ts:40)

VALIDATION: .refine((data) => id || url, "Either id or url must be provided") 
            (findsimilar.ts:56-58, server.ts:70)

INPUT SCHEMA (V1FindSimilarRequestSchema → findsimilar.ts:13-58):
┌───────────────────┬──────────────────┬──────────┬──────────────┬────────────────┐
│ Field             │ Type             │ Required │ Default      │ Range          │
├───────────────────┼──────────────────┼──────────┼──────────────┼────────────────┤
│ id                │ string           │ Y*       │ —            │ doc_* | obs_*  │
│ url               │ string (URL)     │ Y*       │ —            │ valid URL      │
│ limit             │ int              │ N        │ 10           │ [1, 50]        │
│ threshold         │ number           │ N        │ 0.5          │ [0, 1]         │
│ sameSourceOnly    │ boolean          │ N        │ false        │ {true, false}  │
│ excludeIds        │ string[]         │ N        │ —            │ —              │
│ filters           │ object           │ N        │ —            │ (same as       │
│                   │                  │          │              │  search)       │
└───────────────────┴──────────────────┴──────────┴──────────────┴────────────────┘
* Either id OR url required (XOR constraint)

OUTPUT SCHEMA (V1FindSimilarResponseSchema → findsimilar.ts:118-139):
  source: V1FindSimilarSource
    ├─ id: string
    ├─ title: string
    ├─ type: string
    └─ cluster?: {topic: string?, memberCount: int}
  
  similar: V1FindSimilarResult[]
    ├─ id: string
    ├─ title: string
    ├─ url: string
    ├─ snippet?: string
    ├─ score: number (combined 0-1)
    ├─ vectorSimilarity: number (raw vector sim)
    ├─ entityOverlap?: number (0-1)
    ├─ sameCluster: boolean
    ├─ source: string
    ├─ type: string
    └─ occurredAt?: datetime
  
  meta:
    ├─ total: int
    ├─ took: number (ms)
    └─ inputEmbedding: {found: bool, generated: bool}
  
  requestId: string

─── TOOL 4: lightfast_graph ────────────────────────────────────────────────────────
NAME: lightfast_graph (server.ts:80)
DESC: "Traverse the relationship graph from a starting observation. Returns connected 
       observations with relationship edges. Supports depth control (1-3) and 
       relationship type filtering." (server.ts:81)

MAPS_TO: Lightfast.graph() → V1 Graph API (workspace-graph.ts:40)

INPUT SCHEMA (V1GraphRequestSchema → graph.ts:12-16):
┌───────────────────┬──────────────────┬──────────┬──────────────┬────────────────┐
│ Field             │ Type             │ Required │ Default      │ Range          │
├───────────────────┼──────────────────┼──────────┼──────────────┼────────────────┤
│ id                │ string           │ Y        │ —            │ obs_*          │
│ depth             │ int              │ N        │ 2            │ [1, 3]         │
│ types             │ string[]         │ N        │ —            │ relationship   │
│                   │                  │          │              │ type filters   │
└───────────────────┴──────────────────┴──────────┴──────────────┴────────────────┘

OUTPUT SCHEMA (GraphResponseSchema → graph.ts:60-78):
  data:
    ├─ root: {id: string, title: string, source: string, type: string}
    ├─ nodes: GraphNode[]
    │    ├─ id: string
    │    ├─ title: string
    │    ├─ source: string
    │    ├─ type: string
    │    ├─ occurredAt: string?
    │    ├─ url: string?
    │    └─ isRoot?: boolean
    └─ edges: GraphEdge[]
         ├─ source: string (node ID)
         ├─ target: string (node ID)
         ├─ type: string (relationship type)
         ├─ linkingKey: string?
         └─ confidence: number
  
  meta:
    ├─ depth: int (actual depth traversed)
    ├─ nodeCount: int
    ├─ edgeCount: int
    └─ took: number (ms)
  
  requestId: string

─── TOOL 5: lightfast_related ──────────────────────────────────────────────────────
NAME: lightfast_related (server.ts:92)
DESC: "Find observations directly connected to a given observation via relationships. 
       Returns related events grouped by source system with relationship types and 
       directions." (server.ts:94)

MAPS_TO: Lightfast.related() → V1 Related API (workspace-related.ts:33)

INPUT SCHEMA (V1RelatedRequestSchema → graph.ts:23-26):
┌───────────────────┬──────────────────┬──────────┬──────────────┬────────────────┐
│ Field             │ Type             │ Required │ Default      │ Range          │
├───────────────────┼──────────────────┼──────────┼──────────────┼────────────────┤
│ id                │ string           │ Y        │ —            │ obs_*          │
│ limit             │ int              │ N        │ 20           │ [1, 50]        │
└───────────────────┴──────────────────┴──────────┴──────────────┴────────────────┘

OUTPUT SCHEMA (RelatedResponseSchema → graph.ts:101-116):
  data:
    ├─ source: {id: string, title: string, source: string}
    ├─ related: RelatedEvent[]
    │    ├─ id: string
    │    ├─ title: string
    │    ├─ source: string
    │    ├─ type: string
    │    ├─ occurredAt: string?
    │    ├─ url: string?
    │    ├─ relationshipType: string (refs | closes | triggers | ...)
    │    └─ direction: enum {outgoing, incoming}
    └─ bySource: Record<string, RelatedEvent[]> (grouped by source system)
  
  meta:
    ├─ total: int
    └─ took: number (ms)
  
  requestId: string

┌──────────────────────────────────────────────────────────────────────────────────┐
│ TOOL FACTORY PATTERN                                                             │
└──────────────────────────────────────────────────────────────────────────────────┘

CONSOLE AI TOOLS: createTool<LightfastAnswerRuntimeContext, TInput, TOutput>
  (workspace-search.ts:1, workspace-contents.ts:1, workspace-find-similar.ts:1,
   workspace-graph.ts:1, workspace-related.ts:1)

HANDLER INJECTION PATTERN:
  execute: async (input, context) => {
    const handler = context.tools?.workspaceSearch?.handler;
    if (!handler) throw Error("Handler not configured");
    return handler(input);
  }

RUNTIME CONTEXT TYPE (console-ai-types/src/index.ts:183-202):
  interface AnswerToolRuntimeConfig {
    workspaceSearch?: { handler: SearchToolHandler };
    workspaceContents?: { handler: ContentsToolHandler };
    workspaceFindSimilar?: { handler: FindSimilarToolHandler };
    workspaceGraph?: { handler: GraphToolHandler };
    workspaceRelated?: { handler: RelatedToolHandler };
  }

  interface AnswerAppRuntimeContext {
    userId?: string;
    workspaceId: string;
    authToken?: string;
    tools?: AnswerToolRuntimeConfig;
  }

┌──────────────────────────────────────────────────────────────────────────────────┐
│ SEARCH MODE CLASSIFICATION                                                       │
└──────────────────────────────────────────────────────────────────────────────────┘

MODE ENUM: {fast, balanced, thorough} (search.ts:15)

LATENCY TARGETS:
  fast      → ~50ms   | vector scores only, no reranking
  balanced  → ~130ms  | Cohere rerank (default)
  thorough  → ~600ms  | LLM-based scoring

ROUTING LOGIC: None (user-specified in request.mode)
DEFAULT: "balanced" (search.ts:64)

┌──────────────────────────────────────────────────────────────────────────────────┐
│ CONSTANTS                                                                        │
└──────────────────────────────────────────────────────────────────────────────────┘

LIMITS:
  search.limit          = [1, 100] default 10 (search.ts:49-55)
  contents.ids          = [1, 50] (contents.ts:17)
  findSimilar.limit     = [1, 50] default 10 (findsimilar.ts:27-33)
  findSimilar.threshold = [0, 1] default 0.5 (findsimilar.ts:35-40)
  graph.depth           = [1, 3] default 2 (graph.ts:14)
  graph.limit           = [1, 50] default 20 (workspace-graph.ts:19-25)
  related.limit         = [1, 50] default 20 (workspace-related.ts:12-18)

COMPLEXITY: O(1) tool routing (static MCP registration), 
            O(N) handler execution (see T1-T5 for individual tool complexity)

CALLS → Lightfast SDK methods (lightfast.search, .contents, .findSimilar, .graph, .related)
        → API routes /v1/search, /v1/contents, /v1/findsimilar, /v1/graph, /v1/related
CALLED_BY ← MCP client (Claude Desktop, IDEs), AI agents (via tool execution)
═══ END T13 ═══


═══ T11: Observation Capture Pipeline + Event Type Filtering ═══
FILES: packages/console-types/src/integrations/event-types.ts:L1-L678,
       api/console/src/inngest/workflow/neural/observation-capture.ts:L1-L1242,
       api/console/src/inngest/workflow/neural/scoring.ts:L1-L119

PIPELINE: Observation Capture (Write Path)

  ┌─ STAGE 0: Job Creation ────────────────────────────────────┐
  │  IN:  NeuralObservationCaptureInput                         │
  │  OP:  Generate replay-safe IDs + create job record         │
  │  OUT: { jobId, externalId, startTime, clerkOrgId }          │
  │  IMPL: observation-capture.ts:432-476                       │
  └─────────────────────────────────────────────────────────────┘
       │ sequential
       ▼
  ┌─ STAGE 1: Duplicate Check ─────────────────────────────────┐
  │  IN:  { workspaceId, sourceId }                             │
  │  OP:  Query workspace_neural_observations by composite key  │
  │  OUT: Observation | null                                    │
  │  GATE: IF EXISTS → exit("duplicate")                        │
  │  IMPL: observation-capture.ts:479-531                       │
  │  QUERY: INDEX(workspaceId, sourceId)                        │
  │  EXIT: completeJob(status="completed", reason="duplicate")  │
  └─────────────────────────────────────────────────────────────┘
       │ sequential
       ▼
  ┌─ STAGE 2: Event Allowed Check ────────────────────────────┐
  │  IN:  { sourceEvent, workspaceId }                          │
  │  OP:  Extract resourceId from metadata → lookup integration│
  │  FILTER LOGIC:                                              │
  │    1. Extract resourceId per source:                        │
  │       github  → repoId                                      │
  │       vercel  → projectId                                   │
  │       sentry  → projectId                                   │
  │       linear  → teamId                                      │
  │    2. IF !resourceId → REJECT (no config)                   │
  │    3. Query workspace_integrations:                         │
  │       WHERE workspaceId = ? AND providerResourceId = ?      │
  │    4. IF !integration → REJECT (resource not connected)     │
  │    5. Map sourceType → baseEventType via getBaseEventType() │
  │    6. IF baseEventType ∉ sourceConfig.sync.events → REJECT  │
  │  OUT: boolean (allowed)                                     │
  │  GATE: IF !allowed → exit("event_not_allowed")              │
  │  IMPL: observation-capture.ts:534-635                       │
  │  EXIT: completeJob(status="completed", reason="event_not_…")│
  └─────────────────────────────────────────────────────────────┘
       │ sequential
       ▼
  ┌─ STAGE 3: Significance Scoring (GATE) ─────────────────────┐
  │  IN:  SourceEvent                                           │
  │  OP:  scoreSignificance(sourceEvent) → SignificanceResult   │
  │  SCORING FORMULA:                                           │
  │    score = baseWeight(eventType)                            │
  │          + Σ signalWeight(contentPattern)                   │
  │          + min(refCount × 3, 15)                            │
  │          + contentBonus(bodyLength)                         │
  │    clamp(score, 0, 100)                                     │
  │  GATE: IF score < 40 → exit("below_threshold")              │
  │  OUT: { score: number, factors: string[] }                  │
  │  IMPL: observation-capture.ts:638-688, scoring.ts:78-118    │
  │  EXIT: completeJob(status="completed", reason="below_thres…")│
  └─────────────────────────────────────────────────────────────┘
       │ sequential
       ▼
  ┌─ STAGE 4: Fetch Workspace Context ─────────────────────────┐
  │  IN:  workspaceId                                           │
  │  OP:  Query orgWorkspaces → settings (embedding config)     │
  │  OUT: Workspace (with settings.embedding)                   │
  │  IMPL: observation-capture.ts:691-706                       │
  └─────────────────────────────────────────────────────────────┘
       │ sequential → PARALLEL FORK (3 branches)
       ▼
  ┌─ STAGE 5a: Classification (Claude Haiku) ──────────────────┐
  │  IN:  SourceEvent                                           │
  │  OP:  LLM generateObject(prompt=classificationPrompt)       │
  │  OUT: { topics[], classification }                          │
  │  FALLBACK: regex-based classifyObservationFallback()        │
  │  IMPL: observation-capture.ts:709-764                       │
  └─────────────────────────────────────────────────────────────┘

  ┌─ STAGE 5b: Multi-View Embedding ────────────────────────────┐
  │  IN:  { title, body, workspace.settings.embedding }         │
  │  OP:  Embed 3 views in parallel batch:                      │
  │       - titleText = title                                   │
  │       - contentText = body                                  │
  │       - summaryText = title + body[0:1000]                  │
  │  OUT: { title, content, summary, legacyVectorId }           │
  │  IMPL: observation-capture.ts:769-810                       │
  └─────────────────────────────────────────────────────────────┘

  ┌─ STAGE 5c: Entity Extraction (Pattern-Based) ───────────────┐
  │  IN:  { title, body, references }                           │
  │  OP:  extractEntities(text) ∪ extractFromReferences(refs)  │
  │  OUT: ExtractedEntity[] (limit 50)                          │
  │  IMPL: observation-capture.ts:813-833                       │
  └─────────────────────────────────────────────────────────────┘

  ┌─ STAGE 5d: Actor Resolution ────────────────────────────────┐
  │  IN:  { workspaceId, sourceEvent }                          │
  │  OP:  resolveActor(workspaceId, sourceEvent)                │
  │  OUT: { actorId, sourceActor }                              │
  │  IMPL: observation-capture.ts:836-838                       │
  └─────────────────────────────────────────────────────────────┘

       │ JOIN parallel results → sequential
       ▼
  ┌─ STAGE 5.5: Cluster Assignment ─────────────────────────────┐
  │  IN:  { embeddingResult.content.vector, topics, entityIds } │
  │  OP:  assignToCluster(workspaceId, embeddingVector, …)     │
  │  OUT: { clusterId, isNew, affinityScore }                   │
  │  IMPL: observation-capture.ts:871-890                       │
  └─────────────────────────────────────────────────────────────┘
       │ sequential
       ▼
  ┌─ STAGE 6: Upsert Multi-View Vectors (Pinecone) ────────────┐
  │  IN:  { embeddingResult, workspace.settings.embedding }     │
  │  OP:  Batch upsert 3 vectors (title, content, summary)     │
  │       with view-specific metadata                           │
  │  OUT: void (side effect: Pinecone index updated)            │
  │  IMPL: observation-capture.ts:908-974                       │
  └─────────────────────────────────────────────────────────────┘
       │ sequential
       ▼
  ┌─ STAGE 7: Store Observation + Entities (Transaction) ──────┐
  │  IN:  All previous results                                  │
  │  OP:  db.transaction {                                      │
  │         INSERT workspace_neural_observations                │
  │         UPSERT workspace_neural_entities (per entity)       │
  │       }                                                     │
  │  OUT: { observation, entitiesStored }                       │
  │  IMPL: observation-capture.ts:978-1056                      │
  └─────────────────────────────────────────────────────────────┘
       │ sequential
       ▼
  ┌─ STAGE 7.5: Relationship Detection ─────────────────────────┐
  │  IN:  { workspaceId, observation.id, sourceEvent }          │
  │  OP:  detectAndCreateRelationships(via shared refs)         │
  │  OUT: relationshipsCreated (count)                          │
  │  IMPL: observation-capture.ts:1060-1069                     │
  └─────────────────────────────────────────────────────────────┘
       │ sequential
       ▼
  ┌─ STAGE 7.6: Reconcile Vercel Actors (Conditional) ─────────┐
  │  IN:  { workspaceId, sourceEvent, resolvedActor }           │
  │  CONDITION: IF source="github" AND sourceType="push"        │
  │  OP:  reconcileVercelActorsForCommit(commitSha, numericId)  │
  │  OUT: { reconciled: count }                                 │
  │  IMPL: observation-capture.ts:1079-1104                     │
  └─────────────────────────────────────────────────────────────┘
       │ sequential
       ▼
  ┌─ STAGE 8: Emit Events (Fire-and-Forget) ───────────────────┐
  │  IN:  All results                                           │
  │  OP:  sendEvent([                                           │
  │         "observation.captured",                             │
  │         "profile.update" (if actor resolved),               │
  │         "cluster.check-summary",                            │
  │         "llm-entity-extraction.requested" (if body>200)     │
  │       ])                                                    │
  │  OUT: void                                                  │
  │  IMPL: observation-capture.ts:1109-1164                     │
  └─────────────────────────────────────────────────────────────┘
       │ sequential
       ▼
  ┌─ STAGE 9: Complete Job + Record Metrics ───────────────────┐
  │  IN:  All results + finalDuration                           │
  │  OP:  completeJob(status="completed", output=success)       │
  │       recordJobMetric([captured, entities, cluster])        │
  │  OUT: { status: "captured", observationId, duration }       │
  │  IMPL: observation-capture.ts:1168-1239                     │
  └─────────────────────────────────────────────────────────────┘

PARALLELISM:
  Stage 5a, 5b, 5c, 5d run concurrently via Promise.all
  Stages 0-4, 5.5-9 are sequential (data dependencies)

TOTAL COMPLEXITY: O(n·d + k·log(m))
  n = entities extracted (~50 max)
  d = embedding dimension (1024 or 3072)
  k = ANN cluster search top-k
  m = total clusters in namespace

EXIT POINTS (Early Return):
  1. duplicate          → L499-530 (observation-capture.ts)
  2. event_not_allowed  → L602-634 (observation-capture.ts)
  3. below_threshold    → L643-687 (observation-capture.ts)

═══════════════════════════════════════════════════════════════

ENUMERATION: Source Event Type Registry

┌─ GITHUB ──────────────────────────────────────────────────────┐
│ INTERNAL FORMAT: github:{entity}.{action}                     │
│ EXTERNAL FORMAT: {event}_{action} or {event}                  │
│                                                                │
│ github:push                         → push                    │
│   weight: 30  | category: push                                │
│                                                                │
│ github:pull-request.opened          → pull_request_opened     │
│   weight: 50  | category: pull_request                        │
│ github:pull-request.closed          → pull_request_closed     │
│   weight: 45  | category: pull_request                        │
│ github:pull-request.merged          → pull_request_merged     │
│   weight: 60  | category: pull_request                        │
│ github:pull-request.reopened        → pull_request_reopened   │
│   weight: 40  | category: pull_request                        │
│ github:pull-request.ready-for-review → pull_request_ready_for…│
│   weight: 45  | category: pull_request                        │
│                                                                │
│ github:issue.opened                 → issue_opened            │
│   weight: 45  | category: issues                              │
│ github:issue.closed                 → issue_closed            │
│   weight: 40  | category: issues                              │
│ github:issue.reopened               → issue_reopened          │
│   weight: 40  | category: issues                              │
│                                                                │
│ github:release.published            → release_published       │
│   weight: 75  | category: release                             │
│ github:release.created              → release_created         │
│   weight: 70  | category: release                             │
│                                                                │
│ github:discussion.created           → discussion_created      │
│   weight: 35  | category: discussion                          │
│ github:discussion.answered          → discussion_answered     │
│   weight: 40  | category: discussion                          │
│                                                                │
│ SOURCE: event-types.ts:179-269                                │
│ |CATEGORIES| = 5 (push, pull_request, issues, release, …)     │
│ |EVENTS| = 14                                                 │
└───────────────────────────────────────────────────────────────┘

┌─ VERCEL ──────────────────────────────────────────────────────┐
│ INTERNAL FORMAT: vercel:deployment.{state}                    │
│ EXTERNAL FORMAT: deployment.{state}                           │
│                                                                │
│ vercel:deployment.created           → deployment.created      │
│   weight: 30  | category: deployment.created                  │
│ vercel:deployment.succeeded         → deployment.succeeded    │
│   weight: 40  | category: deployment.succeeded                │
│ vercel:deployment.ready             → deployment.ready        │
│   weight: 40  | category: deployment.ready                    │
│ vercel:deployment.error             → deployment.error        │
│   weight: 70  | category: deployment.error                    │
│ vercel:deployment.canceled          → deployment.canceled     │
│   weight: 65  | category: deployment.canceled                 │
│ vercel:deployment.check-rerequested → deployment.check-rerequ…│
│   weight: 25  | category: deployment.check-rerequested        │
│                                                                │
│ SOURCE: event-types.ts:272-313                                │
│ |CATEGORIES| = 6 (each event is its own category)             │
│ |EVENTS| = 6                                                  │
└───────────────────────────────────────────────────────────────┘

┌─ SENTRY ──────────────────────────────────────────────────────┐
│ INTERNAL FORMAT: sentry:{entity}.{action}                     │
│ EXTERNAL FORMAT: {eventType}                                  │
│                                                                │
│ sentry:issue.created                → issue.created           │
│   weight: 55  | category: issue                               │
│ sentry:issue.resolved               → issue.resolved          │
│   weight: 50  | category: issue                               │
│ sentry:issue.assigned               → issue.assigned          │
│   weight: 30  | category: issue                               │
│ sentry:issue.ignored                → issue.ignored           │
│   weight: 25  | category: issue                               │
│                                                                │
│ sentry:error                        → error                   │
│   weight: 45  | category: error                               │
│                                                                │
│ sentry:event-alert                  → event_alert             │
│   weight: 65  | category: event_alert                         │
│ sentry:metric-alert                 → metric_alert            │
│   weight: 70  | category: metric_alert                        │
│                                                                │
│ SOURCE: event-types.ts:316-364                                │
│ |CATEGORIES| = 4 (issue, error, event_alert, metric_alert)    │
│ |EVENTS| = 7                                                  │
└───────────────────────────────────────────────────────────────┘

┌─ LINEAR ──────────────────────────────────────────────────────┐
│ INTERNAL FORMAT: linear:{entity}.{action}                     │
│ EXTERNAL FORMAT: {Type}:{action}                              │
│                                                                │
│ linear:issue.created                → Issue:create            │
│   weight: 50  | category: Issue                               │
│ linear:issue.updated                → Issue:update            │
│   weight: 35  | category: Issue                               │
│ linear:issue.deleted                → Issue:remove            │
│   weight: 40  | category: Issue                               │
│                                                                │
│ linear:comment.created              → Comment:create          │
│   weight: 25  | category: Comment                             │
│ linear:comment.updated              → Comment:update          │
│   weight: 20  | category: Comment                             │
│ linear:comment.deleted              → Comment:remove          │
│   weight: 20  | category: Comment                             │
│                                                                │
│ linear:project.created              → Project:create          │
│   weight: 45  | category: Project                             │
│ linear:project.updated              → Project:update          │
│   weight: 35  | category: Project                             │
│ linear:project.deleted              → Project:remove          │
│   weight: 40  | category: Project                             │
│                                                                │
│ linear:cycle.created                → Cycle:create            │
│   weight: 40  | category: Cycle                               │
│ linear:cycle.updated                → Cycle:update            │
│   weight: 30  | category: Cycle                               │
│ linear:cycle.deleted                → Cycle:remove            │
│   weight: 35  | category: Cycle                               │
│                                                                │
│ linear:project-update.created       → ProjectUpdate:create    │
│   weight: 45  | category: ProjectUpdate                       │
│ linear:project-update.updated       → ProjectUpdate:update    │
│   weight: 30  | category: ProjectUpdate                       │
│ linear:project-update.deleted       → ProjectUpdate:remove    │
│   weight: 25  | category: ProjectUpdate                       │
│                                                                │
│ SOURCE: event-types.ts:367-471                                │
│ |CATEGORIES| = 5 (Issue, Comment, Project, Cycle, ProjectUpd…)│
│ |EVENTS| = 15                                                 │
└───────────────────────────────────────────────────────────────┘

MAPPING FUNCTION: getBaseEventType(source, sourceType) → baseEventType

GITHUB:
  input: "pull-request.opened" → output: "pull_request"
  input: "issue.closed"        → output: "issues"
  input: "push"                → output: "push"
  RULE: extract before ".", replace "-" with "_", plural for "issue"
  SOURCE: observation-capture.ts:170-182

VERCEL:
  input: "deployment.created" → output: "deployment.created"
  RULE: identity (already category format)
  SOURCE: observation-capture.ts:184-187

SENTRY:
  input: "issue.created"  → output: "issue"
  input: "error"          → output: "error"
  input: "event-alert"    → output: "event_alert"
  input: "metric-alert"   → output: "metric_alert"
  RULE: strip after "." for "issue.*", replace "-" with "_"
  SOURCE: observation-capture.ts:189-200

LINEAR:
  input: "issue.created"         → output: "Issue"
  input: "project-update.created" → output: "ProjectUpdate"
  RULE: extract before ".", split on "-", capitalize each word
  SOURCE: observation-capture.ts:202-218

═══════════════════════════════════════════════════════════════

CONSTANTS:

SIGNIFICANCE_THRESHOLD = 40 (scoring.ts:16)
  Range: [0, 100]
  Scoring formula:
    score = baseWeight(eventType)                      (scoring.ts:83)
          + Σ signalWeight(pattern)                    (scoring.ts:89-94)
          + min(refCount × 3, 15)                      (scoring.ts:99-100)
          + contentBonus(bodyLength)                   (scoring.ts:106-112)
    clamp(score, 0, 100)                               (scoring.ts:115)

SIGNIFICANCE_SIGNALS (scoring.ts:52-66):
  critical_keyword:   +20 (breaking, critical, urgent, security, …)
  incident_keyword:   +15 (hotfix, emergency, incident, outage, …)
  important_keyword:  +10 (major, important, significant, release, …)
  feature_keyword:    +8  (feature, feat, new)
  fix_keyword:        +5  (fix, bug, patch, resolve)
  routine_keyword:    -10 (chore, deps, dependencies, bump, update, …)
  trivial_keyword:    -15 (typo, whitespace, formatting, lint)
  wip_keyword:        -10 (wip, draft, temp, test)

DEFAULT_EVENT_WEIGHT = 35 (event-types.ts:500, fallback for unknown)

MAX_ENTITIES_PER_OBSERVATION = 50 (observation-capture.ts:832)

INNGEST_IDEMPOTENCY_KEY = workspaceId + "-" + sourceId (observation-capture.ts:381)

INNGEST_CONCURRENCY_LIMIT = 10 per workspaceId (observation-capture.ts:385)

MULTI_VIEW_EMBEDDING_VIEWS = ["title", "content", "summary"] (observation-capture.ts:85-96)

LLM_ENTITY_EXTRACTION_BODY_THRESHOLD = 200 chars (observation-capture.ts:1152)

═══════════════════════════════════════════════════════════════

COMPLEXITY:
  Stage 0:   O(1)           — ID generation
  Stage 1:   O(log n)       — Index lookup (workspaceId, sourceId)
  Stage 2:   O(log m)       — Index lookup (workspaceId, providerResourceId)
  Stage 3:   O(p)           — p = pattern matches (~8 patterns)
  Stage 4:   O(log n)       — PK lookup
  Stage 5a:  O(LLM)         — Claude Haiku API call
  Stage 5b:  O(3·d)         — Embedding 3 texts (d = embedding dim)
  Stage 5c:  O(|title| + |body| + |refs|) — Regex entity extraction
  Stage 5d:  O(log n)       — Actor lookup
  Stage 5.5: O(k·log m)     — ANN search (k neighbors, m clusters)
  Stage 6:   O(3·d)         — Upsert 3 vectors
  Stage 7:   O(n)           — n = entities to upsert (~50 max)
  Stage 7.5: O(r·log n)     — r = references, lookup per ref
  Stage 7.6: O(c·log n)     — c = commits in push, conditional
  Stage 8:   O(1)           — Fire-and-forget events
  Stage 9:   O(1)           — Job completion + metrics

TOTAL: O(n·d + k·log(m) + LLM)
  Dominant factors: embedding generation, ANN search, LLM

CALLS →
  createJob()                            (observation-capture.ts:456, api/console/src/lib/jobs.ts)
  updateJobStatus()                      (observation-capture.ts:475)
  completeJob()                          (observation-capture.ts:500, 603, 653, 1169)
  resolveClerkOrgId()                    (observation-capture.ts:440)
  getBaseEventType()                     (observation-capture.ts:584)
  isEventAllowed()                       (observation-capture.ts:586)
  scoreSignificance()                    (observation-capture.ts:639, scoring.ts:78)
  getEventWeight()                       (scoring.ts:83, event-types.ts:499)
  createEmbeddingProviderForWorkspace()  (observation-capture.ts:770, console-embed)
  extractEntities()                      (observation-capture.ts:814)
  extractFromReferences()                (observation-capture.ts:816)
  resolveActor()                         (observation-capture.ts:837)
  assignToCluster()                      (observation-capture.ts:877)
  consolePineconeClient.upsertVectors()  (observation-capture.ts:949)
  deriveObservationType()                (observation-capture.ts:914, 979)
  detectAndCreateRelationships()         (observation-capture.ts:1063)
  reconcileVercelActorsForCommit()       (observation-capture.ts:1093)
  recordJobMetric()                      (observation-capture.ts:513, 617, 668, 854, 894, 1188)

CALLED_BY ← 
  inngest.send("apps-console/neural/observation.capture") — webhook handlers

═══ END T11 ═══


---

## Extraction Summary (Append Batch)

| Task | Target | Status | Details |
|------|--------|--------|---------|
| T10  | Pinecone Configuration | ✓ | Index config, namespace strategy, metadata fields, query patterns |
| T11  | Observation Capture Pipeline | ✓ | 42 event types, 3 filter gates, 9-stage pipeline, significance scoring |
| T12  | (duplicate of T11) | SKIPPED | — |
| T13  | MCP Tool Definitions | ✓ | 5 tools (search, contents, find_similar, graph, related) |
| T14  | SourceEvent Types + Transformers | ✓ | 3 core schemas, 4 source transformers, 38 webhook events |

**Total extractions**: 4 tasks (1 skipped duplicate)
**Completed**: 4 / 4

---
_Appended by extract-math @ 593bc567_
