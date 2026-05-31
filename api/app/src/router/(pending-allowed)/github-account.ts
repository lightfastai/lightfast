import { githubUserAccountReturnToSchema } from "@repo/github-app-contract";
import type { TRPCRouterRecord } from "@trpc/server";
import { z } from "zod";

import {
  disconnectGitHubUserAccount,
  getGitHubUserAccountStatus,
  startGitHubUserAccountBinding,
} from "../../services/github";
import { viewerProcedure } from "../../trpc";

const startGitHubUserAccountBindingInput = z.object({
  returnTo: githubUserAccountReturnToSchema.optional(),
});

export const githubAccountRouter = {
  status: viewerProcedure.query(({ ctx }) =>
    getGitHubUserAccountStatus({
      clerkUserId: ctx.auth.identity.userId,
    })
  ),
  start: viewerProcedure
    .input(startGitHubUserAccountBindingInput)
    .mutation(({ ctx, input }) =>
      startGitHubUserAccountBinding({
        lightfastUserId: ctx.auth.identity.userId,
        returnTo: input.returnTo,
      })
    ),
  sync: viewerProcedure.mutation(({ ctx }) =>
    getGitHubUserAccountStatus({
      clerkUserId: ctx.auth.identity.userId,
    })
  ),
  disconnect: viewerProcedure.mutation(({ ctx }) =>
    disconnectGitHubUserAccount({
      clerkUserId: ctx.auth.identity.userId,
    })
  ),
} satisfies TRPCRouterRecord;
