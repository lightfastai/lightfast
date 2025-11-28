---
title: Summaries & Actor Profiles
description: Generating summaries from observations and building actor profiles
status: draft
audience: engineering
last_updated: 2025-11-27
tags: [neural-memory, implementation, inngest]
---

# Summaries & Actor Profiles

## Overview

Summaries synthesize multiple observations into higher-level insights. Actor profiles aggregate observations to model expertise, patterns, and relationships. Both are generated asynchronously via Inngest functions.

## Summary Generation

### Summary Types

| Type | Scope | Trigger | Example |
|------|-------|---------|---------|
| **Temporal** | Time window (daily/weekly) | Cron schedule | "Engineering Week 47" |
| **Topic** | Subject cluster | Manual or threshold | "Authentication implementation" |
| **Entity** | Actor/project | Manual request | "John's contributions this sprint" |

### Temporal Summary (Daily)

Generated every day at 2 AM for the previous 24 hours.

```typescript
export const dailySummaryGenerate = inngest.createFunction(
  {
    id: "neural.summary.daily",
    concurrency: { limit: 5, key: "event.data.workspace_id" }
  },
  { cron: "0 2 * * *" },  // Daily at 2 AM UTC
  async ({ step }) => {
    // Get all active workspaces
    const workspaces = await step.run("get-workspaces", async () => {
      return await db.select()
        .from(workspaces)
        .where(eq(workspaces.status, 'active'));
    });

    // Trigger summary generation for each workspace
    await step.sendEvent("trigger-workspace-summaries",
      workspaces.map(ws => ({
        name: "neural/summary.generate",
        data: {
          workspaceId: ws.id,
          summaryType: 'temporal',
          period: {
            start: subDays(new Date(), 1),
            end: new Date()
          }
        }
      }))
    );
  }
);

export const summaryGenerate = inngest.createFunction(
  {
    id: "neural.summary.generate",
    concurrency: { limit: 3, key: "event.data.workspace_id" }
  },
  { event: "neural/summary.generate" },
  async ({ event, step }) => {
    const { workspaceId, summaryType, period } = event.data;

    // Step 1: Gather observations
    const observations = await step.run("gather-observations", async () => {
      return await db.select()
        .from(workspaceNeuralObservations)
        .where(
          and(
            eq(workspaceNeuralObservations.workspaceId, workspaceId),
            gte(workspaceNeuralObservations.occurredAt, period.start),
            lte(workspaceNeuralObservations.occurredAt, period.end)
          )
        )
        .orderBy(desc(workspaceNeuralObservations.occurredAt));
    });

    if (observations.length < MIN_OBSERVATIONS_FOR_SUMMARY) {
      return {
        skipped: true,
        reason: "Insufficient observations",
        count: observations.length
      };
    }

    // Step 2: Cluster observations
    const clusters = await step.run("cluster-observations", async () => {
      return await clusterByEmbedding(observations, {
        maxClusters: Math.min(5, Math.floor(observations.length / 3))
      });
    });

    // Step 3: Generate summary per cluster
    const clusterSummaries = await step.run("generate-cluster-summaries", async () => {
      return await Promise.all(
        clusters.map(cluster =>
          generateClusterSummary(cluster.observations)
        )
      );
    });

    // Step 4: Synthesize master summary
    const masterSummary = await step.run("synthesize-master", async () => {
      return await synthesizeMasterSummary({
        clusterSummaries,
        totalObservations: observations.length,
        period
      });
    });

    // Step 5: Generate embedding
    const embedding = await step.run("generate-embedding", async () => {
      return await generateEmbedding(masterSummary.summary, {
        model: 'text-embedding-3-small',
        dimensions: 768
      });
    });

    // Step 6: Store summary
    const stored = await step.run("store-summary", async () => {
      return await db.insert(workspaceNeuralSummaries).values({
        id: generateSummaryId(),
        workspaceId,
        storeId: observations[0].storeId,

        summaryType,
        summaryScope: 'daily',

        periodStart: period.start,
        periodEnd: period.end,

        title: masterSummary.title,
        summary: masterSummary.summary,
        keyPoints: masterSummary.keyPoints,

        observationIds: observations.map(o => o.id),
        observationCount: observations.length,

        primaryEntities: extractPrimaryEntities(observations),
        topics: masterSummary.topics,

        embeddingId: embedding.id,
        confidenceScore: masterSummary.confidence,

        createdAt: new Date(),
      }).returning();
    });

    return {
      success: true,
      summaryId: stored[0].id,
      observationCount: observations.length,
      clusterCount: clusters.length
    };
  }
);
```

