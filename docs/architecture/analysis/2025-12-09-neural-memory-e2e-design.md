---
title: "End-to-End Neural Memory Design for Engineering Teams"
description: Complete architecture for engineering team memory with high-precision retrieval
status: draft
audience: engineering
date: 2025-12-09
tags: [architecture, neural-memory, retrieval, observations]
---

# End-to-End Neural Memory Design for Engineering Teams

**Date**: 2025-12-09

## Executive Summary

This document defines Lightfast's neural memory architecture for **engineering team memory**. The key insight: engineering teams need to answer questions like "what changed?", "who worked on X?", and "how did this system evolve?" - which requires temporal, actor-aware, and relationship-rich memory beyond static document search.

**Core Architecture Components:**
1. **2-Key Retrieval** → Vector search + LLM gating for high-precision recall
2. **Observation Clusters** → Topic-grouped organizational events
3. **Entity Store** → Structured knowledge for exact-match retrieval
4. **Parallel Processing** → Inngest workflow parallelization patterns
5. **Multi-Level Observations** → Hierarchical observation granularity

---

## Architecture Overview

### Lightfast Neural Memory
- **Model**: Engineering team memory (workspace-scoped, event-driven)
- **State**: Event-sourced observations with temporal tracking
- **Constraint**: Sub-second search, no session state, multi-contributor

### Core Concepts

| Concept | Description |
|---------|-------------|
| **Observation Cluster** | Topic-grouped events from engineering activity |
| **Observation** | Atomic engineering event (PR, issue, commit, etc.) |
| **Entity Store** | Structured knowledge (engineers, projects, decisions) |
| **Retrieval Governor** | 2-key filtering (vector + LLM gating) |
| **Cluster Detector** | Automatic topic detection from events |
| **Active Index** | Recent observations in hot tier |
| **Archive Index** | Historical observations, lower priority |
| **Actor Profile** | Expertise, patterns, collaborators |

---

## Core Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        NEURAL MEMORY SYSTEM                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                         WRITE PATH (Ingestion)                          │ │
│  │                                                                          │ │
│  │   Source Event → Significance → Enricher → Classifier → Extractor       │ │
│  │        ↓             ↓              ↓           ↓            ↓          │ │
│  │    GitHub PR    Score ≥60?     Actor/Repo   Type/Topic   Entities       │ │
│  │    Linear Issue     │          Metadata     Detection    Extraction     │ │
│  │    Sentry Error     │              │            │            │          │ │
│  │                     ↓              ↓            ↓            ↓          │ │
│  │              ┌──────────────────────────────────────────────────┐       │ │
│  │              │           PARALLEL PROCESSING                     │       │ │
│  │              │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ │       │ │
│  │              │  │Embedding│ │ Entity  │ │ Actor   │ │ Cluster │ │       │ │
│  │              │  │Generator│ │Extractor│ │ Profile │ │ Assign  │ │       │ │
│  │              │  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘ │       │ │
│  │              └───────┼──────────┼──────────┼──────────┼────────┘       │ │
│  │                      ↓          ↓          ↓          ↓                 │ │
│  │              ┌──────────────────────────────────────────────────┐       │ │
│  │              │              STORAGE LAYER                        │       │ │
│  │              │  Pinecone    PostgreSQL   PostgreSQL   Pinecone   │       │ │
│  │              │  (vectors)   (entities)   (profiles)   (clusters) │       │ │
│  │              └──────────────────────────────────────────────────┘       │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                          READ PATH (Retrieval)                          │ │
│  │                                                                          │ │
│  │   User Query → Query Classifier → Router → Candidate Generation         │ │
│  │        ↓              ↓              ↓              ↓                    │ │
│  │    "What did     Temporal?      Knowledge     ┌─────────────────┐       │ │
│  │     Sarah work   Actor?         Neural        │ PARALLEL SEARCH │       │ │
│  │     on?"         Technical?     Hybrid        │ ┌─────┐ ┌─────┐ │       │ │
│  │                      │              │         │ │Vec K│ │Vec N│ │       │ │
│  │                      ↓              ↓         │ │nowledge│ │eural│ │    │ │
│  │              ┌──────────────────────────────┐ │ └─────┘ └─────┘ │       │ │
│  │              │     RETRIEVAL GOVERNOR        │ │ ┌─────┐ ┌─────┐ │       │ │
│  │              │  ┌─────────┐ ┌─────────────┐ │ │ │Entity│ │Actor │ │       │ │
│  │              │  │ Key 1:  │ │   Key 2:    │ │ │ │Lookup│ │Match │ │       │ │
│  │              │  │ Vector  │ │ LLM Gating  │ │ │ └─────┘ └─────┘ │       │ │
│  │              │  │ Search  │ │ (Relevance) │ │ └─────────────────┘       │ │
│  │              │  └─────────┘ └─────────────┘ │                           │ │
│  │              └──────────────────────────────┘                           │ │
│  │                             ↓                                           │ │
│  │              ┌──────────────────────────────┐                           │ │
│  │              │      FUSION & HYDRATION       │                           │ │
│  │              │  Score → Rank → Budget → Out  │                           │ │
│  │              └──────────────────────────────┘                           │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Component Design

