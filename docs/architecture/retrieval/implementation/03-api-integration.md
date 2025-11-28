---
title: API Integration
description: How neural memory extends the existing search API
status: draft
audience: engineering
last_updated: 2025-11-27
tags: [neural-memory, implementation, api]
---

# API Integration

## Overview

Neural memory extends the existing 4-route API (`/v1/search`, `/v1/contents`, `/v1/similar`, `/v1/answer`) without changing their public contracts. Internally, queries are classified and routed to the appropriate search backend (knowledge, neural, or hybrid).

## Route: POST `/v1/search`

### Public Contract (Unchanged)

```typescript
// Request
interface SearchRequest {
  query: string;
  workspace_id: string;
  limit?: number;
  filters?: {
    source?: string;
    date_range?: [Date, Date];
  };
}

// Response
interface SearchResult {
  id: string;
  type: 'document' | 'chunk' | 'observation' | 'summary';
  title: string;
  snippet: string;
  source: string;
  timestamp: Date;
  actor?: { name: string; type: string };
  score: number;
}
```

### Internal Routing Logic

```typescript
import { classifyQueryMode } from './query-classifier';
import { knowledgeSearch } from './knowledge-search';
import { neuralSearch } from './neural-search';
import { fusionRank } from './fusion-rank';

export async function search(req: SearchRequest): Promise<SearchResult[]> {
  // 1. Classify query to determine search strategy
  const mode = classifyQueryMode(req.query);

  // 2. Route to appropriate backend(s)
  switch (mode) {
    case 'KNOWLEDGE':
      // Pure document/chunk search (existing behavior)
      return await knowledgeSearch(req);

    case 'NEURAL':
      // Pure observation/summary search
      return await neuralSearch(req);

    case 'HYBRID':
      // Both, then fusion rank
      const [knowledge, neural] = await Promise.all([
        knowledgeSearch(req),
        neuralSearch(req)
      ]);
      return fusionRank(knowledge, neural, req);

    case 'TEMPORAL':
      // Time-aware search with recency boost
      return await temporalSearch(req);

    case 'ACTOR':
      // Actor-centric search
      return await actorSearch(req);

    default:
      return await knowledgeSearch(req);
  }
}
```

## Query Classification

```typescript
enum RouterMode {
  KNOWLEDGE = 'knowledge',   // Documents/chunks only
  NEURAL = 'neural',         // Observations/summaries
  HYBRID = 'hybrid',         // Both
  TEMPORAL = 'temporal',     // Time-aware
  ACTOR = 'actor',          // Actor-centric
}

function classifyQueryMode(query: string): RouterMode {
  const q = query.toLowerCase();

  // Temporal markers → TEMPORAL or NEURAL
  if (/\b(yesterday|today|last week|recently|this sprint|past month)\b/.test(q)) {
    return RouterMode.TEMPORAL;
  }

  // Actor queries → ACTOR
  if (/@\w+/.test(q) || /\b(who (did|worked|owns|reviewed)|by \w+)\b/.test(q)) {
    return RouterMode.ACTOR;
  }

  // Document identifiers → KNOWLEDGE
  if (/#\d+|PR-\d+|[A-Z]+-\d+/.test(q)) {
    return RouterMode.KNOWLEDGE;
  }

  // Decision/incident language → NEURAL
  if (/\b(why did we|what happened|decided to|incident|outage)\b/.test(q)) {
    return RouterMode.NEURAL;
  }

  // Default: HYBRID (search both)
  return RouterMode.HYBRID;
}
```

## Neural Search Implementation

```typescript
async function neuralSearch(req: SearchRequest): Promise<SearchResult[]> {
  // 1. Generate query embedding (use content embedding model)
  const queryEmbed = await embedText(req.query, {
    model: 'text-embedding-3-large',
    dimensions: 1536
  });

  // 2. Search observations by content embedding
  const obsResults = await pinecone.query({
    namespace: `${req.workspace_id}/neural/observations/content`,
    vector: queryEmbed,
    topK: 50,
    filter: buildPineconeFilter(req.filters)
  });

  // 3. Search summaries by summary embedding
  const sumResults = await pinecone.query({
    namespace: `${req.workspace_id}/neural/summaries`,
    vector: queryEmbed,
    topK: 20,
    filter: buildPineconeFilter(req.filters)
  });

  // 4. Fetch metadata from database
  const [observations, summaries] = await Promise.all([
    db.select()
      .from(workspaceNeuralObservations)
      .where(inArray(
        workspaceNeuralObservations.id,
        obsResults.matches.map(m => m.id)
      )),

    db.select()
      .from(workspaceNeuralSummaries)
      .where(inArray(
        workspaceNeuralSummaries.id,
        sumResults.matches.map(m => m.id)
      ))
  ]);

  // 5. Merge and convert to SearchResult format
  const results: SearchResult[] = [
    ...observations.map((obs, i) => ({
      id: obs.id,
      type: 'observation' as const,
      title: obs.title,
      snippet: obs.content.slice(0, 200),
      source: 'neural_memory',
      timestamp: obs.occurredAt,
      actor: obs.actorName ? {
        name: obs.actorName,
        type: obs.actorType
      } : undefined,
      score: obsResults.matches[i]?.score ?? 0,
    })),

    ...summaries.map((sum, i) => ({
      id: sum.id,
      type: 'summary' as const,
      title: sum.title,
      snippet: sum.summary.slice(0, 200),
      source: 'neural_memory',
      timestamp: sum.periodEnd,
      score: sumResults.matches[i]?.score ?? 0,
    }))
  ];

  // 6. Sort by score and limit
  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, req.limit ?? 20);
}
```

