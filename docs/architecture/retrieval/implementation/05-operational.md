---
title: Operational Patterns
description: Cost controls, monitoring, error handling, and data retention
status: draft
audience: engineering
last_updated: 2025-11-27
tags: [neural-memory, implementation, operations]
---

# Operational Patterns

## Error Handling & Retries

### Inngest Configuration

```typescript
export const observationCapture = inngest.createFunction(
  {
    id: "neural.observation.capture",
    concurrency: {
      limit: 20,                    // Max 20 concurrent per workspace
      key: "event.data.workspace_id"
    },
    retries: 3,                     // Retry on transient failures
  },
  { event: "neural/observation.capture" },
  async ({ event, step }) => {
    // Implementation
  }
);
```

### Graceful Degradation

When non-critical operations fail (e.g., embedding generation), continue without them and queue for retry.

```typescript
// If embedding generation fails, store observation without embeddings
const embeddings = await step.run("generate-embeddings", async () => {
  try {
    return await generateMultiViewEmbeddings(observation);
  } catch (error) {
    // Log error
    console.error('Embedding generation failed:', error);

    // Track metric
    metrics.embeddingErrors.inc({
      workspace_id: workspaceId,
      error_type: error.name
    });

    // Queue for retry later
    await step.sendEvent("retry-embeddings", {
      name: "neural/embeddings.retry",
      data: {
        observationId: observation.id,
        attempt: 1,
        maxAttempts: 3
      }
    });

    // Return null to continue without embeddings
    return null;
  }
});

// Store observation even if embeddings failed
await step.run("store-observation", async () => {
  return await db.insert(workspaceNeuralObservations).values({
    ...observation,
    embeddingTitleId: embeddings?.titleId ?? null,
    embeddingContentId: embeddings?.contentId ?? null,
    embeddingSummaryId: embeddings?.summaryId ?? null,
  });
});
```

### Embedding Retry Function

```typescript
export const embeddingsRetry = inngest.createFunction(
  {
    id: "neural.embeddings.retry",
    retries: 0,  // No retries at function level (we handle it ourselves)
  },
  { event: "neural/embeddings.retry" },
  async ({ event, step }) => {
    const { observationId, attempt, maxAttempts } = event.data;

    if (attempt > maxAttempts) {
      console.error(`Max retry attempts reached for observation ${observationId}`);
      return { skipped: true, reason: 'Max retries exceeded' };
    }

    // Wait before retrying (exponential backoff)
    await step.sleep("backoff", Math.pow(2, attempt) * 1000);

    // Fetch observation
    const observation = await step.run("fetch-observation", async () => {
      return await db.select()
        .from(workspaceNeuralObservations)
        .where(eq(workspaceNeuralObservations.id, observationId))
        .limit(1);
    });

    if (!observation[0]) {
      return { skipped: true, reason: 'Observation not found' };
    }

    // Retry embedding generation
    const embeddings = await step.run("generate-embeddings", async () => {
      try {
        return await generateMultiViewEmbeddings(observation[0]);
      } catch (error) {
        // Queue another retry
        await step.sendEvent("retry-again", {
          name: "neural/embeddings.retry",
          data: {
            observationId,
            attempt: attempt + 1,
            maxAttempts
          }
        });
        throw error;
      }
    });

    // Update observation with embeddings
    await step.run("update-observation", async () => {
      return await db.update(workspaceNeuralObservations)
        .set({
          embeddingTitleId: embeddings.titleId,
          embeddingContentId: embeddings.contentId,
          embeddingSummaryId: embeddings.summaryId,
        })
        .where(eq(workspaceNeuralObservations.id, observationId));
    });

    return { success: true, attempt };
  }
);
```

## Cost Controls

### Per-Workspace Quotas

```typescript
const WORKSPACE_QUOTAS = {
  free: {
    observations: 1000,        // Max 1k observations/month
    summaries: 10,             // Max 10 summaries/month
  },
  pro: {
    observations: 50000,
    summaries: 500,
  },
  enterprise: {
    observations: Infinity,
    summaries: Infinity,
  }
};

async function checkQuota(
  workspaceId: string,
  quotaType: 'observations' | 'summaries'
): Promise<boolean> {
  // Get current month's usage
  const usage = await db.select({
    count: sql<number>`count(*)`,
  })
    .from(quotaType === 'observations'
      ? workspaceNeuralObservations
      : workspaceNeuralSummaries
    )
    .where(
      and(
        eq(workspaceNeuralObservations.workspaceId, workspaceId),
        gte(
          workspaceNeuralObservations.createdAt,
          startOfMonth(new Date())
        )
      )
    );

  // Get workspace tier
  const workspace = await db.select()
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);

  const tier = workspace[0]?.tier ?? 'free';
  const quota = WORKSPACE_QUOTAS[tier][quotaType];

  // Check if under quota
  return usage[0].count < quota;
}

// Use in observation capture
export const observationCapture = inngest.createFunction(
  // ... config
  async ({ event, step }) => {
    // Check quota before processing
    const withinQuota = await step.run("check-quota", async () => {
      return await checkQuota(event.data.workspaceId, 'observations');
    });

    if (!withinQuota) {
      return {
        skipped: true,
        reason: 'Monthly observation quota exceeded'
      };
    }

    // Continue with observation capture...
  }
);
```

