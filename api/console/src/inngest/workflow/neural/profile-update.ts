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
  orgWorkspaces,
} from "@db/console/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { invalidateWorkspaceConfig } from "@repo/console-workspace-cache";
import { log } from "@vendor/observability/log";
import { recordJobMetric } from "../../../lib/jobs";

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
    const { workspaceId, clerkOrgId: eventClerkOrgId, actorId, sourceActor } = event.data;

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

    // Step 1: Get recent observations for this actor
    // TODO: Phase 5 will enable this when actor_profiles are migrated to BIGINT
    // Currently, observations.actorId is BIGINT but we receive varchar actorId from events
    // Since all observations have actorId = null until Phase 5, this query returns nothing
    const actorIdNum = parseInt(actorId, 10);
    const recentActivity = await step.run("gather-activity", async () => {
      // Skip if actorId is not a valid number (varchar actor IDs from Phase 3)
      if (isNaN(actorIdNum)) {
        return { count: 0, lastActiveAt: null };
      }
      const observations = await db.query.workspaceNeuralObservations.findMany({
        where: and(
          eq(workspaceNeuralObservations.workspaceId, workspaceId),
          eq(workspaceNeuralObservations.actorId, actorIdNum),
        ),
        orderBy: desc(workspaceNeuralObservations.occurredAt),
        limit: 100,
      });

      return {
        count: observations.length,
        lastActiveAt: observations[0]?.occurredAt ?? null,
      };
    });

    // Step 2: Check if profile exists (for cache invalidation)
    const existingProfile = await step.run("check-existing-profile", async () => {
      const profile = await db.query.workspaceActorProfiles.findFirst({
        where: and(
          eq(workspaceActorProfiles.workspaceId, workspaceId),
          eq(workspaceActorProfiles.actorId, actorId)
        ),
        columns: { id: true },
      });
      return { exists: !!profile };
    });

    // Step 3: Upsert profile
    await step.run("upsert-profile", async () => {
      // Use source actor name if available, fallback to actorId suffix
      const displayName = sourceActor?.name ?? actorId.split(":")[1] ?? actorId;

      await db
        .insert(workspaceActorProfiles)
        .values({
          workspaceId,
          actorId,
          displayName,
          email: sourceActor?.email ?? null,
          avatarUrl: sourceActor?.avatarUrl ?? null,
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
            // Update name/email/avatar only if currently null (COALESCE keeps existing values)
            displayName: sql`COALESCE(${workspaceActorProfiles.displayName}, ${displayName})`,
            email: sql`COALESCE(${workspaceActorProfiles.email}, ${sourceActor?.email ?? null})`,
            avatarUrl: sql`COALESCE(${workspaceActorProfiles.avatarUrl}, ${sourceActor?.avatarUrl ?? null})`,
            observationCount: recentActivity.count,
            lastActiveAt: recentActivity.lastActiveAt,
            updatedAt: new Date().toISOString(),
          },
        });

      // Invalidate workspace config cache if this was a new profile
      // This ensures hasActors flag updates for the workspace
      if (!existingProfile.exists) {
        await invalidateWorkspaceConfig(workspaceId);
        log.info("New actor profile created, workspace config cache invalidated", {
          workspaceId,
          actorId,
        });
      }

      log.info("Updated actor profile", {
        workspaceId,
        actorId,
        observationCount: recentActivity.count,
        isNew: !existingProfile.exists,
      });
    });

    // Record profile_updated metric
    // clerkOrgId is resolved at workflow start (from event or DB fallback)
    if (clerkOrgId) {
      void recordJobMetric({
        clerkOrgId,
        workspaceId,
        type: "profile_updated",
        value: 1,
        unit: "count",
        tags: {
          actorId,
        },
      });
    }

    return { actorId, observationCount: recentActivity.count };
  },
);
