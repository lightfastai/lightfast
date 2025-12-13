/**
 * Profile Update Workflow
 *
 * Async workflow triggered after observation capture.
 * Updates actor profile with activity metrics.
 *
 * Debounce: 5 minutes per actor (via concurrency + debounce)
 */

import { inngest } from "../../client/client";
import { db } from "@db/console/client";
import {
  workspaceActorProfiles,
  workspaceNeuralObservations,
} from "@db/console/schema";
import { eq, and, desc } from "drizzle-orm";
import { log } from "@vendor/observability/log";

export const profileUpdate = inngest.createFunction(
  {
    id: "apps-console/neural.profile.update",
    name: "Neural Profile Update",
    description: "Updates actor profile after observation capture",
    retries: 2,

    // Debounce: only process latest event per actor (5 min window)
    debounce: {
      key: "event.data.actorId",
      period: "5m",
    },

    // Limit concurrent profile updates per workspace
    concurrency: {
      limit: 5,
      key: "event.data.workspaceId",
    },

    timeouts: {
      start: "30s",
      finish: "2m",
    },
  },
  { event: "apps-console/neural/profile.update" },
  async ({ event, step }) => {
    const { workspaceId, actorId } = event.data;

    // Step 1: Get recent observations for this actor
    const recentActivity = await step.run("gather-activity", async () => {
      const observations = await db.query.workspaceNeuralObservations.findMany({
        where: and(
          eq(workspaceNeuralObservations.workspaceId, workspaceId),
          eq(workspaceNeuralObservations.actorId, actorId),
        ),
        orderBy: desc(workspaceNeuralObservations.occurredAt),
        limit: 100,
      });

      return {
        count: observations.length,
        lastActiveAt: observations[0]?.occurredAt ?? null,
      };
    });

    // Step 2: Upsert profile
    await step.run("upsert-profile", async () => {
      // Extract display name from actorId (source:id -> id)
      const displayName = actorId.split(":")[1] ?? actorId;

      await db
        .insert(workspaceActorProfiles)
        .values({
          workspaceId,
          actorId,
          displayName,
          observationCount: recentActivity.count,
          lastActiveAt: recentActivity.lastActiveAt,
          profileConfidence: 0.5, // Default until more sophisticated analysis
        })
        .onConflictDoUpdate({
          target: [
            workspaceActorProfiles.workspaceId,
            workspaceActorProfiles.actorId,
          ],
          set: {
            observationCount: recentActivity.count,
            lastActiveAt: recentActivity.lastActiveAt,
            updatedAt: new Date().toISOString(),
          },
        });

      log.info("Updated actor profile", {
        workspaceId,
        actorId,
        observationCount: recentActivity.count,
      });
    });

    return { actorId, observationCount: recentActivity.count };
  },
);
