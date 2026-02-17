/**
 * Neural observation capture workflow
 *
 * Processes SourceEvents from webhooks into observations with embeddings.
 * This is the write path for the neural memory system.
 *
 * Workflow steps:
 * 1. Check for duplicate observations (idempotency)
 * 2. Check if event is allowed by source config (filtering)
 * 3. Evaluate significance (GATE - return early if below threshold)
 * 4. Fetch workspace context
 * 5. PARALLEL: Classification + Embedding + Entity Extraction
 * 6. Upsert vector to Pinecone
 * 7. Store observation + entities (transactional)
 * 8. Emit completion event
 */

import { inngest } from "../../client/client";
import { db } from "@db/console/client";
import {
  workspaceNeuralObservations,
  workspaceNeuralEntities,
  orgWorkspaces,
  workspaceIntegrations,
} from "@db/console/schema";
import { eq, and, sql } from "drizzle-orm";
import { log } from "@vendor/observability/log";
import { NonRetriableError } from "inngest";
import { consolePineconeClient } from "@repo/console-pinecone";
import { createEmbeddingProviderForWorkspace } from "@repo/console-embed";
import type { SourceEvent } from "@repo/console-types";
import { scoreSignificance, SIGNIFICANCE_THRESHOLD } from "./scoring";
import {
  buildClassificationPrompt,
  classifyObservationFallback,
} from "./classification";
import { classificationResponseSchema } from "@repo/console-validation";
import type { ClassificationResponse } from "@repo/console-validation";
import { extractEntities, extractFromReferences } from "./entity-extraction-patterns";
import {
  createTracedModel,
  generateObject,
  buildNeuralTelemetry,
} from "./ai-helpers";
import type { ExtractedEntity } from "@repo/console-types";
import { assignToCluster } from "./cluster-assignment";
import { resolveActor } from "./actor-resolution";
import { detectAndCreateRelationships } from "./relationship-detection";
import { nanoid } from "nanoid";
import type { SourceActor, SourceReference } from "@repo/console-types";
import { createJob, updateJobStatus, completeJob, recordJobMetric } from "../../../lib/jobs";
import { createNeuralOnFailureHandler } from "./on-failure-handler";
import type {
  NeuralObservationCaptureInput,
  NeuralObservationCaptureOutputSuccess,
  NeuralObservationCaptureOutputFiltered,
  NeuralObservationCaptureOutputFailure,
} from "@repo/console-validation";

/**
 * Observation vector metadata stored in Pinecone
 * All values must be string, number, boolean, or string[] per Pinecone constraints
 */
interface ObservationVectorMetadata {
  layer: string;
  view: "title" | "content" | "summary"; // Identifies embedding view for multi-view retrieval
  observationType: string;
  source: string;
  sourceType: string;
  sourceId: string;
  title: string;
  snippet: string;
  occurredAt: string;
  actorName: string;
  /** Pre-generated database ID for direct lookup (Phase 3 optimization) */
  observationId: string;
  // HACK: Index signature required to satisfy Pinecone's RecordMetadata constraint.
  // TODO: Re-export RecordMetadata from @repo/console-pinecone and extend it properly.
  [key: string]: string | number | boolean | string[];
}

/**
 * Result of multi-view embedding generation
 */
interface MultiViewEmbeddingResult {
  title: {
    vectorId: string;
    vector: number[];
  };
  content: {
    vectorId: string;
    vector: number[];
  };
  summary: {
    vectorId: string;
    vector: number[];
  };
  legacyVectorId: string;
}

/**
 * Map source event types to observation types
 */
function deriveObservationType(sourceEvent: SourceEvent): string {
  // For GitHub events, use sourceType directly
  // e.g., "push", "pull_request_merged", "issue_opened"
  if (sourceEvent.source === "github") {
    return sourceEvent.sourceType;
  }

  // For Vercel events, simplify the type
  // e.g., "deployment.succeeded" → "deployment_succeeded"
  if (sourceEvent.source === "vercel") {
    return sourceEvent.sourceType.replace(".", "_");
  }

  return sourceEvent.sourceType;
}

/**
 * Extract topics from source event
 * Simple keyword extraction for MVP
 */
function extractTopics(sourceEvent: SourceEvent): string[] {
  const topics: string[] = [];

  // Add source as topic
  topics.push(sourceEvent.source);

  // Add observation type
  topics.push(deriveObservationType(sourceEvent));

  // Extract from labels
  for (const ref of sourceEvent.references) {
    if (ref.type === "label") {
      topics.push(ref.id.toLowerCase());
    }
  }

  // Extract common keywords from title
  const keywords = ["fix", "feat", "refactor", "test", "docs", "chore", "ci", "perf"];
  const titleLower = sourceEvent.title.toLowerCase();
  for (const keyword of keywords) {
    if (titleLower.includes(keyword)) {
      topics.push(keyword);
    }
  }

  return [...new Set(topics)]; // Deduplicate
}

