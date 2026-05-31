import { getActiveOrgBinding } from "@db/app";
import {
  githubLightfastRepositoryProofSchema,
  LIGHTFAST_REPOSITORY_NAME,
} from "@repo/app-setup-contract";
import type { TRPCRouterRecord } from "@trpc/server";

import { orgProcedure } from "../../trpc";

function providerLabel(provider: string) {
  return provider === "github" ? "GitHub" : provider;
}

function getLightfastRepository(binding: NonNullable<
  Awaited<ReturnType<typeof getActiveOrgBinding>>
>) {
  const parsed = githubLightfastRepositoryProofSchema.safeParse(
    binding.metadata.lightfastRepository
  );

  if (!parsed.success) {
    return null;
  }

  if (
    parsed.data.fullName !==
      `${binding.providerAccountLogin}/${LIGHTFAST_REPOSITORY_NAME}` ||
    parsed.data.installationId !== binding.providerInstallationId
  ) {
    return null;
  }

  return {
    fullName: parsed.data.fullName,
    id: parsed.data.id,
    verifiedAt: new Date(parsed.data.verifiedAt),
  };
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