### Clustering Algorithm

```typescript
const MIN_OBSERVATIONS_FOR_SUMMARY = 3;

interface Cluster {
  id: string;
  observations: Observation[];
  centroid: number[];
  coherence: number;
}

async function clusterByEmbedding(
  observations: Observation[],
  options: { maxClusters: number }
): Promise<Cluster[]> {
  // Get content embeddings for all observations
  const embeddings = await Promise.all(
    observations.map(obs =>
      getEmbeddingVector(obs.embeddingContentId)
    )
  );

  // Use k-means clustering
  const k = options.maxClusters;
  const clusters: Cluster[] = [];

  // Initialize centroids randomly
  let centroids = embeddings
    .sort(() => Math.random() - 0.5)
    .slice(0, k);

  // Iterate until convergence (max 10 iterations)
  for (let iter = 0; iter < 10; iter++) {
    // Assign observations to nearest centroid
    const assignments = embeddings.map(emb =>
      findNearestCentroid(emb, centroids)
    );

    // Update centroids
    const newCentroids = centroids.map((_, i) => {
      const clusterEmbeddings = embeddings.filter((_, j) => assignments[j] === i);
      return calculateCentroid(clusterEmbeddings);
    });

    // Check convergence
    if (centroidsEqual(centroids, newCentroids)) {
      break;
    }

    centroids = newCentroids;
  }

  // Build cluster objects
  centroids.forEach((centroid, i) => {
    const clusterObs = observations.filter((_, j) => {
      const emb = embeddings[j];
      return findNearestCentroid(emb, centroids) === i;
    });

    if (clusterObs.length > 0) {
      clusters.push({
        id: `cluster_${i}`,
        observations: clusterObs,
        centroid,
        coherence: calculateCoherence(clusterObs, centroid)
      });
    }
  });

  return clusters;
}

function findNearestCentroid(embedding: number[], centroids: number[][]): number {
  let minDist = Infinity;
  let nearest = 0;

  centroids.forEach((centroid, i) => {
    const dist = cosineDist(embedding, centroid);
    if (dist < minDist) {
      minDist = dist;
      nearest = i;
    }
  });

  return nearest;
}

function calculateCentroid(embeddings: number[][]): number[] {
  if (embeddings.length === 0) return [];

  const dim = embeddings[0].length;
  const centroid = new Array(dim).fill(0);

  embeddings.forEach(emb => {
    emb.forEach((val, i) => {
      centroid[i] += val;
    });
  });

  return centroid.map(val => val / embeddings.length);
}
```

### LLM Summarization

```typescript
async function generateClusterSummary(
  observations: Observation[]
): Promise<string> {
  const observationTexts = observations.map(obs =>
    `[${obs.type}] ${obs.title}\n${obs.content.slice(0, 500)}`
  ).join('\n\n---\n\n');

  const response = await llm.generate({
    model: 'claude-3-5-sonnet-20241022',
    messages: [{
      role: 'user',
      content: `Summarize these related observations in 2-3 sentences:\n\n${observationTexts}`
    }],
    maxTokens: 200
  });

  return response.content;
}

async function synthesizeMasterSummary(data: {
  clusterSummaries: string[];
  totalObservations: number;
  period: { start: Date; end: Date };
}): Promise<{
  title: string;
  summary: string;
  keyPoints: string[];
  topics: string[];
  confidence: number;
}> {
  const clusterText = data.clusterSummaries.join('\n\n');

  const response = await llm.generate({
    model: 'claude-3-5-sonnet-20241022',
    messages: [{
      role: 'user',
      content: `Generate a summary report for ${data.totalObservations} observations from ${data.period.start.toISOString()} to ${data.period.end.toISOString()}.

