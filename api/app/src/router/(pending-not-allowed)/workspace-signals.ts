import { listSignals } from "@db/app";
import { signalStatusSchema } from "@repo/api-contract";
import type { TRPCRouterRecord } from "@trpc/server";
import { z } from "zod";

import { boundOrgProcedure } from "../../trpc";

const listSignalsInput = z.object({
  cursor: z
    .object({
      createdAt: z.coerce.date(),
      id: z.number().int().positive(),
    })
    .nullish(),
  limit: z.number().int().min(1).max(100).optional(),
  search: z.string().trim().min(1).max(200).optional(),
  status: signalStatusSchema.optional(),
});

export const workspaceSignalsRouter = {
  list: boundOrgProcedure.input(listSignalsInput).query(({ ctx, input }) =>
    listSignals(ctx.db, {
      clerkOrgId: ctx.auth.identity.orgId,
      cursor: input.cursor,
      limit: input.limit,
      search: input.search,
      status: input.status,
    })
  ),
} satisfies TRPCRouterRecord;
