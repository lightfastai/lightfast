import { type Database, isOrgBound, upsertActiveOrgBinding } from "@db/app";
import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { log } from "@vendor/observability/log/next";

import { mirrorOrgBinding } from "../../auth/org-binding-mirror";
import { env } from "../../env";
import { setupProcedure } from "../../trpc";

/**
 * Bind service — the single place that turns an org "bound".
 *
 * Write ordering keeps the DB authoritative: the binding is written first, then
 * the Clerk metadata mirror is updated for web-session routing UX. If
 * `mirrorOrgBinding` throws, the DB row still stands and API authorization can
 * resolve the org as bound; the mirror can be retried or repaired separately.
 *
 * v1 callers only pass placeholder metadata (see `task.bind`); the real GitHub
 * App installation callback will call this with concrete provider details.
 */
async function bindOrg(input: {
  db: Database;
  clerkOrgId: string;
  connectedByUserId: string;
  metadata?: Record<string, unknown>;
}): Promise<{ ok: true; bindingStatus: "bound" }> {
  // 1. Create or confirm the active DB binding (authoritative, idempotent).
  await upsertActiveOrgBinding(input.db, {
    clerkOrgId: input.clerkOrgId,
    connectedByUserId: input.connectedByUserId,
    provider: "github",
    metadata: input.metadata,
  });

  // 2. Mirror `bound` into Clerk org public metadata so the web session token
  //    can carry `lf_binding_status: "bound"` for proxy routing UX.
  await mirrorOrgBinding({
    clerkOrgId: input.clerkOrgId,
    status: "bound",
    provider: "github",
  });

  // 3. Report the resolved gate state.
  return { ok: true, bindingStatus: "bound" };
}

/**
 * Task Router — the v1 org setup surface.
 *
 * Both procedures use `setupProcedure`: an active org must reach them *before*
 * it is bound. `task.status` reports binding state for the setup UI;
 * `task.bind` is the v1 setup entry point.
 */
export const taskRouter = {
  /**
   * Reports the active org's binding state from the authoritative DB binding.
   * Callable before the org is bound.
   */
  status: setupProcedure.query(async ({ ctx }) => {
    const bound = await isOrgBound(ctx.db, ctx.auth.identity.orgId);
    return { bindingStatus: bound ? ("bound" as const) : ("unbound" as const) };
  }),

  /**
   * v1 setup entry point — binds the active org to a source-control provider.
   *
   * Until the real GitHub App installation callback exists, this only creates
   * a clearly marked *placeholder* binding, and only outside production. No
   * fake GitHub installation ids are stored — those arrive with the real flow.
   * In production the procedure refuses rather than mark an org bound without
   * a genuine provider binding.
   */
  bind: setupProcedure.mutation(async ({ ctx }) => {
    if (env.VERCEL_ENV === "production") {
      throw new TRPCError({
        code: "NOT_IMPLEMENTED",
        message:
          "Binding a source-control organization requires the GitHub App installation flow, which is not yet available.",
      });
    }

    const result = await bindOrg({
      db: ctx.db,
      clerkOrgId: ctx.auth.identity.orgId,
      connectedByUserId: ctx.auth.identity.userId,
      metadata: {
        placeholder: true,
        reason:
          "non-production bind task; awaiting GitHub App installation flow",
      },
    });

    log.info("[task] org bound", {
      clerkOrgId: ctx.auth.identity.orgId,
      userId: ctx.auth.identity.userId,
    });

    return result;
  }),
} satisfies TRPCRouterRecord;