Cluster summaries:
${clusterText}

Provide:
1. A concise title (max 100 chars)
2. An overall summary (2-4 sentences)
3. 3-5 key points (bullet points)
4. 3-5 main topics/themes

Format as JSON:
{
  "title": "...",
  "summary": "...",
  "keyPoints": ["...", "..."],
  "topics": ["...", "..."]
}`
    }],
    maxTokens: 500
  });

  const result = JSON.parse(response.content);

  return {
    ...result,
    confidence: calculateSummaryConfidence(data.totalObservations)
  };
}

function calculateSummaryConfidence(observationCount: number): number {
  // More observations → higher confidence
  if (observationCount >= 20) return 0.95;
  if (observationCount >= 10) return 0.85;
  if (observationCount >= 5) return 0.75;
  return 0.60;
}
```

## Actor Profiles

### Profile Update

Triggered whenever an observation is created for an actor.

```typescript
export const profileUpdate = inngest.createFunction(
  {
    id: "neural.profile.update",
    concurrency: { limit: 10, key: "event.data.actorId" }
  },
  { event: "neural/profile.update" },
  async ({ event, step }) => {
    const { workspaceId, actorId, observationId } = event.data;

    // Step 1: Load existing profile
    const existing = await step.run("load-profile", async () => {
      return await db.select()
        .from(workspaceActorProfiles)
        .where(
          and(
            eq(workspaceActorProfiles.workspaceId, workspaceId),
            eq(workspaceActorProfiles.actorId, actorId)
          )
        )
        .limit(1);
    });

    // Step 2: Gather recent observations (last 90 days)
    const observations = await step.run("gather-observations", async () => {
      return await db.select()
        .from(workspaceNeuralObservations)
        .where(
          and(
            eq(workspaceNeuralObservations.workspaceId, workspaceId),
            eq(workspaceNeuralObservations.actorId, actorId),
            gte(workspaceNeuralObservations.occurredAt, subDays(new Date(), 90))
          )
        )
        .orderBy(desc(workspaceNeuralObservations.occurredAt));
    });

    // Step 3: Extract features
    const features = await step.run("extract-features", async () => {
      return {
        expertiseDomains: extractExpertiseDomains(observations),
        contributionTypes: extractContributionTypes(observations),
        activeHours: extractActiveHours(observations),
        frequentCollaborators: extractCollaborators(observations),
      };
    });

    // Step 4: Generate profile embedding (centroid)
    const profileEmbedding = await step.run("generate-embedding", async () => {
      const embeddings = await Promise.all(
        observations
          .slice(0, 50)  // Use last 50 observations
          .map(obs => getEmbeddingVector(obs.embeddingContentId))
      );

      const centroid = calculateCentroid(embeddings);

      return await storeEmbedding(centroid, {
        model: 'computed_centroid',
        dimensions: 1536
      });
    });

    // Step 5: Upsert profile
    const profile = await step.run("upsert-profile", async () => {
      const profileData = {
        workspaceId,
        profileType: 'user',
        actorId,
        actorName: observations[0]?.actorName ?? actorId,

        expertiseDomains: features.expertiseDomains,
        contributionTypes: features.contributionTypes,
        activeHours: features.activeHours,
        frequentCollaborators: features.frequentCollaborators,

        profileEmbeddingId: profileEmbedding.id,

        observationCount: observations.length,
        lastActiveAt: observations[0]?.occurredAt,
        profileConfidence: calculateProfileConfidence(observations.length),

        updatedAt: new Date(),
      };

      if (existing[0]) {
        return await db.update(workspaceActorProfiles)
          .set(profileData)
          .where(eq(workspaceActorProfiles.id, existing[0].id))
          .returning();
      } else {
        return await db.insert(workspaceActorProfiles)
          .values({
            id: generateProfileId(),
            ...profileData,
            createdAt: new Date(),
          })
          .returning();
      }
    });

    return {
      success: true,
      profileId: profile[0].id,
      observationCount: observations.length
    };
  }
);
```