### Embedding Cost Optimization

Cache embeddings for identical content to avoid duplicate API calls.

```typescript
async function generateEmbeddingCached(
  text: string,
  options: { model: string; dimensions: number }
): Promise<string> {
  // Generate hash of text + options
  const hash = hashText(text + options.model + options.dimensions);
  const cacheKey = `embedding:${hash}`;

  // Check Redis cache
  const cached = await redis.get(cacheKey);
  if (cached) {
    metrics.embeddingCacheHits.inc();
    return cached;
  }

  // Generate new embedding
  metrics.embeddingCacheMisses.inc();
  const embeddingId = await generateEmbedding(text, options);

  // Cache for 30 days
  await redis.set(cacheKey, embeddingId, { ex: 30 * 24 * 60 * 60 });

  return embeddingId;
}

function hashText(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex');
}
```

### LLM Call Batching

Batch classification calls to reduce API requests.

```typescript
async function batchClassify(
  observations: SourceEvent[]
): Promise<Classification[]> {
  const batches = chunk(observations, 10);  // Process 10 at a time

  return await Promise.all(
    batches.map(batch =>
      llm.generate({
        model: 'claude-3-haiku',  // Use cheaper model
        messages: [{
          role: 'user',
          content: `Classify these events as decision/change/incident/highlight:

${batch.map((obs, i) => `${i + 1}. ${obs.title}\n${obs.body?.slice(0, 200)}`).join('\n\n')}

Return JSON array: [{"index": 1, "type": "decision", "confidence": 0.85}, ...]`
        }],
        maxTokens: 500
      })
    )
  ).then(results =>
    results.flatMap(r => JSON.parse(r.content))
  );
}
```

## Performance Monitoring

### Key Metrics

```typescript
import { Counter, Histogram, Gauge } from 'prom-client';

const metrics = {
  // Throughput
  observationsCreated: new Counter({
    name: 'neural_observations_created_total',
    help: 'Total observations created',
    labelNames: ['workspace_id', 'type']
  }),

  summariesGenerated: new Counter({
    name: 'neural_summaries_generated_total',
    help: 'Total summaries generated',
    labelNames: ['workspace_id', 'summary_type']
  }),

  // Latency
  observationCaptureLatency: new Histogram({
    name: 'neural_observation_capture_latency_ms',
    help: 'Observation capture latency',
    buckets: [100, 500, 1000, 2000, 5000, 10000]
  }),

  neuralSearchLatency: new Histogram({
    name: 'neural_search_latency_ms',
    help: 'Neural search latency',
    buckets: [50, 100, 200, 500, 1000]
  }),

  // Quality
  observationQualityScore: new Gauge({
    name: 'neural_observation_quality_score',
    help: 'Average observation quality score'
  }),

  embeddingCacheHitRate: new Gauge({
    name: 'neural_embedding_cache_hit_rate',
    help: 'Embedding cache hit rate'
  }),

  // Cost
  embeddingApiCalls: new Counter({
    name: 'neural_embedding_api_calls_total',
    help: 'Total embedding API calls'
  }),

  llmApiCalls: new Counter({
    name: 'neural_llm_api_calls_total',
    help: 'Total LLM API calls',
    labelNames: ['model']
  }),

  estimatedMonthlyCost: new Gauge({
    name: 'neural_estimated_monthly_cost_usd',
    help: 'Estimated monthly cost',
    labelNames: ['workspace_id']
  }),

  // Errors
  captureErrors: new Counter({
    name: 'neural_capture_errors_total',
    help: 'Observation capture errors',
    labelNames: ['error_type']
  }),

  embeddingErrors: new Counter({
    name: 'neural_embedding_errors_total',
    help: 'Embedding generation errors',
    labelNames: ['workspace_id']
  }),
};

// Usage in functions
export const observationCapture = inngest.createFunction(
  // ... config
  async ({ event, step }) => {
    const startTime = Date.now();

    try {
      // ... capture logic

      // Track success
      metrics.observationsCreated.inc({
        workspace_id: workspaceId,
        type: observation.type
      });

      // Track latency
      metrics.observationCaptureLatency.observe(Date.now() - startTime);

      return { success: true };
    } catch (error) {
      // Track error
      metrics.captureErrors.inc({
        error_type: error.name
      });

      throw error;
    }
  }
);
```

### Alerting

