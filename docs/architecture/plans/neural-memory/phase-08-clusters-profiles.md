---
title: "Phase 8: Clusters & Profiles"
description: Observation clusters with affinity scoring, actor profiles, cluster summaries
status: not_started
phase: 8
parent: "./README.md"
depends_on: ["./phase-06-embedding-storage.md"]
blocks: ["./phase-09-retrieval-governor.md"]
---

# Phase 8: Clusters & Profiles

**Status**: Not Started
**Parent Plan**: [Implementation Plan](./README.md)

## Overview

Implement observation clusters (topic-grouped events) and actor profiles (expertise tracking). Clusters enable contextual retrieval ("what's happening with authentication?") while profiles enable actor-aware queries ("who worked on X?").

## Prerequisites

- [ ] Phase 6 completed and verified
- [ ] Observations with embeddings stored
- [ ] Profile update stub workflow exists (from Phase 2)

## Changes Required

### 1. Implement Cluster Assignment in Observation Capture

**File**: `api/console/src/inngest/workflow/neural/capture-observation.ts`
**Action**: Modify

Add cluster assignment after embedding generation (insert before entity extraction):

```typescript
// Step: Assign to Cluster
const clusterAssignment = await step.run("assign-cluster", async () => {
  return await assignToCluster(
    workspaceId,
    stored.id,
    observation,
    classification,
    embeddings.contentEmbedding!
  );
});

// Update observation with cluster ID
if (clusterAssignment.clusterId) {
  await step.run("update-cluster-id", async () => {
    await db
      .update(workspaceNeuralObservations)
      .set({ clusterId: clusterAssignment.clusterId })
      .where(eq(workspaceNeuralObservations.id, stored.id));
  });

  // Trigger cluster summary check (fire-and-forget)
  await step.sendEvent("cluster-summary-check", {
    name: "apps-console/neural/cluster.check-summary",
    data: {
      workspaceId,
      clusterId: clusterAssignment.clusterId,
    },
  });
}
```

Add the cluster assignment function:

```typescript
const CLUSTER_AFFINITY_THRESHOLD = 60; // 0-100 scale

interface ClusterAssignmentResult {
  clusterId: string | null;
  isNew: boolean;
  affinity: number;
}

/**
 * Assign observation to an existing or new cluster
 */
async function assignToCluster(
  workspaceId: string,
  observationId: string,
  observation: {
    title: string;
    content: string;
    actorId?: string;
    relatedEntityIds?: string[];
  },
  classification: { type: string; topics: string[] },
  contentEmbedding: number[]
): Promise<ClusterAssignmentResult> {
  // Get recent open clusters
  const recentClusters = await db
    .select()
    .from(workspaceObservationClusters)
    .where(
      and(
        eq(workspaceObservationClusters.workspaceId, workspaceId),
        eq(workspaceObservationClusters.status, "open"),
        gte(
          workspaceObservationClusters.lastObservationAt,
          subDays(new Date(), 7)
        )
      )
    )
    .orderBy(desc(workspaceObservationClusters.lastObservationAt))
    .limit(10);

  if (recentClusters.length === 0) {
    // Create new cluster
    return await createNewCluster(
      workspaceId,
      observationId,
      observation,
      classification,
      contentEmbedding
    );
  }

  // Calculate affinity scores for each cluster
  const affinities = await Promise.all(
    recentClusters.map(async (cluster) => {
      const score = await calculateClusterAffinity(
        cluster,
        observation,
        classification,
        contentEmbedding
      );
      return { cluster, score };
    })
  );

  // Find best match above threshold
  const bestMatch = affinities
    .filter((a) => a.score >= CLUSTER_AFFINITY_THRESHOLD)
    .sort((a, b) => b.score - a.score)[0];

  if (bestMatch) {
    // Add to existing cluster
    await updateClusterMetrics(bestMatch.cluster.id, observationId);
    return {
      clusterId: bestMatch.cluster.id,
      isNew: false,
      affinity: bestMatch.score,
    };
  }

  // Create new cluster
  return await createNewCluster(
    workspaceId,
    observationId,
    observation,
    classification,
    contentEmbedding
  );
}

/**
 * Calculate affinity score between observation and cluster
 */
async function calculateClusterAffinity(
  cluster: typeof workspaceObservationClusters.$inferSelect,
  observation: {
    actorId?: string;
    relatedEntityIds?: string[];
  },
  classification: { topics: string[] },
  contentEmbedding: number[]
): Promise<number> {
  let score = 0;

  // Factor 1: Topic overlap (0-40 points)
  const clusterKeywords = (cluster.keywords as string[]) ?? [];
  const topicOverlap = classification.topics.filter((t) =>
    clusterKeywords.some((k) => k.toLowerCase().includes(t.toLowerCase()))
  ).length;
  score += Math.min(40, topicOverlap * 15);

  // Factor 2: Entity overlap (0-30 points)
  const clusterEntities = (cluster.primaryEntities as string[]) ?? [];
  const entityOverlap = (observation.relatedEntityIds ?? []).filter((e) =>
    clusterEntities.includes(e)
  ).length;
  score += Math.min(30, entityOverlap * 10);

  // Factor 3: Actor overlap (0-20 points)
  const clusterActors = (cluster.primaryActors as string[]) ?? [];
  if (observation.actorId && clusterActors.includes(observation.actorId)) {
    score += 20;
  }

  // Factor 4: Temporal proximity (0-10 points)
  if (cluster.lastObservationAt) {
    const hoursSince = differenceInHours(new Date(), cluster.lastObservationAt);
    score += Math.max(0, 10 - Math.floor(hoursSince / 6)); // Decay over 60 hours
  }

  return score;
}

/**
 * Create a new cluster for this observation
 */
async function createNewCluster(
  workspaceId: string,
  observationId: string,
  observation: { title: string; actorId?: string },
  classification: { type: string; topics: string[] },
  contentEmbedding: number[]
): Promise<ClusterAssignmentResult> {
  const clusterId = nanoid();

  // Generate topic label from observation
  const topicLabel =
    classification.topics.length > 0
      ? classification.topics.slice(0, 2).join(" & ")
      : classification.type;

  // Store cluster embedding in Pinecone
  const namespace = `${workspaceId}/neural/clusters`;
  await pineconeClient.upsertVectors(
    "default",
    {
      ids: [`cluster:${clusterId}`],
      vectors: [contentEmbedding],
      metadata: [
        {
          clusterId,
          workspaceId,
          topicLabel,
        },
      ],
    },
    100,
    namespace
  );

  // Create cluster record
  await db.insert(workspaceObservationClusters).values({
    id: clusterId,
    workspaceId,
    topicLabel: topicLabel.charAt(0).toUpperCase() + topicLabel.slice(1),
    topicEmbeddingId: `cluster:${clusterId}`,
    keywords: classification.topics,
    primaryEntities: [],
    primaryActors: observation.actorId ? [observation.actorId] : [],
    status: "open",
    observationCount: "1",
    firstObservationAt: new Date(),
    lastObservationAt: new Date(),
  });

  log.info("Created new observation cluster", {
    clusterId,
    workspaceId,
    topicLabel,
  });

  return {
    clusterId,
    isNew: true,
    affinity: 100,
  };
}

/**
 * Update cluster metrics when adding observation
 */
async function updateClusterMetrics(
  clusterId: string,
  observationId: string
): Promise<void> {
  await db
    .update(workspaceObservationClusters)
    .set({
      observationCount: sql`${workspaceObservationClusters.observationCount}::integer + 1`,
      lastObservationAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(workspaceObservationClusters.id, clusterId));
}
```

**Why**: Group related observations for contextual retrieval.

### 2. Implement Full Profile Update Workflow

**File**: `api/console/src/inngest/workflow/neural/update-profile.ts`
**Action**: Replace stub with full implementation

