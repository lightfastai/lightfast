/**
 * Activity Recording Workflow
 *
 * Batched activity recording workflow for efficient database writes.
 * Receives activity events from helper functions and batch inserts them
 * for better performance and reduced database load.
 *
 * Triggered by: app/activity.record events (Tier 2 user actions)
 * Batching: Up to 100 events per batch, 10s timeout per org
 * Performance: 50-100x faster than individual inserts
 *
 * @see /docs/implementation/user-activity-tracking.md
 */

import { db } from "@db/app/client";
import { orgUserActivities } from "@db/app/schema";
import type { ActivityMetadata } from "@repo/app-validation";
import { parseError } from "@vendor/observability/error/next";
import { log } from "@vendor/observability/log/next";
import { inngest } from "../../client/client";

/**
 * Record Activity Workflow
 *
 * Processes batched activity events and inserts them into the database.
 * Uses Inngest's batch feature for efficient processing.
 */
export const recordActivity = inngest.createFunction(
  {
    id: "app/record-activity",
    name: "Record Activity",
    description: "Batch record user activities for efficient database writes",
    retries: 3,

    // Batch configuration for optimal performance
    batchEvents: {
      maxSize: 100, // Process up to 100 events at once
      timeout: "10s", // Wait max 10s before processing partial batch
      key: "event.data.clerkOrgId", // Batch per org
    },

    timeouts: {
      start: "30s",
      finish: "2m",
    },
  },
  { event: "app/activity.record" },
  async ({ events, step }) => {
    // Guard: Inngest's batchEvents config should never deliver an empty array,
    // but defend against it to avoid a Postgres error on INSERT with no values.
    if (events.length === 0) {
      log.warn("Received empty activity batch, skipping");
      return {
        success: true,
        clerkOrgId: undefined,
        batchSize: 0,
        insertedCount: 0,
        timestamp: new Date().toISOString(),
      };
    }

    const batchSize = events.length;
    // Safe after the length guard above
    const clerkOrgId = events[0].data.clerkOrgId;

    log.info("Processing activity batch", {
      batchSize,
      clerkOrgId,
      firstEventTimestamp: events[0].ts,
      lastEventTimestamp: events.at(-1)?.ts,
    });

    // Step 1: Prepare activity records
    const activityRecords = await step.run("activity.prepare-records", () => {
      return events.map((event) => {
        const { data } = event;

        return {
          clerkOrgId: data.clerkOrgId,
          category: data.category,
          action: data.action,
          entityType: data.entityType,
          entityId: data.entityId,
          // Cast metadata to preserve type safety after deserialization
          // Metadata is REQUIRED for all activities
          metadata: data.metadata as ActivityMetadata,
          relatedActivityId: data.relatedActivityId ?? null,
        };
      });
    });

    // Step 2: Batch insert activities
    const insertResult = await step.run("activity.batch-insert", async () => {
      try {
        // Use Drizzle's batch insert for optimal performance
        const result = await db
          .insert(orgUserActivities)
          .values(activityRecords)
          .returning({ id: orgUserActivities.id });

        log.info("Activity batch inserted", {
          clerkOrgId,
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
          clerkOrgId,
          batchSize,
          error: parseError(error),
        });

        throw error;
      }
    });

    return {
      success: true,
      clerkOrgId,
      batchSize,
      insertedCount: insertResult.insertedCount,
      timestamp: new Date().toISOString(),
    };
  }
);