```yaml
# alerts.yml (for Prometheus Alertmanager)
groups:
  - name: neural_memory
    interval: 1m
    rules:
      - alert: HighErrorRate
        expr: |
          rate(neural_capture_errors_total[5m]) / rate(neural_observations_created_total[5m]) > 0.05
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High observation capture error rate"
          description: "{{ $value | humanizePercentage }} of observations are failing"

      - alert: SlowObservationCapture
        expr: |
          histogram_quantile(0.95, neural_observation_capture_latency_ms) > 5000
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Slow observation capture (p95 > 5s)"

      - alert: QuotaExceeded
        expr: |
          neural_observations_created_total{workspace_id=~".+"} >= workspace_quota{type="observations"}
        labels:
          severity: info
        annotations:
          summary: "Workspace {{ $labels.workspace_id }} exceeded observation quota"

      - alert: HighMonthlyCost
        expr: |
          neural_estimated_monthly_cost_usd > 1000
        labels:
          severity: warning
        annotations:
          summary: "High monthly cost estimate: ${{ $value }}"
```

## Data Retention & Archival

### Observation Lifecycle

```typescript
const RETENTION_POLICY = {
  observations: {
    active: 90,      // 90 days in main table
    archive: 365,    // Move to archive after 90 days, keep for 1 year
  },
  summaries: {
    active: 180,     // 6 months in main table
    archive: 730,    // Move to archive after 6 months, keep for 2 years
  },
};

// Daily archival job (runs at 3 AM)
export const archiveOldObservations = inngest.createFunction(
  {
    id: "neural.observations.archive",
    concurrency: { limit: 1 }  // Run serially
  },
  { cron: "0 3 * * *" },
  async ({ step }) => {
    const cutoffDate = subDays(new Date(), RETENTION_POLICY.observations.active);

    const archived = await step.run("archive-observations", async () => {
      return await db.transaction(async (tx) => {
        // Find old observations
        const old = await tx.select()
          .from(workspaceNeuralObservations)
          .where(lt(workspaceNeuralObservations.occurredAt, cutoffDate));

        if (old.length === 0) {
          return 0;
        }

        // Copy to archive table
        await tx.insert(workspaceNeuralObservationsArchive).values(old);

        // Delete from active table
        await tx.delete(workspaceNeuralObservations)
          .where(lt(workspaceNeuralObservations.occurredAt, cutoffDate));

        console.log(`Archived ${old.length} observations`);
        return old.length;
      });
    });

    // Update metrics
    metrics.observationsArchived.inc({ count: archived });

    return { archived };
  }
);

// Archive table schema (identical to main table)
export const workspaceNeuralObservationsArchive = pgTable(
  'workspace_neural_observations_archive',
  {
    // Same schema as workspace_neural_observations
    // ...
    archivedAt: timestamp('archived_at').defaultNow(),
  }
);
```

### Delete Old Archives

```typescript
// Monthly cleanup job (runs 1st of month at 4 AM)
export const deleteOldArchives = inngest.createFunction(
  {
    id: "neural.archives.delete",
    concurrency: { limit: 1 }
  },
  { cron: "0 4 1 * *" },
  async ({ step }) => {
    const cutoffDate = subDays(new Date(), RETENTION_POLICY.observations.archive);

    const deleted = await step.run("delete-old-archives", async () => {
      const result = await db.delete(workspaceNeuralObservationsArchive)
        .where(lt(workspaceNeuralObservationsArchive.occurredAt, cutoffDate));

      console.log(`Deleted ${result.count} archived observations`);
      return result.count;
    });

    return { deleted };
  }
);
```

## Health Checks

```typescript
// Health check endpoint for neural memory system
export async function neuralHealthCheck(): Promise<{
  status: 'healthy' | 'degraded' | 'down';
  checks: Record<string, boolean>;
}> {
  const checks = {
    database: false,
    pinecone: false,
    redis: false,
    embeddings: false,
  };

  try {
    // Check database
    await db.select().from(workspaceNeuralObservations).limit(1);
    checks.database = true;
  } catch (error) {
    console.error('Database health check failed:', error);
  }

  try {
    // Check Pinecone
    await pinecone.describeIndex('workspace_default');
    checks.pinecone = true;
  } catch (error) {
    console.error('Pinecone health check failed:', error);
  }

  try {
    // Check Redis
    await redis.ping();
    checks.redis = true;
  } catch (error) {
    console.error('Redis health check failed:', error);
  }

  try {
    // Check embedding API
    await generateEmbedding('health check', {
      model: 'text-embedding-3-small',
      dimensions: 512
    });
    checks.embeddings = true;
  } catch (error) {
    console.error('Embedding API health check failed:', error);
  }

  // Determine overall status
  const allHealthy = Object.values(checks).every(Boolean);
  const someHealthy = Object.values(checks).some(Boolean);

  const status = allHealthy
    ? 'healthy'
    : someHealthy
    ? 'degraded'
    : 'down';

  return { status, checks };
}
```

---

_Last updated: 2025-11-27_
