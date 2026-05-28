import { listPeople } from "@db/app";
import type { TRPCRouterRecord } from "@trpc/server";
import { z } from "zod";

import { boundOrgProcedure } from "../../trpc";

const listPeopleInput = z.object({
  cursor: z
    .object({
      createdAt: z.coerce.date(),
      id: z.number().int().positive(),
    })
    .nullish(),
  limit: z.number().int().min(1).max(100).optional(),
  search: z.string().trim().min(1).max(200).optional(),
});

export const workspacePeopleRouter = {
  list: boundOrgProcedure.input(listPeopleInput).query(({ ctx, input }) =>
    listPeople(ctx.db, {
      clerkOrgId: ctx.auth.identity.orgId,
      cursor: input.cursor,
      limit: input.limit,
      search: input.search,
    })
  ),
} satisfies TRPCRouterRecord;