### 1. Observation Capture Pipeline

Captures engineering events from GitHub, Linear, Sentry, and other sources through a multi-step processing pipeline.

#### Pipeline Architecture

```typescript
// Inngest function: neural.observation.capture
export const observationCapture = inngest.createFunction(
  {
    id: "neural.observation.capture",
    concurrency: { limit: 20, key: "event.data.workspaceId" },
    retries: 3,
  },
  { event: "neural/observation.capture" },
  async ({ event, step }) => {
    const { sourceEvent, workspaceId, storeId } = event.data;

    // Step 1: Significance Evaluation (BLOCKING)
    // Determines if event is worth capturing
    const significance = await step.run("evaluate-significance", async () => {
      return await evaluateSignificance(sourceEvent);
    });

    if (significance.score < SIGNIFICANCE_THRESHOLD) {
      return { skipped: true, reason: "below_threshold", score: significance.score };
    }

    // Step 2: Actor Resolution (BLOCKING)
    // Maps source actor to workspace actor with confidence
    const actor = await step.run("resolve-actor", async () => {
      return await resolveActor(workspaceId, sourceEvent);
    });

    // Step 3: Classification (BLOCKING)
    // Determines observation type and topics
    const classification = await step.run("classify", async () => {
      return await classifyObservation(sourceEvent);
    });

    // Step 4: Build Observation Object
    const observation = await step.run("build-observation", async () => {
      return buildObservation(sourceEvent, actor, classification, significance);
    });

    // Step 5: PARALLEL PROCESSING (Fire-and-Forget + Awaited)
    const [embeddings, entities, clusterAssignment] = await Promise.all([
      // Awaited: Need embeddings for storage
      step.run("generate-embeddings", async () => {
        return await generateMultiViewEmbeddings(observation);
      }),

      // Awaited: Need entities for storage
      step.run("extract-entities", async () => {
        return await extractEntities(observation);
      }),

      // Awaited: Need cluster for context
      step.run("assign-cluster", async () => {
        return await assignToCluster(workspaceId, observation, classification);
      }),
    ]);

    // Fire-and-forget: Profile update (async, non-blocking)
    await step.sendEvent("profile-update", {
      name: "neural/profile.update",
      data: { workspaceId, actorId: actor.id, observationId: observation.id },
    });

    // Step 6: Store Observation (BLOCKING, transactional)
    const stored = await step.run("store-observation", async () => {
      return await db.transaction(async (tx) => {
        // Insert observation
        const [obs] = await tx.insert(workspaceNeuralObservations).values({
          ...observation,
          embeddingTitleId: embeddings.titleId,
          embeddingContentId: embeddings.contentId,
          clusterId: clusterAssignment.clusterId,
        }).returning();

        // Insert entities
        if (entities.length > 0) {
          await tx.insert(workspaceNeuralEntities).values(
            entities.map(e => ({ ...e, observationId: obs.id }))
          );
        }

        return obs;
      });
    });

    // Step 7: Trigger Downstream (NON-BLOCKING)
    await step.sendEvent("downstream-triggers", [
      {
        name: "neural/cluster.check-summary",
        data: { workspaceId, clusterId: clusterAssignment.clusterId },
      },
    ]);

    return {
      success: true,
      observationId: stored.id,
      type: classification.type,
      significance: significance.score,
      clusterId: clusterAssignment.clusterId,
    };
  }
);
```

#### Significance Evaluation

Multi-factor scoring determines if an event is worth capturing.

```typescript
const SIGNIFICANCE_THRESHOLD = 60; // 0-100 scale

interface SignificanceResult {
  score: number;
  factors: Record<string, number>;
  reasoning: string;
}

async function evaluateSignificance(event: SourceEvent): Promise<SignificanceResult> {
  const factors: Record<string, number> = {};

  // Factor 1: Event Type Weight (0-30 points)
  // Decisions, incidents > changes > discussions
  factors.eventType = EVENT_TYPE_WEIGHTS[`${event.source}:${event.sourceType}`] ?? 10;

  // Factor 2: Content Substance (0-25 points)
  // Longer, more detailed content = more significant
  const contentLength = (event.title?.length ?? 0) + (event.body?.length ?? 0);
  factors.contentSubstance = Math.min(25, Math.floor(contentLength / 100));

  // Factor 3: Actor Activity (0-20 points)
  // Active contributors = more important events
  const actorProfile = await getActorProfile(event.actor?.id);
  factors.actorActivity = actorProfile ? Math.min(20, actorProfile.observationCount) : 5;

  // Factor 4: Reference Density (0-15 points)
  // More references = more connected = more important
  const refCount = event.references?.length ?? 0;
  factors.referenceDensity = Math.min(15, refCount * 3);

  // Factor 5: Temporal Uniqueness (0-10 points)
  // Avoid duplicate/similar events in short window
  const recentSimilar = await countRecentSimilarEvents(event, 30); // 30 minutes
  factors.temporalUniqueness = Math.max(0, 10 - recentSimilar * 2);

  const score = Object.values(factors).reduce((sum, val) => sum + val, 0);

  return {
    score,
    factors,
    reasoning: generateReasoningText(factors, score),
  };
}

// Event type weights (source:type → score)
const EVENT_TYPE_WEIGHTS: Record<string, number> = {
  // High significance (25-30)
  'github:pull_request_merged': 30,
  'github:release': 30,
  'linear:issue_completed': 28,
  'sentry:issue_resolved': 28,

  // Medium-high (20-24)
  'github:pull_request_opened': 24,
  'github:pull_request_reviewed': 22,
  'linear:issue_created': 22,
  'sentry:issue_created': 20,

  // Medium (15-19)
  'github:issue_opened': 18,
  'github:commit': 15,
  'linear:comment': 16,
  'github:discussion': 15,

  // Lower (10-14)
  'github:issue_comment': 12,
  'linear:status_change': 10,
};
```

