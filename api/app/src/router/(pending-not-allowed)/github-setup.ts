import { clerkOrgSlugSchema } from "@repo/app-validation";
import { githubBindStartOutputSchema } from "@repo/github-app-contract";
import { buildGitHubInstallationUrl } from "@repo/github-app-node";
import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  getOrgAccessBySlug,
  isOrgAccessError,
} from "../../auth/organization-access";
import { getGitHubAppConfig } from "../../services/github/config";
import { issueGitHubInstallAttempt } from "../../services/github/setup/attempts";
import { syncGitHubBindingClaim } from "../../services/github/setup/flow";
import { orgAdminProcedure, setupProcedure } from "../../trpc";

export const githubSetupRouter = {
  start: orgAdminProcedure
    .input(z.object({ orgSlug: clerkOrgSlugSchema }))
    .output(githubBindStartOutputSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const orgAccess = await getOrgAccessBySlug({
          db: ctx.db,
          slug: input.orgSlug,
          userId: ctx.auth.identity.userId,
        });

        if (
          orgAccess.org.id !== ctx.auth.identity.orgId ||
          orgAccess.role !== "org:admin"
        ) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Only organization administrators can start GitHub setup.",
          });
        }

        const config = getGitHubAppConfig();
        const issued = await issueGitHubInstallAttempt({
          clerkOrgId: orgAccess.org.id,
          lightfastUserId: ctx.auth.identity.userId,
          orgSlug: orgAccess.org.slug,
        });

        return {
          installationUrl: buildGitHubInstallationUrl({
            appSlug: config.appSlug,
            state: issued.state,
            webBaseUrl: config.endpoints.webBaseUrl,
          }),
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        if (isOrgAccessError(error)) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Organization not found",
            cause: error,
          });
        }
        throw error;
      }
    }),

  syncBindingClaim: setupProcedure.mutation(async ({ ctx }) =>
    syncGitHubBindingClaim({ clerkOrgId: ctx.auth.identity.orgId })
  ),
} satisfies TRPCRouterRecord;
