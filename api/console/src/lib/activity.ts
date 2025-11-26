/**
 * Activity Recording Helper Functions
 *
 * Three-tier recording strategy for workspace user activities:
 *
 * Tier 1 (Synchronous) - recordCriticalActivity()
 *   - For critical operations requiring immediate persistence
 *   - Examples: auth events, permission changes, API key operations
 *   - Impact: +10-30ms latency, 0% data loss
 *
 * Tier 2 (Queue-based) - recordActivity()
 *   - For user-initiated actions with guaranteed delivery
 *   - Examples: workspace edits, integration changes, job restarts
 *   - Impact: +20-50ms latency (event send), 0% data loss
 *   - Processing: Batched by Inngest (up to 100 events, 10s timeout)
 *
 * Tier 3 (Fire-and-forget) - recordSystemActivity()
 *   - For high-volume system events
 *   - Examples: search queries, document processing, webhook deliveries
 *   - Impact: <1ms latency, ~1% data loss acceptable
 *
 * @see /docs/implementation/user-activity-tracking.md
 */

import { db } from "@db/console/client";
import { workspaceUserActivities } from "@db/console/schema";
import { inngest } from "../inngest/client/client";
import { nanoid } from "@repo/lib";
import { log } from "@vendor/observability/log";
import type {
  ActivityCategory,
  ActorType,
  InsertActivity,
  ActivityMetadataMap,
} from "@repo/console-validation";

/**
 * Type-safe activity data interface with discriminated union on action
 *
 * Use this to ensure metadata matches the action type at compile time.
 *
 * @example
 * ```typescript
 * const data: ActivityData<"workspace.created"> = {
 *   workspaceId: "ws_123",
 *   actorType: "user",
 *   category: "workspace",
 *   action: "workspace.created",
 *   entityType: "workspace",
 *   entityId: "ws_123",
 *   metadata: {
 *     workspaceName: "My Workspace",
 *     workspaceSlug: "my-workspace",
 *     clerkOrgId: "org_123",
 *   },
 * };
 * ```
 */
export interface ActivityData<T extends keyof ActivityMetadataMap> {
  /** Workspace ID */
  workspaceId: string;
  /** Actor type (user, system, webhook, api) */
  actorType: ActorType;
  /** Actor user ID (required if actorType is 'user') */
  actorUserId?: string;
  /** Actor email (optional, denormalized for privacy) */
  actorEmail?: string;
  /** Activity category */
  category: ActivityCategory;
  /** Action performed */
  action: T;
  /** Entity type */
  entityType: string;
  /** Entity ID */
  entityId: string;
  /** Strongly-typed metadata based on action */
  metadata: ActivityMetadataMap[T];
  /** Related activity ID (for grouping) */
  relatedActivityId?: string;
}

/**
 * Tier 1: Record Critical Activity (Synchronous)
 *
 * For operations requiring immediate persistence with 0% data loss.
 * Writes directly to database in the request lifecycle.
 *
 * **Use for:**
 * - Authentication events (login, logout, 2FA)
 * - Permission changes (role assignments, access grants)
 * - API key operations (create, revoke)
 * - Critical workspace changes (deletion, transfer)
 *
 * **Performance:**
 * - Adds 10-30ms to request latency
 * - Guarantees persistence before response
 * - No data loss risk
 *
 * @example
 * ```typescript
 * await recordCriticalActivity({
 *   workspaceId: ctx.session.workspaceId,
 *   actorType: "user",
 *   actorUserId: ctx.session.userId,
 *   category: "workspace",
 *   action: "workspace.created",
 *   entityType: "workspace",
 *   entityId: workspace.id,
 *   metadata: {
 *     workspaceName: workspace.name,
 *     workspaceSlug: workspace.slug,
 *     clerkOrgId: workspace.clerkOrgId,
 *   },
 * });
 * ```
 */
