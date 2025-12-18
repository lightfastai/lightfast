/**
 * Cluster Summary Workflow
 *
 * Async workflow triggered after observation is added to cluster.
 * Generates LLM summary when cluster reaches threshold.
 */

import { inngest, type Events } from "../../client/client";
import { db } from "@db/console/client";
import {
  workspaceObservationClusters,
  workspaceNeuralObservations,
  orgWorkspaces,
} from "@db/console/schema";
import { eq, and, desc } from "drizzle-orm";
import { log } from "@vendor/observability/log";
import { z } from "zod";
import { createJob, updateJobStatus, completeJob, recordJobMetric, getJobByInngestRunId } from "../../../lib/jobs";
import {
  createTracedModel,
  generateObject,
  buildNeuralTelemetry,
} from "./ai-helpers";
import type {
  NeuralClusterSummaryInput,
  NeuralClusterSummaryOutputSuccess,
  NeuralClusterSummaryOutputSkipped,
  NeuralClusterSummaryOutputFailure,
} from "@repo/console-validation";

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

type ClusterSummary = z.infer<typeof clusterSummarySchema>;

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

    // Handle failures gracefully - complete job as failed
    onFailure: async ({ event, error }) => {
      const originalEvent = event.data.event as Events["apps-console/neural/cluster.check-summary"];
      const { workspaceId, clusterId } = originalEvent.data;
      const eventId = originalEvent.id;

      log.error("Neural cluster summary failed", {
        workspaceId,
        clusterId,
        error: error.message,
      });

      if (eventId) {
        const job = await getJobByInngestRunId(eventId);
        if (job) {
          await completeJob({
            jobId: job.id,
            status: "failed",
            output: {
              inngestFunctionId: "neural.cluster.summary",
              status: "failure",
              clusterId,
              error: error.message,
            } satisfies NeuralClusterSummaryOutputFailure,
          });
        }
      }
    },
  },
  { event: "apps-console/neural/cluster.check-summary" },
  async ({ event, step }) => {
    const { workspaceId, clerkOrgId: eventClerkOrgId, clusterId, observationCount } = event.data;

    // Resolve clerkOrgId (prefer event, fallback to DB)
    // New events receive clerkOrgId from parent workflow (observation-capture)
    const clerkOrgId = eventClerkOrgId ?? await (async () => {
      // Track fallback usage to monitor migration progress
      log.warn("clerkOrgId fallback to DB lookup", { workspaceId, reason: "event_missing_clerkOrgId" });
      const workspace = await db.query.orgWorkspaces.findFirst({
        where: eq(orgWorkspaces.id, workspaceId),
        columns: { clerkOrgId: true },
      });
      return workspace?.clerkOrgId ?? "";
    })();

    // Create job record for tracking
    const inngestRunId = event.id ?? `neural-cluster-${clusterId}-${Date.now()}`;
    const jobId = await step.run("create-job", async () => {
      return createJob({
        clerkOrgId,
        workspaceId,
        inngestRunId,
        inngestFunctionId: "neural.cluster.summary",
        name: `Cluster summary: ${clusterId}`,
        trigger: "webhook",
        input: {
          inngestFunctionId: "neural.cluster.summary",
          clusterId,
          observationCount,
        } satisfies NeuralClusterSummaryInput,
      });
    });

    // Update job status to running
    await step.run("update-job-running", async () => {
      await updateJobStatus(jobId, "running");
    });

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
      // Complete job as skipped
      await step.run("complete-job-skipped", async () => {
        await completeJob({
          jobId,
          status: "completed",
          output: {
            inngestFunctionId: "neural.cluster.summary",
            status: "skipped",
            clusterId,
            reason: observationCount < SUMMARY_THRESHOLD ? "below_threshold" : "cluster_not_found",
          } satisfies NeuralClusterSummaryOutputSkipped,
        });
      });

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

    // Step 3: Generate summary with LLM using step.ai.wrap()
    const observationSummaries = observations.map((obs) => ({
      type: obs.observationType,
      title: obs.title,
      actor: (obs.actor as { name?: string } | null)?.name ?? "unknown",
      date: obs.occurredAt,
      snippet: obs.content.slice(0, 200),
    }));

    const summaryResult = (await step.ai.wrap(
      "generate-summary",
      generateObject,
      {
        model: createTracedModel("openai/gpt-4.1-mini"),
        schema: clusterSummarySchema,
        prompt: `Summarize this cluster of engineering activity observations.

Cluster topic: ${cluster.topicLabel}
Observation count: ${observationCount}

Recent observations:
${JSON.stringify(observationSummaries, null, 2)}

Generate a concise summary, key topics, key contributors, and activity status.`,
        temperature: 0.3,
        experimental_telemetry: buildNeuralTelemetry("neural-cluster-summary", {
          clusterId,
          workspaceId,
          observationCount: observations.length,
        }),
      } as Parameters<typeof generateObject>[0]
    )) as { object: ClusterSummary };

    const summary = summaryResult.object;

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

    // Complete job with success output
    await step.run("complete-job-success", async () => {
      await completeJob({
        jobId,
        status: "completed",
        output: {
          inngestFunctionId: "neural.cluster.summary",
          status: "success",
          clusterId,
          summaryGenerated: true,
          keyTopics: summary.keyTopics,
        } satisfies NeuralClusterSummaryOutputSuccess,
      });
    });

    // Record cluster_summary_generated metric
    // clerkOrgId is resolved at workflow start (from event or DB fallback)
    if (clerkOrgId) {
      void recordJobMetric({
        clerkOrgId,
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