---

### 2. Observation Clusters

Topic-grouped collections of related engineering events, enabling contextual retrieval and summarization.

#### Cluster Concept

Lightfast clusters observations by **topic affinity** detected through:
1. Embedding similarity to existing cluster centroids
2. Entity overlap (same project, PR, issue)
3. Actor overlap (same team working on related items)
4. Temporal proximity (events in same time window)

```typescript
interface ObservationCluster {
  id: string;
  workspaceId: string;

  // Topic identification
  topicLabel: string;           // "Authentication Implementation"
  topicEmbeddingId: string;     // Centroid embedding
  keywords: string[];           // Fast retrieval hooks

  // Scope
  primaryEntities: string[];    // Projects, repos involved
  primaryActors: string[];      // Key contributors

  // Status (unlike HMLR, not ACTIVE/PAUSED - all clusters are queryable)
  status: 'open' | 'closed';    // Open = still receiving observations

  // Metrics
  observationCount: number;
  firstObservationAt: Date;
  lastObservationAt: Date;

  // Summary (generated when cluster reaches threshold)
  summary: string | null;
  summaryGeneratedAt: Date | null;
}
```

#### Cluster Assignment Algorithm

```typescript
async function assignToCluster(
  workspaceId: string,
  observation: Observation,
  classification: Classification
): Promise<{ clusterId: string; isNew: boolean }> {
  // 1. Get recent open clusters
  const recentClusters = await db.select()
    .from(workspaceObservationClusters)
    .where(and(
      eq(workspaceObservationClusters.workspaceId, workspaceId),
      eq(workspaceObservationClusters.status, 'open'),
      gte(workspaceObservationClusters.lastObservationAt, subDays(new Date(), 7))
    ))
    .orderBy(desc(workspaceObservationClusters.lastObservationAt))
    .limit(10);

  if (recentClusters.length === 0) {
    return createNewCluster(workspaceId, observation, classification);
  }

  // 2. Calculate affinity scores
  const affinities = await Promise.all(
    recentClusters.map(async (cluster) => ({
      cluster,
      score: await calculateClusterAffinity(cluster, observation),
    }))
  );

  // 3. Find best match above threshold
  const bestMatch = affinities
    .filter(a => a.score >= CLUSTER_AFFINITY_THRESHOLD)
    .sort((a, b) => b.score - a.score)[0];

  if (bestMatch) {
    // Add to existing cluster
    await updateClusterMetrics(bestMatch.cluster.id, observation);
    return { clusterId: bestMatch.cluster.id, isNew: false };
  }

  // 4. Create new cluster
  return createNewCluster(workspaceId, observation, classification);
}

async function calculateClusterAffinity(
  cluster: ObservationCluster,
  observation: Observation
): Promise<number> {
  let score = 0;

  // Embedding similarity (0-40 points)
  const embedding = await getEmbeddingVector(observation.embeddingContentId);
  const clusterCentroid = await getEmbeddingVector(cluster.topicEmbeddingId);
  const similarity = cosineSimilarity(embedding, clusterCentroid);
  score += similarity * 40;

  // Entity overlap (0-30 points)
  const entityOverlap = calculateOverlap(
    cluster.primaryEntities,
    observation.relatedEntityIds
  );
  score += entityOverlap * 30;

  // Actor overlap (0-20 points)
  const actorOverlap = cluster.primaryActors.includes(observation.actorId) ? 20 : 0;
  score += actorOverlap;

  // Temporal proximity (0-10 points)
  const hoursSinceLastObs = differenceInHours(
    new Date(),
    cluster.lastObservationAt
  );
  score += Math.max(0, 10 - hoursSinceLastObs);

  return score;
}
```

---

### 3. Retrieval Governor

The Retrieval Governor implements 2-key retrieval: vector search for high recall, followed by LLM gating for high precision. Executes multiple retrieval paths in parallel for optimal latency.

#### Governor Architecture