```typescript
import { eq, and, gte, desc, sql } from "drizzle-orm";
import { subDays, subMinutes } from "date-fns";
import { db } from "@db/console";
import {
  workspaceNeuralObservations,
  workspaceActorProfiles,
} from "@db/console/schema";
import { createEmbeddingProviderForStore } from "@repo/console-embed";
import { pineconeClient } from "@repo/console-pinecone";
import { inngest } from "../../client/client";
import { log } from "@repo/logger";

/**
 * Profile update workflow
 * Computes expertise domains, contribution types, and profile embedding
 */
export const updateProfile = inngest.createFunction(
  {
    id: "apps-console/neural-update-profile",
    name: "Neural Profile Update",
    description: "Update actor profiles based on observations",
    retries: 3,
    concurrency: {
      limit: 10,
      key: "event.data.actorId",
    },
    timeouts: {
      start: "30s",
      finish: "2m",
    },
  },
  { event: "apps-console/neural/profile.update" },
  async ({ event, step }) => {
    const { workspaceId, actorId, observationId } = event.data;

    // Step 1: Debounce check
    const shouldProcess = await step.run("debounce-check", async () => {
      const recentUpdate = await db
        .select({ id: workspaceActorProfiles.id })
        .from(workspaceActorProfiles)
        .where(
          and(
            eq(workspaceActorProfiles.workspaceId, workspaceId),
            eq(workspaceActorProfiles.actorId, actorId),
            gte(workspaceActorProfiles.updatedAt, subMinutes(new Date(), 5))
          )
        )
        .limit(1);

      return recentUpdate.length === 0;
    });

    if (!shouldProcess) {
      return { skipped: true, reason: "debounced" };
    }

    // Step 2: Gather recent observations
    const observations = await step.run("gather-observations", async () => {
      return await db
        .select()
        .from(workspaceNeuralObservations)
        .where(
          and(
            eq(workspaceNeuralObservations.workspaceId, workspaceId),
            eq(workspaceNeuralObservations.actorId, actorId),
            gte(workspaceNeuralObservations.occurredAt, subDays(new Date(), 90))
          )
        )
        .orderBy(desc(workspaceNeuralObservations.occurredAt))
        .limit(100);
    });

    if (observations.length === 0) {
      return { skipped: true, reason: "no_observations" };
    }

    // Step 3: Extract profile features
    const features = await step.run("extract-features", async () => {
      // Expertise domains from topics
      const topicCounts: Record<string, number> = {};
      for (const obs of observations) {
        const topics = (obs.topics as string[]) ?? [];
        for (const topic of topics) {
          topicCounts[topic] = (topicCounts[topic] ?? 0) + 1;
        }
      }

      // Normalize to 0-1 scores
      const maxCount = Math.max(...Object.values(topicCounts), 1);
      const expertiseDomains: Record<string, number> = {};
      for (const [topic, count] of Object.entries(topicCounts)) {
        expertiseDomains[topic] = Math.round((count / maxCount) * 100) / 100;
      }

      // Contribution types from observation types
      const typeCounts: Record<string, number> = {};
      for (const obs of observations) {
        typeCounts[obs.observationType] =
          (typeCounts[obs.observationType] ?? 0) + 1;
      }

      const total = observations.length;
      const contributionTypes: Record<string, number> = {};
      for (const [type, count] of Object.entries(typeCounts)) {
        contributionTypes[type] = Math.round((count / total) * 100) / 100;
      }

      // Active hours (UTC)
      const hourCounts: Record<number, number> = {};
      for (const obs of observations) {
        const hour = obs.occurredAt.getUTCHours();
        hourCounts[hour] = (hourCounts[hour] ?? 0) + 1;
      }

      // Top 6 most active hours
      const activeHours = Object.entries(hourCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([hour]) => parseInt(hour, 10))
        .sort((a, b) => a - b);

      // Frequent collaborators (actors mentioned or involved)
      const collaboratorCounts: Record<string, number> = {};
      for (const obs of observations) {
        const content = obs.content;
        const mentions = content.match(/@([a-zA-Z0-9_-]+)/g) ?? [];
        for (const mention of mentions) {
          const username = mention.slice(1);
          if (username !== actorId) {
            collaboratorCounts[username] =
              (collaboratorCounts[username] ?? 0) + 1;
          }
        }
      }

      const frequentCollaborators = Object.entries(collaboratorCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([username]) => username);

      return {
        expertiseDomains,
        contributionTypes,
        activeHours,
        frequentCollaborators,
      };
    });

    // Step 4: Compute profile embedding (centroid of recent observations)
    const profileEmbedding = await step.run("compute-embedding", async () => {
      // Get embeddings for recent observations
      const namespace = `${workspaceId}/neural/observations`;
      const embeddingIds = observations
        .slice(0, 50)
        .filter((obs) => obs.embeddingContentId)
        .map((obs) => `obs:${obs.id}:content`);

      if (embeddingIds.length === 0) {
        return null;
      }

      // Fetch vectors from Pinecone
      const vectors = await pineconeClient.fetchVectors(
        "default",
        embeddingIds,
        namespace
      );

      if (!vectors.vectors || Object.keys(vectors.vectors).length === 0) {
        return null;
      }

      // Calculate centroid
      const vectorValues = Object.values(vectors.vectors)
        .filter((v) => v.values)
        .map((v) => v.values!);

      if (vectorValues.length === 0) {
        return null;
      }

      const dims = vectorValues[0]!.length;
      const centroid = new Array(dims).fill(0);

      for (const vec of vectorValues) {
        for (let i = 0; i < dims; i++) {
          centroid[i] += vec[i]! / vectorValues.length;
        }
      }

      return centroid;
    });

    // Step 5: Store profile embedding in Pinecone
    let profileEmbeddingId: string | null = null;

    if (profileEmbedding) {
      profileEmbeddingId = await step.run("store-profile-embedding", async () => {
        const embeddingId = `profile:${actorId}`;
        const namespace = `${workspaceId}/neural/profiles`;

        await pineconeClient.upsertVectors(
          "default",
          {
            ids: [embeddingId],
            vectors: [profileEmbedding],
            metadata: [
              {
                actorId,
                workspaceId,
                observationCount: observations.length,
              },
            ],
          },
          100,
          namespace
        );

        return embeddingId;
      });
    }

    // Step 6: Upsert profile
    const profile = await step.run("upsert-profile", async () => {
      const actorName =
        observations[0]?.actorName ?? actorId;

      const profileData = {
        workspaceId,
        actorId,
        displayName: actorName,
        expertiseDomains: features.expertiseDomains,
        contributionTypes: features.contributionTypes,
        activeHours: features.activeHours,
        frequentCollaborators: features.frequentCollaborators,
        profileEmbeddingId,
        observationCount: observations.length.toString(),
        lastActiveAt: observations[0]?.occurredAt,
        profileConfidence: Math.min(
          0.95,
          0.5 + observations.length * 0.01
        ).toString(),
        updatedAt: new Date(),
      };

      await db
        .insert(workspaceActorProfiles)
        .values({
          id: nanoid(),
          ...profileData,
        })
        .onConflictDoUpdate({
          target: [
            workspaceActorProfiles.workspaceId,
            workspaceActorProfiles.actorId,
          ],
          set: profileData,
        });

      return profileData;
    });

    log.info("Profile updated", {
      workspaceId,
      actorId,
      observationCount: observations.length,
      expertiseDomains: Object.keys(features.expertiseDomains).length,
    });

    return {
      success: true,
      actorId,
      observationCount: observations.length,
      expertiseDomains: features.expertiseDomains,
    };
  }
);
```

