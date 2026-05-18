import type { TRPCRouterRecord } from "@trpc/server";
import { log } from "@vendor/observability/log/next";

import { LIGHTFAST_TASKS } from "../../auth/lightfast-tasks/registry";
import { markTaskCleared } from "../../auth/lightfast-tasks/repo";
import { activeIdentityProcedure } from "../../trpc";

/**
 * Lightfast Tasks Router
 *
 * Lives at `pendingNotAllowed.tasks`. Uses `activeIdentityProcedure` (the
 * explicit opt-out from the readiness gate) so users with pending readiness
 * can see the checklist and complete tasks. Every other org-scoped router
 * keeps the default `pendingNotAllowedProcedure` (identity + readiness).
 */
export const tasksRouter = {
  /**
   * Read current task state derived from auth context + registry. No DB hit
   * — `ctx.auth.readiness` was populated by the resolver on this request.
   */
  getStatus: activeIdentityProcedure.query(({ ctx }) => {
    const readiness = ctx.auth.readiness;
    const isCleared = (key: string) =>
      readiness.type === "cleared" ||
      (readiness.type === "pending" && !readiness.remaining.includes(key));
    return LIGHTFAST_TASKS.map((t) => ({
      key: t.key,
      label: t.label,
      required: t.required !== false,
      cleared: isCleared(t.key),
    }));
  }),

  /**
   * Mark `connect-github` complete. Idempotent INSERT … ON CONFLICT DO
   * NOTHING (composite PK on `(org_id, task_key)`). The very next
   * authenticated request reads the new row via `resolveReadinessFromTasks`
   * so no client-side session refresh is needed — JWT carries no readiness
   * state.
   */
  completeConnectGithub: activeIdentityProcedure.mutation(async ({ ctx }) => {
    await markTaskCleared(ctx.auth.identity.orgId, "connect-github");
    log.info("[lightfast-tasks] completed", {
      orgId: ctx.auth.identity.orgId,
      key: "connect-github",
    });
    return { ok: true };
  }),
} satisfies TRPCRouterRecord;