/**
 * Map detailed sourceType to base event type for config comparison.
 *
 * Internal format uses dot notation: "pull-request.opened", "issue.closed"
 * Config format uses underscores: "pull_request", "issues"
 *
 * @example
 * getBaseEventType("github", "pull-request.opened") // "pull_request"
 * getBaseEventType("github", "issue.closed") // "issues"
 * getBaseEventType("github", "push") // "push"
 * getBaseEventType("vercel", "deployment.created") // "deployment.created"
 */
function getBaseEventType(source: string, sourceType: string): string {
  // Defensive: Strip source prefix if present (transformers should not include it)
  const prefix = `${source}:`;
  const cleanType = sourceType.startsWith(prefix)
    ? sourceType.slice(prefix.length)
    : sourceType;

  if (source === "github") {
    // Internal format uses dot notation: "pull-request.opened"
    const dotIndex = cleanType.indexOf(".");
    if (dotIndex > 0) {
      const base = cleanType.substring(0, dotIndex);
      // Convert hyphens to underscores for config format
      const configBase = base.replace(/-/g, "_");
      // Special case: issue → issues (config uses plural)
      return configBase === "issue" ? "issues" : configBase;
    }
    // Handle simple events like "push"
    return cleanType;
  }

  if (source === "vercel") {
    // Vercel events are already in category format (e.g., "deployment.created")
    return cleanType;
  }

  if (source === "sentry") {
    // Normalize Sentry events to category level
    // issue.created, issue.resolved, issue.assigned, issue.ignored → issue
    // error → error (already category level)
    // event-alert → event_alert (convert hyphens to underscores for config)
    // metric-alert → metric_alert (convert hyphens to underscores for config)
    if (cleanType.startsWith("issue.")) {
      return "issue";
    }
    // Convert hyphens to underscores to match config format
    return cleanType.replace(/-/g, "_"); // event-alert → event_alert
  }

  if (source === "linear") {
    // Normalize Linear events to category level
    // After transformer update, format is: issue.created, comment.created, etc.
    // Need to extract before dot and capitalize: issue.created → Issue
    // Config format: Issue, Comment, Project, Cycle, ProjectUpdate
    const dotIndex = cleanType.indexOf(".");
    if (dotIndex > 0) {
      const base = cleanType.substring(0, dotIndex);
      // Capitalize first letter and handle camelCase (project-update → ProjectUpdate)
      return base
        .split("-")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join("");
    }
    // Fallback for category-level events already (shouldn't happen with new format)
    return cleanType;
  }

  return cleanType;
}

/**
 * Check if an event type is allowed for a source based on sourceConfig.sync.events
 */
function isEventAllowed(
  sourceConfig: { sync?: { events?: string[] } } | null | undefined,
  baseEventType: string,
): boolean {
  const events = sourceConfig?.sync?.events;
  if (!events || events.length === 0) {
    return false;
  }
  return events.includes(baseEventType);
}

/**
 * Resolve clerkOrgId from event data or database.
 *
 * New events include clerkOrgId from webhook handler.
 * Legacy events (or edge cases) fallback to database lookup.
 *
 * @returns clerkOrgId or empty string if workspace not found
 */
async function resolveClerkOrgId(
  eventClerkOrgId: string | undefined,
  workspaceId: string,
): Promise<string> {
  // Prefer event data (new flow)
  if (eventClerkOrgId) {
    return eventClerkOrgId;
  }

  // Track fallback usage to monitor migration progress
  // Fallback to database lookup (backwards compat)
  log.warn("clerkOrgId fallback to DB lookup", {
    workspaceId,
    reason: "event_missing_clerkOrgId",
  });

  const workspace = await db.query.orgWorkspaces.findFirst({
    where: eq(orgWorkspaces.id, workspaceId),
    columns: { clerkOrgId: true },
  });

  return workspace?.clerkOrgId ?? "";
}

/**
 * Reconcile Vercel actor IDs when a GitHub push provides numeric ID.
 *
 * When a GitHub push arrives with a commit SHA, we find any Vercel observations
 * that reference the same commit but have username-based actor IDs. We then
 * update those observations with the numeric GitHub ID from the push event.
 *
 * This ensures cross-source actor consistency: Vercel deployments triggered
 * by the same commit as a GitHub push will share the same canonical actor ID.
 *
 * @returns Array of updated observation IDs
 */