### Feature Extraction

```typescript
function extractExpertiseDomains(
  observations: Observation[]
): Record<string, number> {
  const domainCounts: Record<string, number> = {};

  observations.forEach(obs => {
    // Extract domains from content (simplified)
    const domains = extractDomainsFromText(obs.content);

    domains.forEach(domain => {
      domainCounts[domain] = (domainCounts[domain] || 0) + 1;
    });
  });

  // Normalize to 0-1 scale
  const maxCount = Math.max(...Object.values(domainCounts));
  const normalized: Record<string, number> = {};

  Object.entries(domainCounts).forEach(([domain, count]) => {
    normalized[domain] = count / maxCount;
  });

  return normalized;
}

function extractDomainsFromText(text: string): string[] {
  const domains: string[] = [];

  // Simple keyword matching (could use NER or topic modeling)
  const keywords = {
    'authentication': ['auth', 'oauth', 'login', 'session'],
    'database': ['sql', 'query', 'migration', 'schema'],
    'frontend': ['react', 'component', 'ui', 'tailwind'],
    'backend': ['api', 'endpoint', 'server', 'route'],
    'devops': ['deploy', 'docker', 'ci/cd', 'kubernetes'],
  };

  const lowerText = text.toLowerCase();

  Object.entries(keywords).forEach(([domain, words]) => {
    if (words.some(word => lowerText.includes(word))) {
      domains.push(domain);
    }
  });

  return domains;
}

function extractContributionTypes(
  observations: Observation[]
): Record<string, number> {
  const typeCounts: Record<string, number> = {};

  observations.forEach(obs => {
    typeCounts[obs.type] = (typeCounts[obs.type] || 0) + 1;
  });

  // Normalize
  const total = observations.length;
  const normalized: Record<string, number> = {};

  Object.entries(typeCounts).forEach(([type, count]) => {
    normalized[type] = count / total;
  });

  return normalized;
}

function extractActiveHours(observations: Observation[]): number[] {
  const hourCounts = new Array(24).fill(0);

  observations.forEach(obs => {
    const hour = obs.occurredAt.getUTCHours();
    hourCounts[hour]++;
  });

  // Return hours where activity is above average
  const avgCount = hourCounts.reduce((a, b) => a + b, 0) / 24;

  return hourCounts
    .map((count, hour) => ({ hour, count }))
    .filter(({ count }) => count > avgCount)
    .map(({ hour }) => hour);
}

function extractCollaborators(observations: Observation[]): string[] {
  // Extract mentioned actors from observation content
  const mentions = new Map<string, number>();

  observations.forEach(obs => {
    const mentionedActors = extractMentions(obs.content);

    mentionedActors.forEach(actorId => {
      mentions.set(actorId, (mentions.get(actorId) || 0) + 1);
    });
  });

  // Return top 5 most frequent collaborators
  return Array.from(mentions.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([actorId]) => actorId);
}

function extractMentions(text: string): string[] {
  const mentions = text.match(/@(\w+)/g) || [];
  return mentions.map(m => m.slice(1));
}

function calculateProfileConfidence(observationCount: number): number {
  // More observations → higher confidence
  if (observationCount >= 50) return 0.95;
  if (observationCount >= 20) return 0.85;
  if (observationCount >= 10) return 0.70;
  return 0.50;
}
```

---

_Last updated: 2025-11-27_
