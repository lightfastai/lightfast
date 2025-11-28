---
title: Quality Metrics & Measurement
description: Evaluation pipelines, test queries, and quality tracking
status: draft
audience: engineering
last_updated: 2025-11-27
tags: [neural-memory, implementation, quality]
---

# Quality Metrics & Measurement

## Overview

Neural memory quality is measured through continuous evaluation of retrieval effectiveness, summary coherence, and profile accuracy. Metrics are tracked per workspace and used to tune system parameters.

## Retrieval Quality Metrics

### Observation Coverage

**Definition:** What % of significant events are captured as observations?

**Measurement:**
```typescript
interface CoverageMetrics {
  captureRate: {
    target: 0.95,      // Capture ≥95% of significant events
    current: number,
    measurement: 'Compare captured observations vs source event volume'
  };

  qualityRate: {
    target: 0.90,      // ≥90% pass quality validation
    current: number,
    measurement: 'Quality score ≥ 0.7'
  };
}

async function measureCoverageRate(workspaceId: string): Promise<number> {
  // Get total source events in last 24h
  const totalEvents = await db.select({
    count: sql<number>`count(*)`
  })
    .from(sourceEvents)
    .where(
      and(
        eq(sourceEvents.workspaceId, workspaceId),
        gte(sourceEvents.occurredAt, subDays(new Date(), 1))
      )
    );

  // Get observations created in last 24h
  const observations = await db.select({
    count: sql<number>`count(*)`
  })
    .from(workspaceNeuralObservations)
    .where(
      and(
        eq(workspaceNeuralObservations.workspaceId, workspaceId),
        gte(workspaceNeuralObservations.occurredAt, subDays(new Date(), 1))
      )
    );

  return observations[0].count / totalEvents[0].count;
}
```

### Neural Search Recall

**Definition:** For a given query, what % of relevant observations are returned in top-K results?

**Measurement:**
```typescript
interface RecallMetrics {
  recall_at_5: number;   // % relevant in top 5
  recall_at_10: number;  // % relevant in top 10
  recall_at_20: number;  // % relevant in top 20
}

async function measureRecall(
  query: string,
  relevantIds: string[],
  k: number
): Promise<number> {
  // Run neural search
  const results = await neuralSearch({
    query,
    workspace_id: 'test_workspace',
    limit: k
  });

  // Count how many relevant IDs appear in results
  const foundRelevant = results.filter(r =>
    relevantIds.includes(r.id)
  ).length;

  return foundRelevant / relevantIds.length;
}
```

### Fusion Ranking Improvement

**Definition:** How much does hybrid mode (knowledge + neural) improve over knowledge-only?

**Measurement:**
```typescript
interface FusionMetrics {
  fusionLift: {
    target: 0.15,      // 15% improvement over knowledge-only
    measurement: 'NDCG@10 improvement',
  };
}

async function measureFusionLift(
  testQueries: TestQuery[]
): Promise<number> {
  const ndcgScores = await Promise.all(
    testQueries.map(async (tq) => {
      // Run knowledge-only search
      const knowledgeResults = await knowledgeSearch({
        query: tq.query,
        workspace_id: tq.workspaceId,
        limit: 10
      });

      // Run hybrid search
      const hybridResults = await search({
        query: tq.query,
        workspace_id: tq.workspaceId,
        limit: 10
      });

      // Calculate NDCG for each
      const knowledgeNDCG = calculateNDCG(knowledgeResults, tq.relevantIds);
      const hybridNDCG = calculateNDCG(hybridResults, tq.relevantIds);

      return {
        knowledge: knowledgeNDCG,
        hybrid: hybridNDCG,
        improvement: (hybridNDCG - knowledgeNDCG) / knowledgeNDCG
      };
    })
  );

  // Average improvement
  return mean(ndcgScores.map(s => s.improvement));
}

function calculateNDCG(
  results: SearchResult[],
  relevantIds: string[]
): number {
  // Calculate DCG (Discounted Cumulative Gain)
  const dcg = results.reduce((sum, result, i) => {
    const relevance = relevantIds.includes(result.id) ? 1 : 0;
    const discount = Math.log2(i + 2);  // Position discount
    return sum + (relevance / discount);
  }, 0);

  // Calculate ideal DCG (all relevant items at top)
  const idealDcg = relevantIds.slice(0, results.length).reduce((sum, _, i) => {
    const discount = Math.log2(i + 2);
    return sum + (1 / discount);
  }, 0);

  // Normalized DCG
  return dcg / idealDcg;
}
```

## Summary Quality Metrics

### Coherence (Human Evaluation)

**Definition:** Human raters score summary quality on 1-5 scale.