export async function recordCriticalActivity<T extends keyof ActivityMetadataMap>(
  data: ActivityData<T>
): Promise<{ success: true; activityId: string } | { success: false; error: string }> {
  try {
    const [result] = await db.insert(workspaceUserActivities).values({
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
    }).returning({ id: workspaceUserActivities.id });

    log.info("Critical activity recorded", {
      activityId: result?.id,
      workspaceId: data.workspaceId,
      category: data.category,
      action: data.action,
    });

    return { success: true, activityId: result?.id ?? "" };
  } catch (error) {
    log.error("Failed to record critical activity", {
      workspaceId: data.workspaceId,
      category: data.category,
      action: data.action,
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Tier 2: Record Activity (Queue-based)
 *
 * For user-initiated actions with guaranteed delivery via Inngest batching.
 * Events are batched per workspace for efficient database writes.
 *
 * **Use for:**
 * - Workspace edits (name, settings)
 * - Integration changes (connect, disconnect, configure)
 * - Job operations (restart, cancel)
 * - Store management (create, delete)
 * - Search queries (user-initiated)
 *
 * **Performance:**
 * - Adds 20-50ms to send event
 * - Batched by Inngest (up to 100 events, 10s timeout)
 * - 50-100x faster than individual inserts
 * - No data loss risk
 *
 * @example
 * ```typescript
 * await recordActivity({
 *   workspaceId: ctx.session.workspaceId,
 *   actorType: "user",
 *   actorUserId: ctx.session.userId,
 *   category: "workspace",
 *   action: "workspace.updated",
 *   entityType: "workspace",
 *   entityId: workspaceId,
 *   metadata: {
 *     changes: {
 *       name: { from: "Old Name", to: "New Name" },
 *     },
 *   },
 * });
 * ```
 */
export async function recordActivity<T extends keyof ActivityMetadataMap>(
  data: ActivityData<T>
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    await inngest.send({
      name: "apps-console/activity.record",
      data: {
        workspaceId: data.workspaceId,
        actorType: data.actorType,
        actorUserId: data.actorUserId,
        actorEmail: data.actorEmail,
        category: data.category,
        action: data.action,
        entityType: data.entityType,
        entityId: data.entityId,
        metadata: data.metadata,
        relatedActivityId: data.relatedActivityId,
        timestamp: new Date().toISOString(),
      },
    });

    log.debug("Activity event sent", {
      workspaceId: data.workspaceId,
      category: data.category,
      action: data.action,
    });

    return { success: true };
  } catch (error) {
    log.error("Failed to send activity event", {
      workspaceId: data.workspaceId,
      category: data.category,
      action: data.action,
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Tier 3: Record System Activity (Fire-and-forget)
 *
 * For high-volume system events where ~1% data loss is acceptable.
 * Sends event without awaiting confirmation for minimal latency impact.
 *
 * **Use for:**
 * - Document processing events
 * - Webhook deliveries (GitHub, Linear)
 * - System background jobs
 * - High-frequency search queries
 * - Metrics collection
 *
 * **Performance:**
 * - <1ms latency impact
 * - No blocking
 * - ~1% data loss acceptable (network failures, etc.)
 *
 * @example
 * ```typescript
 * recordSystemActivity({
 *   workspaceId: workspaceId,
 *   actorType: "system",
 *   category: "job",
 *   action: "job.cancelled",
 *   entityType: "job",
 *   entityId: jobId,
 *   metadata: {
 *     jobName: "sync-github-repo",
 *     previousStatus: "running",
 *     inngestFunctionId: "github-sync",
 *   },
 * });
 * ```
 */
export function recordSystemActivity<T extends keyof ActivityMetadataMap>(
  data: ActivityData<T>
): void {
  // Fire-and-forget: don't await, don't block
  inngest
    .send({
      name: "apps-console/activity.record",
      data: {
        workspaceId: data.workspaceId,
        actorType: data.actorType,
        actorUserId: data.actorUserId,
        actorEmail: data.actorEmail,
        category: data.category,
        action: data.action,
        entityType: data.entityType,
        entityId: data.entityId,
        metadata: data.metadata,
        relatedActivityId: data.relatedActivityId,
        timestamp: new Date().toISOString(),
      },
    })
    .catch((error) => {
      // Log error but don't throw (fire-and-forget)
      log.warn("System activity event failed (fire-and-forget)", {
        workspaceId: data.workspaceId,
        category: data.category,
        action: data.action,
        error: error instanceof Error ? error.message : String(error),
      });
    });
}

/**
 * Batch Record Activities (Internal Use)
 *
 * For internal batch operations where you already have multiple activities prepared.
 * Directly inserts into database without going through Inngest.
 *
 * **Use for:**
 * - Data migrations
 * - Bulk imports
 * - Admin operations
 *
 * @internal
 */
export async function batchRecordActivities(
  activities: InsertActivity[]
): Promise<{ success: boolean; insertedCount: number; error?: string }> {
  try {
    const result = await db
      .insert(workspaceUserActivities)
      .values(activities)
      .returning({ id: workspaceUserActivities.id });

    log.info("Batch activities recorded", {
      insertedCount: result.length,
      requestedCount: activities.length,
    });

    return {
      success: true,
      insertedCount: result.length,
    };
  } catch (error) {
    log.error("Failed to batch record activities", {
      count: activities.length,
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      success: false,
      insertedCount: 0,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