**Why**: Compute actor expertise and patterns for actor-aware retrieval.

### 3. Implement Cluster Summary Workflow

**File**: `api/console/src/inngest/workflow/neural/check-cluster-summary.ts`
**Action**: Replace stub with full implementation

```typescript
import { eq, desc } from "drizzle-orm";
import { differenceInHours } from "date-fns";
import { db } from "@db/console";
import {
  workspaceNeuralObservations,
  workspaceObservationClusters,
} from "@db/console/schema";
import { inngest } from "../../client/client";
import { log } from "@repo/logger";
import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";

const SUMMARY_THRESHOLD = 5; // Minimum observations before generating summary

/**
 * Cluster summary check and generation workflow
 */
export const checkClusterSummary = inngest.createFunction(
  {
    id: "apps-console/neural-check-cluster-summary",
    name: "Neural Cluster Summary Check",
    description: "Check observation clusters for summary generation",
    retries: 3,
    concurrency: {
      limit: 5,
      key: "event.data.workspaceId",
    },
    timeouts: {
      start: "30s",
      finish: "5m",
    },
  },
  { event: "apps-console/neural/cluster.check-summary" },
  async ({ event, step }) => {
    const { workspaceId, clusterId } = event.data;

    // Step 1: Load cluster
    const cluster = await step.run("load-cluster", async () => {
      return await db.query.workspaceObservationClusters.findFirst({
        where: eq(workspaceObservationClusters.id, clusterId),
      });
    });

    if (!cluster) {
      return { skipped: true, reason: "cluster_not_found" };
    }

    // Step 2: Check if summary needed
    const needsSummary = await step.run("check-needs-summary", async () => {
      const obsCount = parseInt(cluster.observationCount ?? "0", 10);

      // Need minimum observations
      if (obsCount < SUMMARY_THRESHOLD) {
        return false;
      }

      // Check if summary is stale (>24 hours old)
      if (cluster.summaryGeneratedAt) {
        const hoursSinceSummary = differenceInHours(
          new Date(),
          cluster.summaryGeneratedAt
        );
        if (hoursSinceSummary < 24) {
          return false;
        }
      }

      return true;
    });

    if (!needsSummary) {
      return { skipped: true, reason: "summary_not_needed" };
    }

    // Step 3: Gather cluster observations
    const observations = await step.run("gather-observations", async () => {
      return await db
        .select({
          id: workspaceNeuralObservations.id,
          title: workspaceNeuralObservations.title,
          content: workspaceNeuralObservations.content,
          type: workspaceNeuralObservations.observationType,
          sourceType: workspaceNeuralObservations.sourceType,
          actorName: workspaceNeuralObservations.actorName,
          occurredAt: workspaceNeuralObservations.occurredAt,
        })
        .from(workspaceNeuralObservations)
        .where(eq(workspaceNeuralObservations.clusterId, clusterId))
        .orderBy(desc(workspaceNeuralObservations.occurredAt))
        .limit(50);
    });

    if (observations.length < SUMMARY_THRESHOLD) {
      return { skipped: true, reason: "insufficient_observations" };
    }

    // Step 4: Generate summary with LLM
    const summary = await step.run("generate-summary", async () => {
      const observationTexts = observations
        .map(
          (obs) =>
            `[${obs.type}/${obs.sourceType}] ${obs.title}\n${obs.content.slice(0, 300)}`
        )
        .join("\n\n---\n\n");

      const { text } = await generateText({
        model: anthropic("claude-3-5-haiku-20241022"),
        system: `You are summarizing engineering activity for a team memory system.