```typescript
interface GovernorResult {
  observations: ScoredObservation[];
  entities: Entity[];
  clusters: ClusterContext[];
  actorMatches: ActorMatch[];
  governorMetrics: {
    key1Candidates: number;
    key2Filtered: number;
    entityMatches: number;
    latencyMs: number;
  };
}

async function retrievalGovernor(
  workspaceId: string,
  query: string,
  queryEmbedding: number[],
  options: RetrievalOptions
): Promise<GovernorResult> {
  const startTime = Date.now();

  // PARALLEL EXECUTION: 4 independent retrieval paths
  const [
    vectorCandidates,
    entityMatches,
    clusterMatches,
    actorMatches,
  ] = await Promise.all([
    // Path 1: Vector search (Key 1) - High recall
    searchObservationVectors(workspaceId, queryEmbedding, {
      topK: 50, // Fetch more than needed
      filters: options.filters,
    }),

    // Path 2: Entity exact-match lookup
    searchEntityStore(workspaceId, query),

    // Path 3: Cluster context retrieval
    findRelevantClusters(workspaceId, query, queryEmbedding),

    // Path 4: Actor profile matching
    matchActorProfiles(workspaceId, query),
  ]);

  // KEY 2: LLM Gating - Filter vector candidates for relevance
  const filteredObservations = await llmRelevanceFilter(
    query,
    vectorCandidates,
    {
      maxCandidates: options.topK * 2, // Allow some buffer
      minConfidence: 0.6,
    }
  );

  return {
    observations: filteredObservations,
    entities: entityMatches,
    clusters: clusterMatches,
    actorMatches,
    governorMetrics: {
      key1Candidates: vectorCandidates.length,
      key2Filtered: filteredObservations.length,
      entityMatches: entityMatches.length,
      latencyMs: Date.now() - startTime,
    },
  };
}
```

#### Key 2: LLM Relevance Filtering

Vector search has high recall but poor precision. LLM gating validates each candidate's relevance, filtering false positives.

```typescript
async function llmRelevanceFilter(
  query: string,
  candidates: VectorSearchResult[],
  options: { maxCandidates: number; minConfidence: number }
): Promise<ScoredObservation[]> {
  // Skip if few candidates (all likely relevant)
  if (candidates.length <= 5) {
    return candidates.map(c => ({
      ...c,
      relevanceScore: c.vectorScore,
      filterMethod: 'passthrough',
    }));
  }

  // Batch candidates for efficiency
  const candidateSummaries = candidates.slice(0, options.maxCandidates).map(c => ({
    id: c.id,
    title: c.title,
    snippet: c.content.slice(0, 300),
    type: c.type,
    actor: c.actorName,
    occurredAt: c.occurredAt,
  }));

  // LLM relevance check (using fast model)
  const response = await llm.generate({
    model: 'claude-3-5-haiku-20241022', // Fast, cheap model
    messages: [{
      role: 'system',
      content: `You are a relevance filter. Given a user query and candidate observations,
rate each candidate's relevance from 0.0 to 1.0.

Consider:
- Direct semantic match to query
- Indirect relevance (context, background info)
- Temporal relevance if query implies time
- Actor relevance if query mentions people

Return JSON array: [{"id": "...", "relevance": 0.85, "reason": "..."}, ...]`
    }, {
      role: 'user',
      content: `Query: "${query}"

Candidates:
${JSON.stringify(candidateSummaries, null, 2)}`
    }],
    maxTokens: 1000,
  });

  const ratings = JSON.parse(response.content);

  // Merge LLM ratings with vector scores
  return candidates
    .map(c => {
      const rating = ratings.find((r: any) => r.id === c.id);
      return {
        ...c,
        relevanceScore: rating?.relevance ?? 0,
        filterReason: rating?.reason,
        filterMethod: 'llm_gated',
        // Combined score: 60% LLM relevance, 40% vector similarity
        finalScore: (rating?.relevance ?? 0) * 0.6 + c.vectorScore * 0.4,
      };
    })
    .filter(c => c.relevanceScore >= options.minConfidence)
    .sort((a, b) => b.finalScore - a.finalScore);
}
```

---

### 4. Entity Store

Structured storage for engineering entities that require exact-match retrieval: engineers, projects, decisions, APIs, and configuration.

#### Entity Types

```typescript
type EntityCategory =
  | 'engineer'    // Team members, contributors
  | 'project'     // Features, initiatives, repos
  | 'decision'    // Architectural decisions, ADRs
  | 'endpoint'    // API endpoints, routes
  | 'config'      // Configuration keys, environment vars
  | 'definition'  // Technical definitions, glossary
  | 'service';    // Services, dependencies

interface Entity {
  id: string;
  workspaceId: string;
  storeId: string;

  // Entity identification
  category: EntityCategory;
  key: string;              // "sarah-johnson", "POST /api/users", "AUTH_SECRET"
  value: string;            // "Backend Engineer", "Creates user account", "Required for JWT"
  aliases: string[];        // ["@sarah", "sarah.johnson@acme.com"]

  // Provenance
  sourceObservationId: string;
  evidenceSnippet: string;  // 10-50 words of context
  confidence: number;       // 0.0-1.0

  // Metadata
  extractedAt: Date;
  lastSeenAt: Date;
  occurrenceCount: number;
}
```

#### Entity Extraction

