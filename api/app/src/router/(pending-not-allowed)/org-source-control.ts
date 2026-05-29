import { getActiveOrgBinding } from "@db/app";
import type { TRPCRouterRecord } from "@trpc/server";

import { orgProcedure } from "../../trpc";

export const orgSourceControlRouter = {
  get: orgProcedure.query(async ({ ctx }) => {
    const binding = await getActiveOrgBinding(ctx.db, ctx.auth.identity.orgId);

    if (!binding) {
      return {
        binding: null,
        status: "unbound" as const,
      };
    }

    return {
      binding: {
        connectedAt: binding.connectedAt,
        connectedByUserId: binding.connectedByUserId,
        provider: binding.provider,
        providerAccountId: binding.providerAccountId,
        providerAccountLogin: binding.providerAccountLogin,
        providerInstallationId: binding.providerInstallationId,
        status: binding.status,
      },
      status: "bound" as const,
    };
  }),
} satisfies TRPCRouterRecord;