Given a cluster of related engineering observations (PRs, issues, deployments, errors), create a concise summary.

Include:
1. Main topic/theme (1 line)
2. Key technical decisions or changes made (bullet points)
3. Key contributors involved
4. Current status/outcome

Keep it under 250 words. Be factual and specific.`,
        prompt: `Summarize these ${observations.length} related engineering observations:\n\n${observationTexts}`,
        maxTokens: 500,
      });

      return text;
    });

    // Step 5: Update cluster with summary
    await step.run("update-cluster", async () => {
      await db
        .update(workspaceObservationClusters)
        .set({
          summary,
          summaryGeneratedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(workspaceObservationClusters.id, clusterId));
    });

    log.info("Cluster summary generated", {
      clusterId,
      workspaceId,
      observationCount: observations.length,
      summaryLength: summary.length,
    });

    return {
      success: true,
      clusterId,
      observationCount: observations.length,
      summaryPreview: summary.slice(0, 100),
    };
  }
);
```

**Why**: Auto-generate summaries for clusters to provide quick topic context.

### 4. Add Required Imports

**File**: `api/console/src/inngest/workflow/neural/capture-observation.ts`
**Action**: Add imports

```typescript
import { differenceInHours, subDays } from "date-fns";
import { workspaceObservationClusters } from "@db/console/schema";
```

**Why**: Dependencies for cluster assignment.

## Database Changes

No new migrations - uses tables from Phase 1.

## Success Criteria

### Automated Verification:
- [ ] Type checking passes: `pnpm typecheck`
- [ ] Linting passes: `pnpm lint`
- [ ] Build succeeds: `pnpm build:console`

### Manual Verification:
- [ ] Create multiple related observations (e.g., multiple PRs on same topic)
- [ ] Verify observations assigned to same cluster
- [ ] Verify new cluster created for unrelated observation
- [ ] Verify profile update triggered and computed
- [ ] Check profile in database has expertise domains populated
- [ ] Verify cluster summary generated after threshold reached (5+ observations)
- [ ] Query Pinecone for profile embeddings in `{workspaceId}/neural/profiles` namespace

## Rollback Plan

1. Remove cluster assignment code from capture-observation.ts
2. Revert profile and cluster workflows to stubs
3. Existing observations remain but won't be clustered

---

**CHECKPOINT**: After completing this phase, observations are clustered and actor profiles are computed.

---

**Previous Phase**: [Phase 6: Embedding & Storage](./phase-06-embedding-storage.md)
**Next Phase**: [Phase 9: Retrieval Governor](./phase-09-retrieval-governor.md)