async function reconcileVercelActorsForCommit(
  workspaceId: string,
  commitSha: string,
  numericActorId: string,
  sourceActor: SourceActor,
): Promise<string[]> {
  if (!commitSha || !numericActorId) return [];

  // Only reconcile if the actor ID is actually numeric
  if (!/^\d+$/.test(numericActorId)) return [];

  try {
    // Find Vercel observations with this commit SHA that have non-numeric actor IDs
    // Using PostgreSQL JSONB containment to search within the sourceReferences array
    const vercelObservations = await db.query.workspaceNeuralObservations.findMany({
      where: and(
        eq(workspaceNeuralObservations.workspaceId, workspaceId),
        eq(workspaceNeuralObservations.source, "vercel"),
        // Check if sourceReferences contains a commit with this SHA
        sql`${workspaceNeuralObservations.sourceReferences}::jsonb @> ${JSON.stringify([{ type: "commit", id: commitSha }])}::jsonb`,
      ),
      columns: {
        id: true,
        externalId: true,
        actor: true,
      },
    });

    if (vercelObservations.length === 0) return [];

    const updatedIds: string[] = [];

    for (const obs of vercelObservations) {
      const currentActor = obs.actor as SourceActor | null;

      // Skip if no actor or already has numeric ID
      if (!currentActor?.id) continue;
      if (/^\d+$/.test(currentActor.id)) continue;

      // Update the actor with numeric ID and enriched profile data
      const updatedActor: SourceActor = {
        ...currentActor,
        id: numericActorId,
        // Preserve existing name, or use the GitHub actor's name
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- runtime safety: name may be null despite type
        name: currentActor.name ?? sourceActor.name,
        // Add email/avatar from GitHub if not present
        email: currentActor.email ?? sourceActor.email,
        avatarUrl: currentActor.avatarUrl ?? sourceActor.avatarUrl,
      };

      await db
        .update(workspaceNeuralObservations)
        .set({
          actor: updatedActor,
        })
        .where(eq(workspaceNeuralObservations.id, obs.id));

      updatedIds.push(obs.externalId);

      log.info("Reconciled Vercel actor with numeric GitHub ID", {
        observationId: obs.externalId,
        commitSha,
        previousActorId: currentActor.id,
        numericActorId,
      });
    }

    if (updatedIds.length > 0) {
      log.info("Reconciled Vercel actors for commit", {
        workspaceId,
        commitSha,
        numericActorId,
        reconciled: updatedIds.length,
      });
    }

    return updatedIds;
  } catch (error) {
    log.warn("Failed to reconcile Vercel actors for commit", {
      workspaceId,
      commitSha,
      error,
    });
    return [];
  }
}

/**
 * Neural observation capture workflow
 *
 * Processes SourceEvents from webhooks into observations with embeddings.
 */