**Measurement:**
```typescript
interface CoherenceMetrics {
  avgScore: number;     // Target: ≥4.0
  sampleSize: number;   // 50 summaries/week
}

async function trackSummaryCoherence(
  summaryId: string,
  rating: number,  // 1-5
  feedback: string
): Promise<void> {
  await db.insert(summaryEvaluations).values({
    id: generateId(),
    summaryId,
    rating,
    feedback,
    evaluatedAt: new Date(),
  });
}

async function getAvgCoherenceScore(): Promise<number> {
  const result = await db.select({
    avg: sql<number>`AVG(rating)`
  })
    .from(summaryEvaluations)
    .where(
      gte(summaryEvaluations.evaluatedAt, subDays(new Date(), 7))
    );

  return result[0].avg;
}
```

### Faithfulness (Automated)

**Definition:** What % of claims in summary are supported by source observations?

**Measurement:**
```typescript
interface FaithfulnessMetrics {
  faithfulnessRate: {
    target: 0.95,      // ≥95% claims supported
    measurement: 'LLM-as-judge checks claims against sources'
  };
}

async function measureFaithfulness(
  summary: Summary,
  observations: Observation[]
): Promise<number> {
  // Extract claims from summary
  const claims = await extractClaims(summary.summary);

  // Verify each claim against observations
  const verifications = await Promise.all(
    claims.map(claim =>
      verifyClaim(claim, observations)
    )
  );

  // % of claims that are supported
  return verifications.filter(v => v.supported).length / claims.length;
}

async function extractClaims(summaryText: string): Promise<string[]> {
  const response = await llm.generate({
    model: 'claude-3-5-sonnet-20241022',
    messages: [{
      role: 'user',
      content: `Extract all factual claims from this summary as a JSON array:

${summaryText}

Return: ["claim 1", "claim 2", ...]`
    }],
    maxTokens: 500
  });

  return JSON.parse(response.content);
}

async function verifyClaim(
  claim: string,
  observations: Observation[]
): Promise<{ claim: string; supported: boolean; evidence?: string }> {
  const observationTexts = observations.map(obs =>
    `[${obs.id}] ${obs.title}\n${obs.content}`
  ).join('\n\n---\n\n');

  const response = await llm.generate({
    model: 'claude-3-5-sonnet-20241022',
    messages: [{
      role: 'user',
      content: `Is this claim supported by the observations?

Claim: "${claim}"

Observations:
${observationTexts}

Return JSON: {"supported": true/false, "evidence": "quote from observation if supported"}`
    }],
    maxTokens: 200
  });

  return JSON.parse(response.content);
}
```

## Test Query Management

### Test Query Schema

```sql
CREATE TABLE evaluation_queries (
  id VARCHAR(191) PRIMARY KEY,
  workspace_id VARCHAR(191) NOT NULL,

  -- Query
  query TEXT NOT NULL,
  category VARCHAR(50) NOT NULL,  -- 'actor' | 'temporal' | 'decision' | 'incident'

  -- Ground truth
  relevant_ids JSONB NOT NULL,    -- Array of observation/summary IDs that should match
  min_recall FLOAT DEFAULT 0.8,   -- Minimum acceptable recall for this query

  -- Metadata
  enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  last_evaluated_at TIMESTAMP
);

CREATE INDEX idx_eval_queries_workspace ON evaluation_queries(workspace_id, enabled);
```

### Example Test Queries

```typescript
const testQueries: TestQuery[] = [
  {
    id: 'eval_actor_1',
    workspaceId: 'ws_123',
    query: 'Who worked on authentication?',
    category: 'actor',
    relevantIds: ['obs_456', 'obs_789', 'sum_101'],
    minRecall: 0.8,
  },
  {
    id: 'eval_temporal_1',
    workspaceId: 'ws_123',
    query: 'What happened yesterday?',
    category: 'temporal',
    relevantIds: ['obs_201', 'obs_202', 'sum_303'],
    minRecall: 0.85,
  },
  {
    id: 'eval_decision_1',
    workspaceId: 'ws_123',
    query: 'Why did we choose PostgreSQL?',
    category: 'decision',
    relevantIds: ['obs_404'],
    minRecall: 1.0,  // Should definitely find this
  },
];

// Insert test queries
await db.insert(evaluationQueries).values(testQueries);
```

## Continuous Evaluation Pipeline

### Daily Evaluation Job