```typescript
async function extractEntities(observation: Observation): Promise<Entity[]> {
  const entities: Entity[] = [];

  // Rule-based extraction (fast, high confidence)
  entities.push(...extractRuleBasedEntities(observation));

  // LLM-based extraction (for complex entities)
  if (observation.content.length > 200) {
    const llmEntities = await extractLLMEntities(observation);
    entities.push(...llmEntities);
  }

  return deduplicateEntities(entities);
}

function extractRuleBasedEntities(observation: Observation): Entity[] {
  const entities: Entity[] = [];
  const content = observation.content;

  // Pattern: API endpoints
  const endpointPattern = /(GET|POST|PUT|PATCH|DELETE)\s+\/[^\s"']+/g;
  for (const match of content.matchAll(endpointPattern)) {
    entities.push({
      category: 'endpoint',
      key: match[0],
      value: extractEndpointContext(content, match.index!),
      confidence: 0.95,
    });
  }

  // Pattern: Environment variables
  const envPattern = /\b[A-Z][A-Z0-9_]{2,}(?:_[A-Z0-9]+)*\b/g;
  for (const match of content.matchAll(envPattern)) {
    if (isLikelyEnvVar(match[0])) {
      entities.push({
        category: 'config',
        key: match[0],
        value: extractEnvContext(content, match.index!),
        confidence: 0.85,
      });
    }
  }

  // Pattern: @mentions (engineers)
  const mentionPattern = /@([a-zA-Z0-9_-]+)/g;
  for (const match of content.matchAll(mentionPattern)) {
    entities.push({
      category: 'engineer',
      key: match[1],
      aliases: [match[0]],
      value: 'mentioned in observation',
      confidence: 0.90,
    });
  }

  // Pattern: Issue/PR references
  const refPattern = /(#\d+|[A-Z]+-\d+)/g;
  for (const match of content.matchAll(refPattern)) {
    entities.push({
      category: 'project',
      key: match[0],
      value: extractRefContext(content, match.index!),
      confidence: 0.95,
    });
  }

  return entities;
}
```

#### Entity Search

```typescript
async function searchEntityStore(
  workspaceId: string,
  query: string
): Promise<Entity[]> {
  // 1. Extract potential entity references from query
  const queryEntities = extractQueryEntities(query);

  // 2. Exact match on keys and aliases
  const exactMatches = await db.select()
    .from(workspaceNeuralEntities)
    .where(and(
      eq(workspaceNeuralEntities.workspaceId, workspaceId),
      or(
        inArray(workspaceNeuralEntities.key, queryEntities),
        sql`${workspaceNeuralEntities.aliases} && ${queryEntities}::text[]`
      )
    ))
    .limit(10);

  // 3. Fuzzy match on key/value
  const fuzzyMatches = await db.select()
    .from(workspaceNeuralEntities)
    .where(and(
      eq(workspaceNeuralEntities.workspaceId, workspaceId),
      or(
        ilike(workspaceNeuralEntities.key, `%${query}%`),
        ilike(workspaceNeuralEntities.value, `%${query}%`)
      )
    ))
    .limit(5);

  return deduplicateEntities([...exactMatches, ...fuzzyMatches]);
}
```

---

### 5. Actor Identity & Profiles

Cross-platform actor correlation enabling "who worked on X?" queries without requiring a central identity service.

#### Three-Tier Identity Resolution

```
┌─────────────────────────────────────────────────────────────┐
│ Tier 1: OAuth Connection (Confidence: 1.0)                   │
│ User explicitly connects GitHub/Linear to Clerk              │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ Tier 2: Email Matching (Confidence: 0.85)                    │
│ Same email used across platforms                             │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ Tier 3: Heuristic Matching (Confidence: 0.60)                │
│ Name similarity, behavioral patterns                         │
└─────────────────────────────────────────────────────────────┘
```

#### Actor Profile Schema

```typescript
interface ActorProfile {
  id: string;
  workspaceId: string;

  // Identity
  actorId: string;              // Canonical workspace actor ID
  displayName: string;
  email: string | null;
  avatarUrl: string | null;

  // Linked identities
  identities: ActorIdentity[];  // [{source: 'github', sourceId: '12345', confidence: 1.0}]

  // Expertise (computed from observations)
  expertiseDomains: Record<string, number>;  // {"authentication": 0.85, "database": 0.72}
  contributionTypes: Record<string, number>; // {"code_review": 0.4, "implementation": 0.35}

  // Patterns
  activeHours: number[];        // [9, 10, 11, 14, 15, 16] (UTC hours)
  frequentCollaborators: string[]; // Actor IDs of frequent collaborators

  // Embedding
  profileEmbeddingId: string;   // Centroid of actor's observation embeddings

  // Stats
  observationCount: number;
  lastActiveAt: Date;
  profileConfidence: number;    // Based on observation count
}
```

#### Profile Update (Fire-and-Forget)

