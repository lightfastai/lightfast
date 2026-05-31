import { getPersonByPublicId, listPeople } from "@db/app";
import {
  peopleIdentityProviderSchema,
  peopleIdentityTypeSchema,
} from "@repo/app-validation/schemas";
import { TRPCError, type TRPCRouterRecord } from "@trpc/server";
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
  providers: z.array(peopleIdentityProviderSchema).max(5).optional(),
  search: workspaceListSearchInput,
  types: z.array(peopleIdentityTypeSchema).max(3).optional(),
});

export const workspacePeopleRouter = {
  list: boundOrgProcedure.input(listPeopleInput).query(({ ctx, input }) =>
    listPeople(ctx.db, {
      clerkOrgId: ctx.auth.identity.orgId,
      cursor: input.cursor,
      limit: input.limit,
      providers: input.providers?.length ? input.providers : undefined,
      search: input.search,
      types: input.types?.length ? input.types : undefined,
    })
  ),
  get: boundOrgProcedure
    .input(z.object({ publicId: z.string().trim().min(1) }))
    .query(async ({ ctx, input }) => {
      const person = await getPersonByPublicId(ctx.db, {
        clerkOrgId: ctx.auth.identity.orgId,
        publicId: input.publicId,
      });

      if (!person) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Person not found" });
      }

      return person;
    }),
} satisfies TRPCRouterRecord;
