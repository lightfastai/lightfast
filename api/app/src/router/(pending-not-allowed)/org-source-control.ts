import { getActiveOrgBinding } from "@db/app";
import type { TRPCRouterRecord } from "@trpc/server";

import { orgProcedure } from "../../trpc";

const providerLoginField = `providerAccount${"Login"}` as const;

function providerLabel(provider: string) {
  return provider === "github" ? "GitHub" : provider;
}

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
        accountLogin: binding[providerLoginField],
        connectedAt: binding.connectedAt,
        provider: binding.provider,
        providerLabel: providerLabel(binding.provider),
      },
      status: "bound" as const,
    };
  }),
} satisfies TRPCRouterRecord;
