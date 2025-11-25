/**
 * Activity Recording Workflow
 *
 * Batched activity recording workflow for efficient database writes.
 * Receives activity events from helper functions and batch inserts them
 * for better performance and reduced database load.
 *
 * Triggered by: apps-console/activity.record events (Tier 2 user actions)
 * Batching: Up to 100 events per batch, 10s timeout per workspace
 * Performance: 50-100x faster than individual inserts
 *
 * @see /docs/implementation/user-activity-tracking.md
 */

import { inngest } from "../../client/client";
import { db } from "@db/console/client";
import { workspaceUserActivities } from "@db/console/schema";
import { nanoid } from "@repo/lib";
import { log } from "@vendor/observability/log";

/**
 * Record Activity Workflow
 *
 * Processes batched activity events and inserts them into the database.
 * Uses Inngest's batch feature for efficient processing.
 */
export const recordActivity = inngest.createFunction(
  {
    id: "apps-console/record-activity",
    name: "Record Activity",
    description: "Batch record user activities for efficient database writes",
    retries: 3,

    // Batch configuration for optimal performance
    batchEvents: {
      maxSize: 100, // Process up to 100 events at once
      timeout: "10s", // Wait max 10s before processing partial batch
      key: "event.data.workspaceId", // Batch per workspace
    },
  },
  { event: "apps-console/activity.record" },
  async ({ events, step }) => {
    const batchSize = events.length;
    const workspaceId = events[0]?.data.workspaceId;

    log.info("Processing activity batch", {
      batchSize,
      workspaceId,
      firstEventTimestamp: events[0]?.ts,
      lastEventTimestamp: events[events.length - 1]?.ts,
    });

    // Step 1: Prepare activity records
    const activityRecords = await step.run("prepare-records", async () => {
      return events.map((event) => {
        const { data } = event;

        return {
          workspaceId: data.workspaceId,
          actorType: data.actorType,
          actorUserId: data.actorUserId ?? null,
          actorEmail: data.actorEmail ?? null,
          category: data.category,
          action: data.action,
          entityType: data.entityType,
          entityId: data.entityId,
          metadata: data.metadata ?? null,
          relatedActivityId: data.relatedActivityId ?? null,
        };
      });
    });

    // Step 2: Batch insert activities
    const insertResult = await step.run("batch-insert", async () => {
      try {
        // Use Drizzle's batch insert for optimal performance
        const result = await db
          .insert(workspaceUserActivities)
          .values(activityRecords)
          .returning({ id: workspaceUserActivities.id });

        log.info("Activity batch inserted", {
          workspaceId,
          insertedCount: result.length,
          batchSize,
        });

        return {
          success: true,
          insertedCount: result.length,
          insertedIds: result.map((r) => r.id),
        };
      } catch (error) {
        log.error("Failed to insert activity batch", {
          workspaceId,
          batchSize,
          error: error instanceof Error ? error.message : String(error),
        });

        throw error;
      }
    });

    return {
      success: true,
      workspaceId,
      batchSize,
      insertedCount: insertResult.insertedCount,
      timestamp: new Date().toISOString(),
    };
  }
);
