import { getActiveOrgBinding } from "@db/app";
import type { TRPCRouterRecord } from "@trpc/server";

import { getMatchingGitHubLightfastRepository } from "../../auth/org-setup-gate";
import { orgProcedure } from "../../trpc";

function providerLabel(provider: string) {
  return provider === "github" ? "GitHub" : provider;
}

function getLightfastRepository(
  binding: NonNullable<Awaited<ReturnType<typeof getActiveOrgBinding>>>
) {
  return getMatchingGitHubLightfastRepository(binding);
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
        accountLogin: binding.providerAccountLogin,
        connectedAt: binding.connectedAt,
        lightfastRepository: getLightfastRepository(binding),
        provider: binding.provider,
        providerLabel: providerLabel(binding.provider),
      },
      status: "bound" as const,
    };
  }),
} satisfies TRPCRouterRecord;