```typescript
export const profileUpdate = inngest.createFunction(
  {
    id: "neural.profile.update",
    concurrency: { limit: 10, key: "event.data.actorId" },
  },
  { event: "neural/profile.update" },
  async ({ event, step }) => {
    const { workspaceId, actorId, observationId } = event.data;

    // Debounce: Only process if no other update in last 5 minutes
    const recentUpdate = await step.run("check-recent", async () => {
      const profile = await db.select()
        .from(workspaceActorProfiles)
        .where(and(
          eq(workspaceActorProfiles.workspaceId, workspaceId),
          eq(workspaceActorProfiles.actorId, actorId),
          gte(workspaceActorProfiles.updatedAt, subMinutes(new Date(), 5))
        ))
        .limit(1);
      return profile.length > 0;
    });

    if (recentUpdate) {
      return { skipped: true, reason: 'debounced' };
    }

    // Gather recent observations (last 90 days)
    const observations = await step.run("gather-observations", async () => {
      return await db.select()
        .from(workspaceNeuralObservations)
        .where(and(
          eq(workspaceNeuralObservations.workspaceId, workspaceId),
          eq(workspaceNeuralObservations.actorId, actorId),
          gte(workspaceNeuralObservations.occurredAt, subDays(new Date(), 90))
        ))
        .orderBy(desc(workspaceNeuralObservations.occurredAt))
        .limit(100);
    });

    // Extract profile features
    const features = await step.run("extract-features", async () => ({
      expertiseDomains: extractExpertiseDomains(observations),
      contributionTypes: extractContributionTypes(observations),
      activeHours: extractActiveHours(observations),
      frequentCollaborators: extractCollaborators(observations),
    }));

    // Compute profile embedding (centroid of recent observations)
    const profileEmbedding = await step.run("compute-embedding", async () => {
      const embeddings = await Promise.all(
        observations.slice(0, 50).map(obs =>
          getEmbeddingVector(obs.embeddingContentId)
        )
      );
      return calculateCentroid(embeddings);
    });

    // Upsert profile
    await step.run("upsert-profile", async () => {
      await db.insert(workspaceActorProfiles)
        .values({
          id: generateId(),
          workspaceId,
          actorId,
          ...features,
          profileEmbeddingId: await storeEmbedding(profileEmbedding),
          observationCount: observations.length,
          lastActiveAt: observations[0]?.occurredAt,
          profileConfidence: calculateConfidence(observations.length),
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [workspaceActorProfiles.workspaceId, workspaceActorProfiles.actorId],
          set: {
            ...features,
            profileEmbeddingId: await storeEmbedding(profileEmbedding),
            observationCount: observations.length,
            lastActiveAt: observations[0]?.occurredAt,
            profileConfidence: calculateConfidence(observations.length),
            updatedAt: new Date(),
          },
        });
    });

    return { success: true, actorId, observationCount: observations.length };
  }
);
```

---

### 6. Cluster Summaries

Automatically generated summaries for observation clusters, providing quick context for topic-based queries.

```typescript
export const clusterSummaryCheck = inngest.createFunction(
  {
    id: "neural.cluster.check-summary",
    concurrency: { limit: 5, key: "event.data.workspaceId" },
  },
  { event: "neural/cluster.check-summary" },
  async ({ event, step }) => {
    const { workspaceId, clusterId } = event.data;

    // Check if summary needed
    const cluster = await step.run("load-cluster", async () => {
      return await db.select()
        .from(workspaceObservationClusters)
        .where(eq(workspaceObservationClusters.id, clusterId))
        .limit(1);
    });

    if (!cluster[0]) {
      return { skipped: true, reason: 'cluster_not_found' };
    }

    const needsSummary =
      cluster[0].observationCount >= SUMMARY_THRESHOLD &&
      (!cluster[0].summaryGeneratedAt ||
       differenceInHours(new Date(), cluster[0].summaryGeneratedAt) > 24);

    if (!needsSummary) {
      return { skipped: true, reason: 'summary_not_needed' };
    }

    // Gather cluster observations
    const observations = await step.run("gather-observations", async () => {
      return await db.select()
        .from(workspaceNeuralObservations)
        .where(eq(workspaceNeuralObservations.clusterId, clusterId))
        .orderBy(desc(workspaceNeuralObservations.occurredAt))
        .limit(50);
    });

    // Generate summary with LLM
    const summary = await step.run("generate-summary", async () => {
      const observationTexts = observations.map(obs =>
        `[${obs.type}] ${obs.title}\n${obs.content.slice(0, 300)}`
      ).join('\n\n---\n\n');

      const response = await llm.generate({
        model: 'claude-3-5-sonnet-20241022',
        messages: [{
          role: 'system',
          content: `Summarize these engineering observations into a concise summary.
Include:
1. Main topic/theme (1 line)
2. Key technical decisions made (bullet points)
3. Key contributors involved
4. Current status/outcome

Keep it under 300 words.`
        }, {
          role: 'user',
          content: observationTexts,
        }],
        maxTokens: 500,
      });

      return response.content;
    });

    // Update cluster with summary
    await step.run("update-cluster", async () => {
      await db.update(workspaceObservationClusters)
        .set({
          summary,
          summaryGeneratedAt: new Date(),
        })
        .where(eq(workspaceObservationClusters.id, clusterId));
    });

    return { success: true, clusterId, observationCount: observations.length };
  }
);
```

---

### 7. Temporal State Tracking

Bi-temporal tracking of engineering entities, enabling point-in-time queries like "what was the status of Project X last month?"

