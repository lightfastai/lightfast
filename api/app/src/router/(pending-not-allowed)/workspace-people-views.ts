import { createPeopleView, deletePeopleView, listPeopleViews } from "@db/app";
import {
  peopleIdentityProviderSchema,
  peopleIdentityTypeSchema,
} from "@repo/app-validation/schemas";
import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { boundOrgProcedure } from "../../trpc";

const peopleViewConfigSchema = z.object({
  filters: z.object({
    providers: z.array(peopleIdentityProviderSchema).max(5),
    types: z.array(peopleIdentityTypeSchema).max(3),
  }),
});

const createPeopleViewInput = z.object({
  name: z.string().trim().min(1).max(120),
  config: peopleViewConfigSchema,
});

const deletePeopleViewInput = z.object({
  publicId: z.string().min(1).max(64),
});

export const workspacePeopleViewsRouter = {
  list: boundOrgProcedure.query(({ ctx }) =>
    listPeopleViews(ctx.db, {
      clerkOrgId: ctx.auth.identity.orgId,
      createdByUserId: ctx.auth.identity.userId,
    })
  ),
  create: boundOrgProcedure
    .input(createPeopleViewInput)
    .mutation(({ ctx, input }) =>
      createPeopleView(ctx.db, {
        clerkOrgId: ctx.auth.identity.orgId,
        createdByUserId: ctx.auth.identity.userId,
        name: input.name,
        config: input.config,
      })
    ),
  delete: boundOrgProcedure
    .input(deletePeopleViewInput)
    .mutation(async ({ ctx, input }) => {
      const deleted = await deletePeopleView(ctx.db, {
        clerkOrgId: ctx.auth.identity.orgId,
        createdByUserId: ctx.auth.identity.userId,
        publicId: input.publicId,
      });
      if (!deleted) {
        throw new TRPCError({ code: "NOT_FOUND", message: "View not found" });
      }
      return { success: true };
    }),
} satisfies TRPCRouterRecord;
