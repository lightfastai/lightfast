import { listSignals } from "@db/app";
import { signalStatusSchema } from "@repo/api-contract";
import type { TRPCRouterRecord } from "@trpc/server";
import { z } from "zod";

import { boundOrgProcedure } from "../../trpc";
import {
  workspaceListCursorInput,
  workspaceListLimitInput,
  workspaceListSearchInput,
} from "./workspace-list-input";

const listSignalsInput = z.object({
  cursor: workspaceListCursorInput,
  limit: workspaceListLimitInput,
  search: workspaceListSearchInput,
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