```typescript
interface TemporalState {
  id: string;
  workspaceId: string;

  // Entity being tracked
  entityType: 'project' | 'feature' | 'service' | 'sprint';
  entityId: string;
  entityName: string;

  // State
  stateType: 'status' | 'progress' | 'health' | 'risk' | 'priority';
  stateValue: string;

  // Temporal window (when this was TRUE in reality)
  validFrom: Date;
  validTo: Date | null;  // null = still current

  // Current state flag (for fast queries)
  isCurrent: boolean;

  // Change metadata
  changedByActorId: string | null;
  changeReason: string | null;
  relatedObservationId: string | null;
}

// Point-in-time query
async function getStateAt(
  workspaceId: string,
  entityId: string,
  stateType: string,
  pointInTime: Date
): Promise<TemporalState | null> {
  const state = await db.select()
    .from(workspaceTemporalStates)
    .where(and(
      eq(workspaceTemporalStates.workspaceId, workspaceId),
      eq(workspaceTemporalStates.entityId, entityId),
      eq(workspaceTemporalStates.stateType, stateType),
      lte(workspaceTemporalStates.validFrom, pointInTime),
      or(
        isNull(workspaceTemporalStates.validTo),
        gt(workspaceTemporalStates.validTo, pointInTime)
      )
    ))
    .limit(1);

  return state[0] ?? null;
}
```

---

## Database Schema

### New Tables

```sql
-- Observations (atomic engineering events)
CREATE TABLE workspace_neural_observations (
  id VARCHAR(191) PRIMARY KEY,
  workspace_id VARCHAR(191) NOT NULL,
  store_id VARCHAR(191) NOT NULL,
  cluster_id VARCHAR(191),

  -- Temporal
  occurred_at TIMESTAMP WITH TIME ZONE NOT NULL,
  captured_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Actor
  actor_type VARCHAR(50),
  actor_id VARCHAR(191),
  actor_name VARCHAR(255),
  actor_confidence FLOAT DEFAULT 1.0,

  -- Content
  observation_type VARCHAR(100) NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,

  -- Classification
  topics JSONB,
  significance_score FLOAT,
  confidence_score FLOAT,

  -- Source
  source_type VARCHAR(50) NOT NULL,
  source_id VARCHAR(255) NOT NULL,
  source_references JSONB,

  -- Embeddings (3 views)
  embedding_title_id VARCHAR(191),
  embedding_content_id VARCHAR(191),
  embedding_summary_id VARCHAR(191),

  -- Relationships
  related_entity_ids JSONB,
  parent_observation_id VARCHAR(191),

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_obs_workspace_occurred ON workspace_neural_observations(workspace_id, occurred_at DESC);
CREATE INDEX idx_obs_cluster ON workspace_neural_observations(cluster_id);
CREATE INDEX idx_obs_actor ON workspace_neural_observations(workspace_id, actor_id);
CREATE INDEX idx_obs_type ON workspace_neural_observations(workspace_id, observation_type);

-- Observation Clusters (topic groupings)
CREATE TABLE workspace_observation_clusters (
  id VARCHAR(191) PRIMARY KEY,
  workspace_id VARCHAR(191) NOT NULL,

  -- Topic
  topic_label VARCHAR(255) NOT NULL,
  topic_embedding_id VARCHAR(191),
  keywords JSONB,

  -- Scope
  primary_entities JSONB,
  primary_actors JSONB,

  -- Status
  status VARCHAR(50) DEFAULT 'open',

  -- Summary
  summary TEXT,
  summary_generated_at TIMESTAMP WITH TIME ZONE,

  -- Metrics
  observation_count INTEGER DEFAULT 0,
  first_observation_at TIMESTAMP WITH TIME ZONE,
  last_observation_at TIMESTAMP WITH TIME ZONE,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_cluster_workspace_status ON workspace_observation_clusters(workspace_id, status);
CREATE INDEX idx_cluster_last_obs ON workspace_observation_clusters(workspace_id, last_observation_at DESC);

-- Entity Store (structured facts)
CREATE TABLE workspace_neural_entities (
  id VARCHAR(191) PRIMARY KEY,
  workspace_id VARCHAR(191) NOT NULL,
  store_id VARCHAR(191) NOT NULL,

  -- Entity
  category VARCHAR(50) NOT NULL,
  key VARCHAR(500) NOT NULL,
  value TEXT NOT NULL,
  aliases JSONB,

  -- Provenance
  source_observation_id VARCHAR(191),
  evidence_snippet TEXT,
  confidence FLOAT DEFAULT 0.8,

  -- Metadata
  extracted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  occurrence_count INTEGER DEFAULT 1,

  CONSTRAINT uq_entity_key UNIQUE (workspace_id, category, key)
);

CREATE INDEX idx_entity_workspace_cat ON workspace_neural_entities(workspace_id, category);
CREATE INDEX idx_entity_key ON workspace_neural_entities(workspace_id, key);

-- Actor Profiles
CREATE TABLE workspace_actor_profiles (
  id VARCHAR(191) PRIMARY KEY,
  workspace_id VARCHAR(191) NOT NULL,

  -- Identity
  actor_id VARCHAR(191) NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  avatar_url TEXT,

  -- Expertise
  expertise_domains JSONB,
  contribution_types JSONB,
  active_hours JSONB,
  frequent_collaborators JSONB,

  -- Embedding
  profile_embedding_id VARCHAR(191),

  -- Stats
  observation_count INTEGER DEFAULT 0,
  last_active_at TIMESTAMP WITH TIME ZONE,
  profile_confidence FLOAT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT uq_actor_profile UNIQUE (workspace_id, actor_id)
);

CREATE INDEX idx_profile_workspace ON workspace_actor_profiles(workspace_id);
CREATE INDEX idx_profile_active ON workspace_actor_profiles(workspace_id, last_active_at DESC);

-- Actor Identities (cross-platform mapping)
CREATE TABLE workspace_actor_identities (
  id VARCHAR(191) PRIMARY KEY,
  workspace_id VARCHAR(191) NOT NULL,
  actor_id VARCHAR(191) NOT NULL,

  -- Source identity
  source VARCHAR(50) NOT NULL,
  source_id VARCHAR(255) NOT NULL,
  source_username VARCHAR(255),
  source_email VARCHAR(255),

  -- Mapping metadata
  mapping_method VARCHAR(50) NOT NULL,
  confidence_score FLOAT NOT NULL,
  mapped_by VARCHAR(191),
  mapped_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT uq_identity UNIQUE (workspace_id, source, source_id)
);

CREATE INDEX idx_identity_actor ON workspace_actor_identities(workspace_id, actor_id);
CREATE INDEX idx_identity_email ON workspace_actor_identities(workspace_id, source_email);

-- Temporal States
CREATE TABLE workspace_temporal_states (
  id VARCHAR(191) PRIMARY KEY,
  workspace_id VARCHAR(191) NOT NULL,

  -- Entity
  entity_type VARCHAR(50) NOT NULL,
  entity_id VARCHAR(191) NOT NULL,
  entity_name VARCHAR(255),

  -- State
  state_type VARCHAR(50) NOT NULL,
  state_value VARCHAR(255) NOT NULL,
  state_metadata JSONB,

  -- Temporal
  valid_from TIMESTAMP WITH TIME ZONE NOT NULL,
  valid_to TIMESTAMP WITH TIME ZONE,
  is_current BOOLEAN DEFAULT TRUE,

  -- Change
  changed_by_actor_id VARCHAR(191),
  change_reason TEXT,
  related_observation_id VARCHAR(191),

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_state_entity ON workspace_temporal_states(entity_type, entity_id, valid_from DESC);
CREATE INDEX idx_state_current ON workspace_temporal_states(workspace_id, is_current) WHERE is_current = TRUE;
```