## Temporal Search

```typescript
async function temporalSearch(req: SearchRequest): Promise<SearchResult[]> {
  // Extract time window from query
  const timeWindow = extractTimeWindow(req.query);

  // Override filters with time range
  const temporalReq = {
    ...req,
    filters: {
      ...req.filters,
      date_range: timeWindow
    }
  };

  // Search neural memory (observations are time-stamped)
  const results = await neuralSearch(temporalReq);

  // Apply recency boost
  return results.map(r => ({
    ...r,
    score: r.score * calculateRecencyBoost(r.timestamp, new Date())
  })).sort((a, b) => b.score - a.score);
}

function extractTimeWindow(query: string): [Date, Date] {
  const now = new Date();

  if (/yesterday/.test(query)) {
    return [subDays(now, 1), subDays(now, 0)];
  }

  if (/today/.test(query)) {
    return [startOfDay(now), now];
  }

  if (/last week/.test(query)) {
    return [subWeeks(now, 1), now];
  }

  if (/this sprint/.test(query)) {
    // Assume 2-week sprints
    return [subWeeks(now, 2), now];
  }

  // Default: last 30 days
  return [subDays(now, 30), now];
}

function calculateRecencyBoost(timestamp: Date, now: Date): number {
  const ageHours = (now.getTime() - timestamp.getTime()) / (1000 * 60 * 60);

  // Exponential decay: 1.0 at 0 hours, 0.5 at 7 days, 0.1 at 30 days
  return Math.exp(-ageHours / (7 * 24));
}
```

## Actor Search

```typescript
async function actorSearch(req: SearchRequest): Promise<SearchResult[]> {
  // Extract actor from query
  const actorId = extractActorId(req.query);

  if (!actorId) {
    // Fallback to neural search if no actor found
    return await neuralSearch(req);
  }

  // 1. Get actor profile
  const profile = await db.select()
    .from(workspaceActorProfiles)
    .where(
      and(
        eq(workspaceActorProfiles.workspaceId, req.workspace_id),
        eq(workspaceActorProfiles.actorId, actorId)
      )
    )
    .limit(1);

  if (!profile[0]) {
    return [];
  }

  // 2. Search observations by actor
  const observations = await db.select()
    .from(workspaceNeuralObservations)
    .where(
      and(
        eq(workspaceNeuralObservations.workspaceId, req.workspace_id),
        eq(workspaceNeuralObservations.actorId, actorId)
      )
    )
    .orderBy(desc(workspaceNeuralObservations.occurredAt))
    .limit(req.limit ?? 20);

  // 3. Convert to SearchResult
  return observations.map(obs => ({
    id: obs.id,
    type: 'observation' as const,
    title: obs.title,
    snippet: obs.content.slice(0, 200),
    source: 'neural_memory',
    timestamp: obs.occurredAt,
    actor: {
      name: obs.actorName!,
      type: obs.actorType
    },
    score: 1.0,  // Direct match, max score
  }));
}

function extractActorId(query: string): string | null {
  // Extract @mention
  const mention = query.match(/@(\w+)/);
  if (mention) {
    return mention[1];
  }

  // Extract from "by X" pattern
  const byMatch = query.match(/\bby\s+(\w+)/i);
  if (byMatch) {
    return byMatch[1];
  }

  return null;
}
```

## Fusion Ranking (HYBRID Mode)

```typescript
interface FusionWeights {
  knowledge: number;    // Document/chunk relevance
  neural: number;       // Observation/summary match
  temporal: number;     // Recency
  actor: number;        // Actor similarity
  importance: number;   // Source importance
}

function fusionRank(
  knowledge: SearchResult[],
  neural: SearchResult[],
  req: SearchRequest
): SearchResult[] {
  // 1. Get workspace-specific weights (or use defaults)
  const weights = getWorkspaceWeights(req.workspace_id) ?? {
    knowledge: 0.35,
    neural: 0.25,
    temporal: 0.15,
    actor: 0.15,
    importance: 0.10,
  };

  // 2. Combine results
  const combined = [...knowledge, ...neural];

  // 3. Calculate final score per result
  for (const result of combined) {
    const isNeural = result.type === 'observation' || result.type === 'summary';

    result.finalScore =
      (isNeural ? weights.neural : weights.knowledge) * result.score +
      weights.temporal * calculateRecencyScore(result.timestamp) +
      weights.actor * calculateActorScore(result.actor, req.query) +
      weights.importance * getImportanceScore(result.source);
  }

  // 4. Sort by final score and deduplicate
  return combined
    .sort((a, b) => (b.finalScore ?? 0) - (a.finalScore ?? 0))
    .filter((r, i, arr) => arr.findIndex(x => x.id === r.id) === i)
    .slice(0, req.limit ?? 20);
}

function calculateRecencyScore(timestamp: Date): number {
  const now = new Date();
  const ageHours = (now.getTime() - timestamp.getTime()) / (1000 * 60 * 60);

  // Exponential decay
  return Math.exp(-ageHours / (7 * 24));
}

function calculateActorScore(
  actor: { name: string; type: string } | undefined,
  query: string
): number {
  if (!actor) return 0;

  // Check if query mentions this actor
  const lowerQuery = query.toLowerCase();
  const lowerName = actor.name.toLowerCase();

  if (lowerQuery.includes(lowerName) || lowerQuery.includes(`@${lowerName}`)) {
    return 1.0;
  }

  return 0;
}

function getImportanceScore(source: string): number {
  const scores: Record<string, number> = {
    'neural_memory': 0.8,
    'document': 1.0,
    'chunk': 0.7,
  };

  return scores[source] ?? 0.5;
}
```

