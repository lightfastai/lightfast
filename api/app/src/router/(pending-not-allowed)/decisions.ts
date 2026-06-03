import { listProviderRoutineCalls, type ProviderRoutineCall } from "@db/app";
import type { TRPCRouterRecord } from "@trpc/server";
import { z } from "zod";

import { boundOrgProcedure } from "../../trpc";
import {
  workspaceListCursorInput,
  workspaceListLimitInput,
  workspaceListSearchInput,
} from "./workspace-list-input";

// Tie the filter enums to the DB unions so a schema change there is a compile
// error here, not a silent runtime drift.
const DECISION_PROVIDERS = [
  "linear",
  "x",
] as const satisfies readonly ProviderRoutineCall["provider"][];
const DECISION_STATUSES = [
  "failed",
  "running",
  "succeeded",
] as const satisfies readonly ProviderRoutineCall["status"][];

const listDecisionsInput = z.object({
  cursor: workspaceListCursorInput,
  limit: workspaceListLimitInput,
  providers: z
    .array(z.enum(DECISION_PROVIDERS))
    .max(DECISION_PROVIDERS.length)
    .optional(),
  search: workspaceListSearchInput,
  statuses: z
    .array(z.enum(DECISION_STATUSES))
    .max(DECISION_STATUSES.length)
    .optional(),
});

export const decisionsRouter = {
  list: boundOrgProcedure.input(listDecisionsInput).query(({ ctx, input }) =>
    listProviderRoutineCalls(ctx.db, {
      clerkOrgId: ctx.auth.identity.orgId,
      cursor: input.cursor,
      limit: input.limit,
      providers: input.providers?.length ? input.providers : undefined,
      search: input.search,
      statuses: input.statuses?.length ? input.statuses : undefined,
    })
  ),
} satisfies TRPCRouterRecord;