---

## Pinecone Namespace Strategy

```
Namespace Format: {clerkOrgId}:ws_{workspaceId}:{layer}

Layers:
- knowledge      → Document chunks (existing)
- observations   → Neural observations (new)
- clusters       → Cluster centroids (new)
- profiles       → Actor profile embeddings (new)

Example:
- org_abc123:ws_xyz789:knowledge
- org_abc123:ws_xyz789:observations
- org_abc123:ws_xyz789:clusters
- org_abc123:ws_xyz789:profiles
```

---

## Performance Targets

| Operation | Target (p95) | Notes |
|-----------|--------------|-------|
| Observation capture | <500ms | End-to-end including embedding |
| Entity extraction | <200ms | Rule-based + LLM batched |
| Profile update | <1000ms | Fire-and-forget, debounced |
| Cluster assignment | <100ms | Embedding similarity + metrics |
| Retrieval (Key 1) | <50ms | Pinecone vector search |
| Retrieval (Key 2) | <300ms | LLM relevance filtering |
| Entity lookup | <20ms | PostgreSQL exact match |
| Total search (hybrid) | <500ms | Including hydration |

---

## Implementation Phases

### Phase 1: Foundation (Week 1-2)
- [ ] Database schema migration
- [ ] Pinecone namespace setup
- [ ] Basic observation capture pipeline
- [ ] Event types for GitHub sources

### Phase 2: Core Pipeline (Week 3-4)
- [ ] Significance evaluation
- [ ] Actor resolution (Tier 2: email matching)
- [ ] Classification system
- [ ] Multi-view embedding generation

### Phase 3: Retrieval Governor (Week 5-6)
- [ ] Vector search integration
- [ ] LLM relevance filtering (Key 2)
- [ ] Entity store and lookup
- [ ] Fusion scoring

### Phase 4: Advanced Features (Week 7-8)
- [ ] Observation clusters
- [ ] Actor profiles
- [ ] Cluster summaries
- [ ] Temporal state tracking

### Phase 5: Quality & Optimization (Week 9-10)
- [ ] Braintrust evaluation suite
- [ ] Latency optimization
- [ ] Caching strategies
- [ ] Monitoring dashboards

---

## Design Decisions

| Aspect | Approach | Rationale |
|--------|----------|-----------|
| Retrieval | 2-key (vector + LLM gating) | High recall from vectors, high precision from LLM filtering |
| Topic grouping | Observation Clusters | Enable contextual retrieval and summarization |
| Entity extraction | Structured Entity Store | Exact-match retrieval for engineers, projects, APIs |
| Actor mapping | Three-tier resolution | Balance confidence vs. coverage |
| Parallel processing | Explicit Promise.all patterns | Minimize latency through concurrent operations |
| Significance | Multi-factor with thresholds | Filter noise while capturing important events |

---

## References

- `docs/architecture/retrieval/neural-memory-design.md` - Original draft
- `docs/architecture/retrieval/implementation/*.md` - Implementation drafts

---

_Last updated: 2025-12-09_