export const observationCapture = inngest.createFunction(
  {
    id: "apps-console/neural.observation.capture",
    name: "Neural Observation Capture",
    description: "Captures engineering events as neural observations",
    retries: 3,

    // Idempotency by workspace + source ID to prevent duplicate observations per workspace
    idempotency: "event.data.workspaceId + '-' + event.data.sourceEvent.sourceId",

    // Concurrency limit per workspace
    concurrency: {
      limit: 10,
      key: "event.data.workspaceId",
    },

    timeouts: {
      start: "1m",
      finish: "5m",
    },

    // Handle failures gracefully - complete job as failed
    onFailure: createNeuralOnFailureHandler(
      "apps-console/neural/observation.capture",
      {
        logMessage: "Neural observation capture failed",
        logContext: ({ workspaceId, sourceEvent }) => ({
          workspaceId,
          sourceId: sourceEvent.sourceId,
        }),
        buildOutput: ({ data: { sourceEvent }, error }) => ({
          inngestFunctionId: "neural.observation.capture",
          status: "failure",
          sourceId: sourceEvent.sourceId,
          error,
        } satisfies NeuralObservationCaptureOutputFailure),
      },
    ),
  },
  { event: "apps-console/neural/observation.capture" },
  async ({ event, step }) => {
    const { workspaceId, clerkOrgId: eventClerkOrgId, sourceEvent } = event.data;

    // Generate replay-safe values inside steps so they're memoized across retries.
    // Without this, Inngest re-executes the function body on retry, generating new
    // values while completed steps return their memoized results — causing mismatches.
    const { externalId, startTime } = await step.run("generate-replay-safe-ids", () => ({
      externalId: nanoid(),
      startTime: Date.now(),
    }));

    // Resolve clerkOrgId EARLY (before any metrics or processing)
    // This ensures all metrics have valid clerkOrgId
    const clerkOrgId = await step.run("resolve-clerk-org-id", async () => {
      return resolveClerkOrgId(eventClerkOrgId, workspaceId);
    });

    log.info("Capturing neural observation", {
      workspaceId,
      clerkOrgId,
      externalId,
      source: sourceEvent.source,
      sourceType: sourceEvent.sourceType,
      sourceId: sourceEvent.sourceId,
    });

    // Step 0: Create job record for tracking
    // Generate a run ID if event.id is not available (shouldn't happen in production)
    const inngestRunId = event.id ?? `neural-obs-${sourceEvent.sourceId}-${startTime}`;
    const jobId = await step.run("create-job", async () => {
      return createJob({
        clerkOrgId,
        workspaceId,
        inngestRunId,
        inngestFunctionId: "neural.observation.capture",
        name: `Capture ${sourceEvent.source}/${sourceEvent.sourceType}`,
        trigger: "webhook",
        input: {
          inngestFunctionId: "neural.observation.capture",
          sourceId: sourceEvent.sourceId,
          source: sourceEvent.source,
          sourceType: sourceEvent.sourceType,
          title: sourceEvent.title,
        } satisfies NeuralObservationCaptureInput,
      });
    });

    // Update job status to running
    await step.run("update-job-running", async () => {
      await updateJobStatus(jobId, "running");
    });

    // Step 1: Check for duplicate
    const existing = await step.run("check-duplicate", async () => {
      const obs = await db.query.workspaceNeuralObservations.findFirst({
        where: and(
          eq(workspaceNeuralObservations.workspaceId, workspaceId),
          eq(workspaceNeuralObservations.sourceId, sourceEvent.sourceId),
        ),
      });

      if (obs) {
        log.info("Observation already exists, skipping", {
          observationId: obs.id,
          sourceId: sourceEvent.sourceId,
        });
      }

      return obs ?? null;
    });

    if (existing) {
      // Complete job as filtered (duplicate - expected behavior, not failure)
      await step.run("complete-job-duplicate", async () => {
        await completeJob({
          jobId,
          status: "completed",
          output: {
            inngestFunctionId: "neural.observation.capture",
            status: "filtered",
            reason: "duplicate",
            sourceId: sourceEvent.sourceId,
          } satisfies NeuralObservationCaptureOutputFiltered,
        });
      });

      // Record duplicate metric (non-blocking)
      void recordJobMetric({
        clerkOrgId, // Now valid from early resolution
        workspaceId,
        type: "observation_duplicate",
        value: 1,
        unit: "count",
        tags: {
          source: sourceEvent.source,
          sourceType: sourceEvent.sourceType,
          durationMs: Date.now() - startTime,
        },
      });

      return {
        status: "duplicate",
        observationId: existing.id,
        duration: Date.now() - startTime,
      };
    }

    // Step 2: Check if event is allowed by source config
    const eventAllowed = await step.run("check-event-allowed", async () => {
      // Extract resource ID from metadata based on source type
      const metadata = sourceEvent.metadata;

      let resourceId: string | undefined;
      switch (sourceEvent.source) {
        case "github":
          resourceId = metadata.repoId?.toString();
          break;
        case "vercel":
          resourceId = metadata.projectId?.toString();
          break;
        case "sentry":
          resourceId = metadata.projectId?.toString();
          break;
        case "linear":
          resourceId = metadata.teamId?.toString();
          break;
        default:
          resourceId = undefined;
      }

      if (!resourceId) {
        // CHANGED: No resource ID - reject (can't determine if configured)
        log.info("No resource ID in metadata, rejecting event", {
          source: sourceEvent.source,
          sourceType: sourceEvent.sourceType,
        });
        return false; // CHANGED from true to false
      }

      // Look up the integration by workspaceId + providerResourceId
      const integration = await db.query.workspaceIntegrations.findFirst({
        where: and(
          eq(workspaceIntegrations.workspaceId, workspaceId),
          eq(workspaceIntegrations.providerResourceId, resourceId),
        ),
      });

      if (!integration) {
        // CHANGED: Integration not found - reject (resource not connected to workspace)
        log.info("Integration not found for resource, rejecting event", {
          workspaceId,
          resourceId,
          source: sourceEvent.source,
        });
        return false; // CHANGED from true to false
      }

      // Check if event is allowed
      const baseEventType = getBaseEventType(sourceEvent.source, sourceEvent.sourceType);
      const sourceConfig = integration.sourceConfig as { sync?: { events?: string[] } };
      const allowed = isEventAllowed(sourceConfig, baseEventType);

      if (!allowed) {
        log.info("Event filtered by source config", {
          workspaceId,
          resourceId,
          sourceType: sourceEvent.sourceType,
          baseEventType,
          configuredEvents: sourceConfig.sync?.events,
        });
      }

      return allowed;
    });

    if (!eventAllowed) {
      // Complete job as filtered (event_not_allowed)
      await step.run("complete-job-filtered", async () => {
        await completeJob({
          jobId,
          status: "completed",
          output: {
            inngestFunctionId: "neural.observation.capture",
            status: "filtered",
            reason: "event_not_allowed",
            sourceId: sourceEvent.sourceId,
          } satisfies NeuralObservationCaptureOutputFiltered,
        });
      });

      // Record filtered metric (non-blocking)
      void recordJobMetric({
        clerkOrgId, // Now valid from early resolution
        workspaceId,
        type: "observation_filtered",
        value: 1,
        unit: "count",
        tags: {
          source: sourceEvent.source,
          sourceType: sourceEvent.sourceType,
          durationMs: Date.now() - startTime,
        },
      });

      return {
        status: "filtered",
        reason: "Event type not enabled in source config",
        duration: Date.now() - startTime,
      };
    }

    // Step 3: Evaluate significance (early gate)
    const significance = await step.run("evaluate-significance", () => {
      return scoreSignificance(sourceEvent);
    });

    // Gate: Skip low-significance events
    if (significance.score < SIGNIFICANCE_THRESHOLD) {
      log.info("Observation below significance threshold, skipping", {
        workspaceId,
        sourceId: sourceEvent.sourceId,
        significanceScore: significance.score,
        threshold: SIGNIFICANCE_THRESHOLD,
        factors: significance.factors,
      });

      // Complete job as filtered (below_threshold)
      await step.run("complete-job-below-threshold", async () => {
        await completeJob({
          jobId,
          status: "completed",
          output: {
            inngestFunctionId: "neural.observation.capture",
            status: "filtered",
            reason: "below_threshold",
            sourceId: sourceEvent.sourceId,
            significanceScore: significance.score,
          } satisfies NeuralObservationCaptureOutputFiltered,
        });
      });

      // Record below_threshold metric (non-blocking)
      void recordJobMetric({
        clerkOrgId, // Now valid from early resolution
        workspaceId,
        type: "observation_below_threshold",
        value: 1,
        unit: "count",
        tags: {
          source: sourceEvent.source,
          sourceType: sourceEvent.sourceType,
          significanceScore: significance.score,
          durationMs: Date.now() - startTime,
        },
      });

      return {
        status: "below_threshold",
        significanceScore: significance.score,
        threshold: SIGNIFICANCE_THRESHOLD,
        duration: Date.now() - startTime,
      };
    }

    // Step 4: Fetch workspace context
    const workspace = await step.run("fetch-context", async () => {
      const ws = await db.query.orgWorkspaces.findFirst({
        where: eq(orgWorkspaces.id, workspaceId),
      });

      if (!ws) {
        throw new NonRetriableError(`Workspace not found: ${workspaceId}`);
      }

      // Settings is always populated (NOT NULL with version check)
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- runtime safety: version may differ in future
      if (ws.settings.version !== 1) {
        throw new NonRetriableError(`Workspace ${workspaceId} has invalid settings version`);
      }

      return ws;
    });

    // Step 5a: Classification with Claude Haiku (uses step.ai.wrap)
    const classificationResult = await (async () => {
      try {
        const llmResult = (await step.ai.wrap(
          "classify-observation",
          generateObject,
          {
            model: createTracedModel("anthropic/claude-3-5-haiku-latest"),
            schema: classificationResponseSchema,
            prompt: buildClassificationPrompt(sourceEvent),
            temperature: 0.2,
            experimental_telemetry: buildNeuralTelemetry("neural-classification", {
              workspaceId,
              sourceType: sourceEvent.sourceType,
              source: sourceEvent.source,
            }),
          } as Parameters<typeof generateObject>[0]
        )) as { object: ClassificationResponse };

        const classification = llmResult.object;
        const keywordTopics = extractTopics(sourceEvent);

        // Merge and deduplicate topics
        const topics = [
          ...keywordTopics,
          classification.primaryCategory,
          ...classification.secondaryCategories,
          ...classification.topics,
        ].filter((t, i, arr) => arr.indexOf(t) === i);

        return { topics, classification };
      } catch (error) {
        // Fallback to regex-based classification on LLM failure
        log.warn("Classification LLM failed, using fallback", {
          error: String(error),
          sourceId: sourceEvent.sourceId,
        });
        const fallback = classifyObservationFallback(sourceEvent);
        const keywordTopics = extractTopics(sourceEvent);
        const topics = [
          ...keywordTopics,
          fallback.primaryCategory,
          ...fallback.secondaryCategories,
        ].filter((t, i, arr) => arr.indexOf(t) === i);

        return {
          topics,
          classification: {
            primaryCategory: fallback.primaryCategory,
            secondaryCategories: fallback.secondaryCategories,
            topics: [],
            confidence: 0.5,
            reasoning: "Fallback regex classification",
          } as ClassificationResponse,
        };
      }
    })();

    // Step 5b: PARALLEL processing (no interdependencies)
    const [embeddingResult, extractedEntities, resolvedActor] = await Promise.all([
      // Multi-view embedding generation (title, content, summary)
      step.run("generate-multi-view-embeddings", async (): Promise<MultiViewEmbeddingResult> => {
        const embeddingProvider = createEmbeddingProviderForWorkspace(
          {
            id: workspace.id,
            embeddingModel: workspace.settings.embedding.embeddingModel,
            embeddingDim: workspace.settings.embedding.embeddingDim,
          },
          { inputType: "search_document" }
        );

        // Prepare texts for each view
        const titleText = sourceEvent.title;
        const contentText = sourceEvent.body;
        const summaryText = `${sourceEvent.title}\n\n${sourceEvent.body.slice(0, 1000)}`;

        // Generate all 3 embeddings in parallel (single batch call)
        const result = await embeddingProvider.embed([titleText, contentText, summaryText]);

        if (!result.embeddings[0] || !result.embeddings[1] || !result.embeddings[2]) {
          throw new Error("Failed to generate all multi-view embeddings");
        }

        // Generate view-specific vector IDs
        const baseId = sourceEvent.sourceId.replace(/[^a-zA-Z0-9]/g, "_");

        return {
          title: {
            vectorId: `obs_title_${baseId}`,
            vector: result.embeddings[0],
          },
          content: {
            vectorId: `obs_content_${baseId}`,
            vector: result.embeddings[1],
          },
          summary: {
            vectorId: `obs_summary_${baseId}`,
            vector: result.embeddings[2],
          },
          // Keep legacy ID for backwards compatibility during migration
          legacyVectorId: `obs_${baseId}`,
        };
      }),

      // Entity extraction (inline, not fire-and-forget)
      step.run("extract-entities", () => {
        const textEntities = extractEntities(sourceEvent.title, sourceEvent.body);
        const references = sourceEvent.references as { type: string; id: string; label?: string }[];
        const refEntities = extractFromReferences(references);

        // Combine and deduplicate
        const allEntities = [...textEntities, ...refEntities];
        const entityMap = new Map<string, ExtractedEntity>();

        for (const entity of allEntities) {
          const key = `${entity.category}:${entity.key.toLowerCase()}`;
          const existing = entityMap.get(key);
          if (!existing || existing.confidence < entity.confidence) {
            entityMap.set(key, entity);
          }
        }

        // Limit to prevent runaway extraction
        const deduplicated = Array.from(entityMap.values());
        return deduplicated.slice(0, 50); // MAX_ENTITIES_PER_OBSERVATION
      }),

      // Actor resolution (Tier 2: email matching)
      step.run("resolve-actor", async () => {
        return resolveActor(workspaceId, sourceEvent);
      }),
    ]);

    // Record actor_resolution analytics metric (non-blocking)
    // Determines resolution method based on source and actor ID format
    const getActorResolutionMethod = (): "github_id" | "commit_sha" | "username" | "none" => {
      if (!resolvedActor.actorId) return "none";
      if (sourceEvent.source === "github") return "github_id";
      // For Vercel: check if we got a numeric ID (resolved via commit SHA) or username
      if (sourceEvent.source === "vercel") {
        const actorIdPart = resolvedActor.actorId.split(":")[1];
        return actorIdPart && /^\d+$/.test(actorIdPart) ? "commit_sha" : "username";
      }
      return "github_id";
    };

    void recordJobMetric({
      clerkOrgId,
      workspaceId,
      type: "actor_resolution",
      value: 1,
      unit: "count",
      tags: {
        resolved: !!resolvedActor.actorId,
        source: sourceEvent.source,
        method: getActorResolutionMethod(),
      },
    });

    const { topics } = classificationResult;
    // embeddingResult is now MultiViewEmbeddingResult with title, content, summary views

    // Step 5.5: Assign to cluster (use content embedding for best semantic matching)
    const clusterResult = await step.run("assign-cluster", async () => {
      // Extract entity IDs from extracted entities
      const entityIds = extractedEntities.map(
        (e) => `${e.category}:${e.key}`
      );

      return assignToCluster({
        workspaceId,
        embeddingVector: embeddingResult.content.vector,
        vectorId: embeddingResult.content.vectorId,
        topics,
        entityIds,
        // Use resolved actor ID for cluster affinity
        actorId: resolvedActor.actorId,
        occurredAt: sourceEvent.occurredAt,
        title: sourceEvent.title,
        indexName: workspace.settings.embedding.indexName,
        namespace: workspace.settings.embedding.namespaceName,
      });
    });

    // Record cluster_affinity analytics metric (non-blocking)
    // Tracks how well observations fit into clusters
    void recordJobMetric({
      clerkOrgId,
      workspaceId,
      type: "cluster_affinity",
      value: 1,
      unit: "count",
      tags: {
        affinityScore: clusterResult.affinityScore ?? 0,
        joined: !clusterResult.isNew,
        clusterId: String(clusterResult.clusterId),
      },
    });

    // Step 6: Upsert multi-view vectors to Pinecone
    await step.run("upsert-multi-view-vectors", async () => {
      const namespace = workspace.settings.embedding.namespaceName;

      // Base metadata shared across all views
      const baseMetadata = {
        layer: "observations",
        observationType: deriveObservationType(sourceEvent),
        source: sourceEvent.source,
        sourceType: sourceEvent.sourceType,
        sourceId: sourceEvent.sourceId,
        occurredAt: sourceEvent.occurredAt,
        actorName: sourceEvent.actor?.name ?? "unknown",
        // Pre-generated externalId for direct lookup (BIGINT migration)
        // This eliminates database queries during search ID normalization.
        // The observationId field stores the public nanoid identifier.
        observationId: externalId,
      };

      // View-specific metadata
      const titleMetadata: ObservationVectorMetadata = {
        ...baseMetadata,
        view: "title",
        title: sourceEvent.title,
        snippet: sourceEvent.title,
      };

      const contentMetadata: ObservationVectorMetadata = {
        ...baseMetadata,
        view: "content",
        title: sourceEvent.title,
        snippet: sourceEvent.body.slice(0, 500),
      };

      const summaryMetadata: ObservationVectorMetadata = {
        ...baseMetadata,
        view: "summary",
        title: sourceEvent.title,
        snippet: `${sourceEvent.title}\n${sourceEvent.body.slice(0, 300)}`,
      };

      // Batch upsert all 3 vectors
      await consolePineconeClient.upsertVectors<ObservationVectorMetadata>(
        workspace.settings.embedding.indexName,
        {
          ids: [
            embeddingResult.title.vectorId,
            embeddingResult.content.vectorId,
            embeddingResult.summary.vectorId,
          ],
          vectors: [
            embeddingResult.title.vector,
            embeddingResult.content.vector,
            embeddingResult.summary.vector,
          ],
          metadata: [titleMetadata, contentMetadata, summaryMetadata],
        },
        namespace
      );

      log.info("Multi-view vectors upserted to Pinecone", {
        titleVectorId: embeddingResult.title.vectorId,
        contentVectorId: embeddingResult.content.vectorId,
        summaryVectorId: embeddingResult.summary.vectorId,
        namespace,
        indexName: workspace.settings.embedding.indexName,
      });
    });

    // Step 7: Store observation + entities (transactional)
    // Note: Topics come from Step 5 (classify), significance from Step 3
    const { observation, entitiesStored } = await step.run("store-observation", async () => {
      const observationType = deriveObservationType(sourceEvent);

      return await db.transaction(async (tx) => {
        // Insert observation with BIGINT id (auto-generated) and pre-generated externalId
        // The externalId is already stored in Pinecone metadata for direct lookup.
        // Note: clusterId and actorId are null until Phase 5 migrates those tables to BIGINT
        const [obs] = await tx
          .insert(workspaceNeuralObservations)
          .values({
            // id: auto-generated BIGINT
            externalId, // Pre-generated nanoid for API/Pinecone lookups
            workspaceId,
            occurredAt: sourceEvent.occurredAt,
            actor: sourceEvent.actor ?? null,
            // actorId: null until Phase 5 (actor_profiles still uses varchar)
            // clusterId: null until Phase 5 (clusters still uses varchar)
            observationType,
            title: sourceEvent.title,
            content: sourceEvent.body,
            topics,
            significanceScore: significance.score,
            source: sourceEvent.source,
            sourceType: sourceEvent.sourceType,
            sourceId: sourceEvent.sourceId,
            sourceReferences: sourceEvent.references,
            metadata: sourceEvent.metadata,
            embeddingVectorId: embeddingResult.legacyVectorId, // Keep for backwards compat
            embeddingTitleId: embeddingResult.title.vectorId,
            embeddingContentId: embeddingResult.content.vectorId,
            embeddingSummaryId: embeddingResult.summary.vectorId,
            ingestionSource: event.data.ingestionSource ?? "webhook",
          })
          .returning();

        if (!obs) {
          throw new Error("Failed to insert observation");
        }

        // Insert entities with upsert (same transaction)
        let entitiesStored = 0;
        for (const entity of extractedEntities) {
          await tx
            .insert(workspaceNeuralEntities)
            .values({
              workspaceId,
              category: entity.category,
              key: entity.key,
              value: entity.value,
              sourceObservationId: obs.id, // Use internal BIGINT id (Phase 5 complete)
              evidenceSnippet: entity.evidence,
              confidence: entity.confidence,
            })
            .onConflictDoUpdate({
              target: [
                workspaceNeuralEntities.workspaceId,
                workspaceNeuralEntities.category,
                workspaceNeuralEntities.key,
              ],
              set: {
                lastSeenAt: new Date().toISOString(),
                occurrenceCount: sql`${workspaceNeuralEntities.occurrenceCount} + 1`,
                updatedAt: new Date().toISOString(),
              },
            });
          entitiesStored++;
        }

        log.info("Observation and entities stored", {
          observationId: obs.id, // Internal BIGINT
          externalId: obs.externalId, // Public nanoid
          observationType,
          entitiesExtracted: extractedEntities.length,
          entitiesStored,
        });

        return { observation: obs, entitiesStored };
      });
    });

    // Step 7.5: Detect and create relationships
    // Links this observation to others via shared commit SHAs, branch names, issue IDs
    const relationshipsCreated = await step.run(
      "detect-relationships",
      async () => {
        return detectAndCreateRelationships(
          workspaceId,
          observation.id,
          sourceEvent
        );
      }
    );

    log.info("Observation relationships detected", {
      observationId: observation.externalId,
      relationshipsCreated,
    });

    // Step 7.6: Reconcile Vercel actors (only for GitHub push events)
    // When a GitHub push arrives, update any Vercel observations that reference
    // the same commit SHA but have username-based actor IDs
    if (sourceEvent.source === "github" && sourceEvent.sourceType === "push") {
      await step.run("reconcile-vercel-actors", async () => {
        // Extract commit SHAs from the push event references
        const references = sourceEvent.references as SourceReference[];
        const commitRefs = references.filter((ref) => ref.type === "commit");

        if (commitRefs.length === 0 || !resolvedActor.sourceActor?.id) {
          return { reconciled: 0 };
        }

        let totalReconciled = 0;

        // Reconcile for each commit SHA in the push
        for (const commitRef of commitRefs) {
          const reconciledIds = await reconcileVercelActorsForCommit(
            workspaceId,
            commitRef.id,
            resolvedActor.sourceActor.id,
            resolvedActor.sourceActor,
          );
          totalReconciled += reconciledIds.length;
        }

        return { reconciled: totalReconciled };
      });
    }

    // Step 8: Fire-and-forget events
    // Note: Using externalId for public-facing events, convert BIGINT ids to strings for events
    // All child events receive clerkOrgId for metrics tracking (Phase: clerkOrgId propagation)
    await step.sendEvent("emit-events", [
      // Completion event for downstream systems
      {
        name: "apps-console/neural/observation.captured" as const,
        data: {
          workspaceId,
          clerkOrgId, // Propagate for metrics tracking
          observationId: observation.externalId, // Public nanoid for API consumers
          sourceId: sourceEvent.sourceId,
          observationType: observation.observationType,
          significanceScore: significance.score,
          topics,
          entitiesExtracted: extractedEntities.length,
          clusterId: String(clusterResult.clusterId), // Convert BIGINT to string for events
          clusterIsNew: clusterResult.isNew,
        },
      },
      // Profile update (if actor resolved)
      ...(resolvedActor.actorId
        ? [
            {
              name: "apps-console/neural/profile.update" as const,
              data: {
                workspaceId,
                clerkOrgId, // Propagate for metrics tracking
                actorId: resolvedActor.actorId,
                observationId: observation.externalId, // Public nanoid
                sourceActor: resolvedActor.sourceActor ?? undefined,
              },
            },
          ]
        : []),
      // Cluster summary check
      {
        name: "apps-console/neural/cluster.check-summary" as const,
        data: {
          workspaceId,
          clerkOrgId, // Propagate for metrics tracking
          clusterId: String(clusterResult.clusterId), // Convert BIGINT to string for events
          observationCount: clusterResult.isNew ? 1 : 0, // Will be fetched in workflow
        },
      },
      // LLM entity extraction for observations with rich content (>200 chars)
      ...(sourceEvent.body.length > 200
        ? [
            {
              name: "apps-console/neural/llm-entity-extraction.requested" as const,
              data: {
                workspaceId,
                clerkOrgId, // Propagate for metrics tracking
                observationId: observation.externalId, // Public nanoid
              },
            },
          ]
        : []),
    ]);

    // Complete job with success output
    const finalDuration = Date.now() - startTime;
    await step.run("complete-job-success", async () => {
      await completeJob({
        jobId,
        status: "completed",
        output: {
          inngestFunctionId: "neural.observation.capture",
          status: "success",
          observationId: observation.externalId,
          observationType: observation.observationType,
          significanceScore: significance.score,
          entitiesExtracted: entitiesStored,
          clusterId: String(clusterResult.clusterId),
          clusterIsNew: clusterResult.isNew,
        } satisfies NeuralObservationCaptureOutputSuccess,
      });
    });

    // Record success metrics (non-blocking, in parallel)
    const metricsPromises = [
      // Observation captured metric
      recordJobMetric({
        clerkOrgId, // Use pre-resolved value for consistency
        workspaceId,
        type: "observation_captured",
        value: 1,
        unit: "count",
        tags: {
          source: sourceEvent.source,
          sourceType: sourceEvent.sourceType,
          observationType: observation.observationType,
          significanceScore: significance.score,
          durationMs: finalDuration,
        },
      }),

      // Entities extracted metric
      recordJobMetric({
        clerkOrgId, // Use pre-resolved value for consistency
        workspaceId,
        type: "entities_extracted",
        value: entitiesStored,
        unit: "count",
        tags: {
          observationId: observation.externalId,
          entityCount: entitiesStored,
          source: sourceEvent.source,
        },
      }),

      // Cluster assigned metric
      recordJobMetric({
        clerkOrgId, // Use pre-resolved value for consistency
        workspaceId,
        type: "cluster_assigned",
        value: 1,
        unit: "count",
        tags: {
          clusterId: String(clusterResult.clusterId),
          isNew: clusterResult.isNew,
        },
      }),
    ];

    // Fire-and-forget metrics recording
    void Promise.all(metricsPromises);

    return {
      status: "captured",
      observationId: observation.externalId, // Public nanoid for API response
      observationType: observation.observationType,
      duration: finalDuration,
    };
  }
);