```typescript
export const evaluateRetrievalQuality = inngest.createFunction(
  {
    id: "neural.evaluation.daily",
    concurrency: { limit: 1 }
  },
  { cron: "0 4 * * *" },  // Daily at 4 AM
  async ({ step }) => {
    // Step 1: Load enabled test queries
    const testQueries = await step.run("load-test-queries", async () => {
      return await db.select()
        .from(evaluationQueries)
        .where(eq(evaluationQueries.enabled, true));
    });

    // Step 2: Evaluate each query
    const results = await step.run("evaluate-queries", async () => {
      return await Promise.all(
        testQueries.map(async (tq) => {
          // Run search
          const searchResults = await neuralSearch({
            query: tq.query,
            workspace_id: tq.workspaceId,
            limit: 20
          });

          // Calculate metrics
          const recall_at_5 = calculateRecall(searchResults.slice(0, 5), tq.relevantIds);
          const recall_at_10 = calculateRecall(searchResults.slice(0, 10), tq.relevantIds);
          const recall_at_20 = calculateRecall(searchResults.slice(0, 20), tq.relevantIds);

          return {
            queryId: tq.id,
            category: tq.category,
            recall_at_5,
            recall_at_10,
            recall_at_20,
            passesThreshold: recall_at_20 >= tq.minRecall,
            latency: searchResults.latency,
          };
        })
      );
    });

    // Step 3: Store results
    await step.run("store-results", async () => {
      await db.insert(evaluationResults).values({
        id: generateId(),
        evaluatedAt: new Date(),
        results: JSON.stringify(results),
        avgRecall_at_10: mean(results.map(r => r.recall_at_10)),
        avgLatency: mean(results.map(r => r.latency)),
      });
    });

    // Step 4: Alert if below threshold
    const avgRecall = mean(results.map(r => r.recall_at_10));
    if (avgRecall < 0.85) {
      await step.sendEvent("alert-low-recall", {
        name: "neural/quality.alert",
        data: {
          metric: 'recall@10',
          value: avgRecall,
          threshold: 0.85,
          failingQueries: results.filter(r => !r.passesThreshold)
        }
      });
    }

    return {
      evaluated: testQueries.length,
      avgRecall_at_10: avgRecall,
      failingQueries: results.filter(r => !r.passesThreshold).length
    };
  }
);

function calculateRecall(
  results: SearchResult[],
  relevantIds: string[]
): number {
  const found = results.filter(r => relevantIds.includes(r.id)).length;
  return found / relevantIds.length;
}
```

### Evaluation Results Schema

```sql
CREATE TABLE evaluation_results (
  id VARCHAR(191) PRIMARY KEY,
  evaluated_at TIMESTAMP NOT NULL,

  -- Aggregated metrics
  avg_recall_at_5 FLOAT,
  avg_recall_at_10 FLOAT,
  avg_recall_at_20 FLOAT,
  avg_latency FLOAT,

  -- Detailed results (JSON)
  results JSONB NOT NULL,

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_eval_results_date ON evaluation_results(evaluated_at DESC);
```

## Performance SLOs

### Latency Targets

```typescript
interface LatencySLOs {
  observationCapture: {
    p50: 800,          // 50th percentile: 800ms
    p95: 2000,         // 95th percentile: 2s
    p99: 5000,         // 99th percentile: 5s
  };

  neuralSearch: {
    p50: 150,          // 50th percentile: 150ms
    p95: 500,          // 95th percentile: 500ms
    p99: 1000,         // 99th percentile: 1s
  };

  summaryGeneration: {
    p50: 30000,        // 50th percentile: 30s
    p95: 120000,       // 95th percentile: 2min
    p99: 300000,       // 99th percentile: 5min
  };
}

// Track SLO compliance
async function checkSLOCompliance(): Promise<SLOReport> {
  const metrics = await queryPrometheus(`
    histogram_quantile(0.95, neural_observation_capture_latency_ms)
  `);

  return {
    observationCapture_p95: {
      current: metrics.observationCapture_p95,
      target: 2000,
      compliant: metrics.observationCapture_p95 < 2000
    },
    // ... other metrics
  };
}
```

## Cost Tracking

```typescript
interface CostMetrics {
  embedding: {
    callsPerDay: number;
    costPerDay: number;      // $0.0003 per embedding × 3 views
    monthlyEstimate: number;
  };

  llm: {
    callsPerDay: number;
    costPerDay: number;      // Varies by model
    monthlyEstimate: number;
  };

  storage: {
    observationCount: number;
    monthlyCost: number;     // DB + Pinecone
  };
}

async function calculateMonthlyCost(workspaceId: string): Promise<number> {
  // Embedding cost
  const embeddingCalls = await getEmbeddingCallsThisMonth(workspaceId);
  const embeddingCost = embeddingCalls * 0.0003;  // $0.0003 per embedding

  // LLM cost
  const llmCalls = await getLLMCallsThisMonth(workspaceId);
  const llmCost = llmCalls * 0.01;  // Rough estimate

  // Storage cost
  const obsCount = await getObservationCount(workspaceId);
  const storageCost = obsCount * 0.00001;  // $0.00001 per observation/month

  return embeddingCost + llmCost + storageCost;
}
```

---

_Last updated: 2025-11-27_
