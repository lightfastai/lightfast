/**
 * Cluster Summary Workflow
 *
 * Async workflow triggered after observation is added to cluster.
 * Generates LLM summary when cluster reaches threshold.
 */

import { inngest } from "../../client/client";
import { db } from "@db/console/client";
import {
  workspaceObservationClusters,
  workspaceNeuralObservations,
  orgWorkspaces,
} from "@db/console/schema";
import { eq, and, desc } from "drizzle-orm";
import { log } from "@vendor/observability/log";
import { generateObject } from "ai";
import { gateway } from "@ai-sdk/gateway";
import { z } from "zod";
import { recordJobMetric } from "../../../lib/jobs";

const SUMMARY_THRESHOLD = 5; // Generate summary after 5 observations
const SUMMARY_AGE_HOURS = 24; // Regenerate if summary > 24 hours old

const clusterSummarySchema = z.object({
  summary: z.string().max(500).describe("Concise summary of cluster activity"),
  keyTopics: z
    .array(z.string())
    .max(5)
    .describe("Top 5 topics or themes in this cluster"),
  keyContributors: z
    .array(z.string())
    .max(5)
    .describe("Top contributors to this cluster"),
  status: z
    .enum(["active", "completed", "stalled"])
    .describe("Cluster activity status"),
});

export const clusterSummaryCheck = inngest.createFunction(
  {
    id: "apps-console/neural.cluster.check-summary",
    name: "Neural Cluster Summary Check",
    description: "Generates cluster summary when threshold met",
    retries: 2,

    // Debounce: only process latest event per cluster (10 min window)
    debounce: {
      key: "event.data.clusterId",
      period: "10m",
    },

    // Limit concurrent summary generations per workspace
    concurrency: {
      limit: 3,
      key: "event.data.workspaceId",
    },

    timeouts: {
      start: "30s",
      finish: "3m",
    },
  },
  { event: "apps-console/neural/cluster.check-summary" },
  async ({ event, step }) => {
    const { workspaceId, clusterId, observationCount } = event.data;

    // Step 1: Check if summary needed and get cluster
    const cluster = await step.run("check-threshold", async () => {
      // Below threshold
      if (observationCount < SUMMARY_THRESHOLD) {
        log.debug("Cluster summary not needed", {
          clusterId,
          reason: "below_threshold",
        });
        return null;
      }

      // Check existing summary age
      const existingCluster =
        await db.query.workspaceObservationClusters.findFirst({
          where: eq(workspaceObservationClusters.id, Number(clusterId)),
        });

      if (!existingCluster) {
        log.debug("Cluster summary not needed", {
          clusterId,
          reason: "cluster_not_found",
        });
        return null;
      }

      if (existingCluster.summaryGeneratedAt) {
        const hoursSinceSummary =
          (Date.now() -
            new Date(existingCluster.summaryGeneratedAt).getTime()) /
          (1000 * 60 * 60);

        if (hoursSinceSummary < SUMMARY_AGE_HOURS) {
          log.debug("Cluster summary not needed", {
            clusterId,
            reason: "summary_recent",
          });
          return null;
        }
      }

      return existingCluster;
    });

    if (!cluster) {
      return { status: "skipped", reason: "threshold_not_met_or_cluster_not_found" };
    }

    // Step 2: Gather cluster observations
    // TODO: Phase 5 will enable this when clusters are migrated to BIGINT
    // Currently, observations.clusterId is BIGINT but we receive varchar clusterId from events
    // Since all observations have clusterId = null until Phase 5, this query returns nothing
    const clusterIdNum = parseInt(clusterId, 10);
    const observations = await step.run("gather-observations", async () => {
      // Skip if clusterId is not a valid number (varchar cluster IDs from Phase 3)
      if (isNaN(clusterIdNum)) {
        return [];
      }
      return db.query.workspaceNeuralObservations.findMany({
        where: and(
          eq(workspaceNeuralObservations.workspaceId, workspaceId),
          eq(workspaceNeuralObservations.clusterId, clusterIdNum),
        ),
        orderBy: desc(workspaceNeuralObservations.occurredAt),
        limit: 20, // Limit context size
      });
    });

    if (observations.length === 0) {
      return { status: "skipped", reason: "no_observations" };
    }

    // Step 3: Generate summary with LLM
    const summary = await step.run("generate-summary", async () => {
      const observationSummaries = observations.map((obs) => ({
        type: obs.observationType,
        title: obs.title,
        actor: (obs.actor as { name?: string } | null)?.name ?? "unknown",
        date: obs.occurredAt,
        snippet: obs.content?.slice(0, 200) ?? "",
      }));

      const { object } = await generateObject({
        model: gateway("openai/gpt-4.1-mini"),
        schema: clusterSummarySchema,
        prompt: `Summarize this cluster of engineering activity observations.

Cluster topic: ${cluster.topicLabel}
Observation count: ${observationCount}

Recent observations:
${JSON.stringify(observationSummaries, null, 2)}

Generate a concise summary, key topics, key contributors, and activity status.`,
        temperature: 0.3,
      });

      return object;
    });

    // Step 4: Update cluster with summary
    await step.run("update-cluster", async () => {
      await db
        .update(workspaceObservationClusters)
        .set({
          summary: summary.summary,
          summaryGeneratedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(workspaceObservationClusters.id, Number(clusterId)));

      log.info("Generated cluster summary", {
        clusterId,
        status: summary.status,
        keyTopics: summary.keyTopics,
      });
    });

    // Record cluster_summary_generated metric
    // Need to get clerkOrgId from workspace
    const workspace = await db.query.orgWorkspaces.findFirst({
      where: eq(orgWorkspaces.id, workspaceId),
      columns: { clerkOrgId: true },
    });

    if (workspace) {
      void recordJobMetric({
        clerkOrgId: workspace.clerkOrgId,
        workspaceId,
        type: "cluster_summary_generated",
        value: 1,
        unit: "count",
        tags: {
          clusterId,
          observationCount: observations.length,
        },
      });
    }

    return {
      status: "generated",
      summary: summary.summary,
      keyTopics: summary.keyTopics,
    };
  },
);