## Route: POST `/v1/contents`

Extended to support fetching observations and summaries by ID.

```typescript
export async function getContents(req: ContentsRequest): Promise<ContentResult[]> {
  const results: ContentResult[] = [];

  // Separate IDs by type prefix
  const obsIds = req.ids.filter(id => id.startsWith('obs_'));
  const sumIds = req.ids.filter(id => id.startsWith('sum_'));
  const docIds = req.ids.filter(id => id.startsWith('doc_'));
  const chunkIds = req.ids.filter(id => id.startsWith('chunk_'));

  // Fetch in parallel
  const [observations, summaries, documents, chunks] = await Promise.all([
    obsIds.length > 0
      ? db.select().from(workspaceNeuralObservations)
          .where(inArray(workspaceNeuralObservations.id, obsIds))
      : [],

    sumIds.length > 0
      ? db.select().from(workspaceNeuralSummaries)
          .where(inArray(workspaceNeuralSummaries.id, sumIds))
      : [],

    docIds.length > 0
      ? db.select().from(workspaceDocuments)
          .where(inArray(workspaceDocuments.id, docIds))
      : [],

    chunkIds.length > 0
      ? db.select().from(workspaceChunks)
          .where(inArray(workspaceChunks.id, chunkIds))
      : [],
  ]);

  // Convert to ContentResult format
  results.push(
    ...observations.map(obs => ({
      id: obs.id,
      type: 'observation' as const,
      content: obs.content,
      metadata: {
        title: obs.title,
        occurred_at: obs.occurredAt,
        actor: {
          type: obs.actorType,
          name: obs.actorName,
        },
        source_references: obs.sourceReferences,
      }
    })),

    ...summaries.map(sum => ({
      id: sum.id,
      type: 'summary' as const,
      content: sum.summary,
      metadata: {
        title: sum.title,
        period: [sum.periodStart, sum.periodEnd],
        observation_count: sum.observationCount,
        key_points: sum.keyPoints,
      }
    })),

    // ... documents and chunks (existing logic)
  );

  return results;
}
```

## Route: POST `/v1/answer`

Enhanced with neural memory context.

```typescript
export async function answer(req: AnswerRequest): Promise<AnswerResponse> {
  // 1. Search with HYBRID mode to get both documents and observations
  const searchResults = await search({
    query: req.query,
    workspace_id: req.workspace_id,
    limit: 10,
  });

  // 2. Fetch full content for top results
  const contents = await getContents({
    ids: searchResults.map(r => r.id),
    workspace_id: req.workspace_id,
  });

  // 3. Build context for LLM
  const context = contents.map(c => ({
    id: c.id,
    type: c.type,
    content: c.content,
    metadata: c.metadata,
  }));

  // 4. Generate answer with citations
  const answer = await llm.generate({
    model: 'claude-3-5-sonnet-20241022',
    messages: [
      {
        role: 'system',
        content: ANSWER_SYSTEM_PROMPT
      },
      {
        role: 'user',
        content: buildAnswerPrompt(req.query, context)
      }
    ],
    stream: req.stream,
  });

  return {
    answer: answer.content,
    citations: extractCitations(answer.content, context),
    sources: searchResults.slice(0, 5),
  };
}

const ANSWER_SYSTEM_PROMPT = `You are a helpful assistant that answers questions using the provided context.

When answering:
1. Only use information from the provided context
2. Cite sources using [source_id] notation
3. If the context doesn't contain the answer, say so
4. For observations, include who did what and when
5. For summaries, reference the time period covered`;

function buildAnswerPrompt(query: string, context: ContentResult[]): string {
  const contextStr = context.map(c => {
    const metadata = c.type === 'observation'
      ? `[${c.id}] ${c.metadata.actor?.name} on ${c.metadata.occurred_at}`
      : `[${c.id}] ${c.type}`;

    return `${metadata}\n${c.content}`;
  }).join('\n\n---\n\n');

  return `Context:\n\n${contextStr}\n\n---\n\nQuestion: ${query}`;
}
```

---

_Last updated: 2025-11-27_
