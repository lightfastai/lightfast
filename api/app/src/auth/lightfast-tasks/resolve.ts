import type { AuthReadiness } from "../readiness/types";
import { deriveReadiness } from "../readiness/types";
import { LIGHTFAST_REQUIRED_TASK_KEYS } from "./registry";
import { listClearedTasks } from "./repo";

/**
 * Lightfast-tasks implementation of the readiness primitive.
 *
 * Reads the org's cleared-task rows from `org_lightfast_tasks` and diffs
 * against the required-keys list in the registry. Pure data flow:
 *   orgId → cleared set → readiness.
 *
 * Source of truth is the DB — no JWT claim is consulted. Cost per call is
 * a single PK-indexed SELECT on a small table; cache only if measurement
 * demands it.
 */
export async function resolveReadinessFromTasks(
  orgId: string
): Promise<AuthReadiness> {
  const cleared = await listClearedTasks(orgId);
  return deriveReadiness(LIGHTFAST_REQUIRED_TASK_KEYS, cleared);
}
