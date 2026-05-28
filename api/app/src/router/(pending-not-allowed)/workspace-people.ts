import { listPeople } from "@db/app";
import type { TRPCRouterRecord } from "@trpc/server";
import { z } from "zod";

import { boundOrgProcedure } from "../../trpc";
import {
  workspaceListCursorInput,
  workspaceListLimitInput,
  workspaceListSearchInput,
} from "./workspace-list-input";

const listPeopleInput = z.object({
  cursor: workspaceListCursorInput,
  limit: workspaceListLimitInput,
  search: workspaceListSearchInput,
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
