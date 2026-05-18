import { db } from "@db/app/client";
import { orgLightfastTasks } from "@db/app/schema";
import { eq } from "drizzle-orm";

/**
 * Read the set of cleared task keys for an org. Returns a `Set` for cheap
 * O(1) `has(key)` lookups in the pure derivation step. Empty set = all
 * required tasks still pending.
 */
export async function listClearedTasks(orgId: string): Promise<Set<string>> {
  const rows = await db
    .select({ taskKey: orgLightfastTasks.taskKey })
    .from(orgLightfastTasks)
    .where(eq(orgLightfastTasks.orgId, orgId));
  return new Set(rows.map((r) => r.taskKey));
}

/**
 * Mark a task cleared for an org. Idempotent: composite PK on
 * (org_id, task_key) + ON CONFLICT DO NOTHING means concurrent or repeated
 * calls are race-free at the DB layer; `cleared_at` reflects the first
 * successful insert.
 */
export async function markTaskCleared(
  orgId: string,
  taskKey: string
): Promise<void> {
  await db
    .insert(orgLightfastTasks)
    .values({ orgId, taskKey })
    .onConflictDoNothing({
      target: [orgLightfastTasks.orgId, orgLightfastTasks.taskKey],
    });
}
