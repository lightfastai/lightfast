import { listIntegrationCalls } from "@db/app";
import type { TRPCRouterRecord } from "@trpc/server";
import { z } from "zod";

import { boundOrgProcedure } from "../../trpc";

const listDecisionsInput = z
  .object({
    limit: z.number().int().min(1).max(100).default(50),
  })
  .strict()
  .optional();

export const decisionsRouter = {
  list: boundOrgProcedure.input(listDecisionsInput).query(({ ctx, input }) =>
    listIntegrationCalls(ctx.db, {
      clerkOrgId: ctx.auth.identity.orgId,
      limit: input?.limit ?? 50,
    })
  ),
} satisfies TRPCRouterRecord;
