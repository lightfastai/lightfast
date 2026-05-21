import { isOrgBound, upsertActiveOrgBinding } from "@db/app";
import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { log } from "@vendor/observability/log/next";

import { mirrorOrgBinding } from "../../auth/org-binding-mirror";
import { env } from "../../env";
import { setupProcedure } from "../../trpc";

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

    // Keep the DB authoritative: the binding is written first, then the Clerk
    // metadata mirror is updated for web-session routing UX.
    await upsertActiveOrgBinding(ctx.db, {
      clerkOrgId: ctx.auth.identity.orgId,
      connectedByUserId: ctx.auth.identity.userId,
      provider: "github",
      metadata: {
        placeholder: true,
        reason:
          "non-production bind task; awaiting GitHub App installation flow",
      },
    });

    await mirrorOrgBinding({
      clerkOrgId: ctx.auth.identity.orgId,
      status: "bound",
      provider: "github",
    });

    log.info("[task] org bound", {
      clerkOrgId: ctx.auth.identity.orgId,
      userId: ctx.auth.identity.userId,
    });

    return { ok: true, bindingStatus: "bound" as const };
  }),
} satisfies TRPCRouterRecord;
