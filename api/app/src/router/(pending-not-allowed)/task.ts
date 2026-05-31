import { orgSetupGateSchema } from "@repo/app-setup-contract";
import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";

import { resolveOrgSetupGate } from "../../auth/org-setup-gate";
import { setupProcedure } from "../../trpc";

/**
 * Task Router — the v1 org setup surface.
 *
 * Both procedures use `setupProcedure`: an active org must reach them *before*
 * it is bound. `task.status` reports the canonical setup gate for the setup UI.
 * `task.bind` remains as a fail-closed compatibility stub for old clients; real
 * setup is owned by `org.setup.github`.
 */
export const taskRouter = {
  /**
   * Reports the active org's setup gate from the authoritative DB binding.
   * Callable before the org is bound.
   */
  status: setupProcedure.output(orgSetupGateSchema).query(async ({ ctx }) =>
    resolveOrgSetupGate({
      db: ctx.db,
      clerkOrgId: ctx.auth.identity.orgId,
    })
  ),

  /**
   * Legacy placeholder bind endpoint. It must not write a fake binding now that
   * the canonical setup gate requires both GitHub org and .lightfast proof.
   */
  bind: setupProcedure.mutation(() => {
    throw new TRPCError({
      code: "NOT_IMPLEMENTED",
      message: "Use the GitHub setup flow to connect a source-control org.",
    });
  }),
} satisfies TRPCRouterRecord;
