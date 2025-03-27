import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { UpdateNameWorkspaceSchema, Workspace } from "@dahlia/db/tenant/schema";
import { desc, eq, sql } from "@vendor/db";
import { protectedTenantProcedure } from "@vendor/trpc";

export const workspaceRouter = {
  create: protectedTenantProcedure.mutation(async ({ ctx }) => {
    const [workspace] = await ctx.tenant
      .insert(Workspace)
      .values({})
      .returning({ id: Workspace.id });

    if (!workspace) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to create workspace",
      });
    }
    return workspace;
  }),
  get: protectedTenantProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const [ownership] = await ctx.tenant
        .select({})
        .from(Workspace)
        .where(eq(Workspace.id, input.id))
        .limit(1);

      if (!ownership) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "You are not authorized to access this workspace",
        });
      }

      // Retrieve workspace details
      const [workspace] = await ctx.tenant
        .select({
          id: Workspace.id,
          name: Workspace.name,
          createdAt: Workspace.createdAt,
          updatedAt: Workspace.updatedAt,
        })
        .from(Workspace)
        .where(eq(Workspace.id, input.id));

      if (!workspace) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Workspace not found",
        });
      }

      return workspace;
    }),
  getAll: protectedTenantProcedure.query(async ({ ctx }) => {
    const workspaces = await ctx.tenant
      .select({
        id: Workspace.id,
        name: Workspace.name,
      })
      .from(Workspace)
      .orderBy(desc(Workspace.createdAt));
    return workspaces;
  }),
  updateName: protectedTenantProcedure
    .input(UpdateNameWorkspaceSchema)
    .mutation(async ({ ctx, input }) => {
      // @todo quick fix due to zod not being able to validate the id as non-null
      if (!input.id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Workspace ID is required",
        });
      }
      const { id, name } = input;
      const [workspace] = await ctx.tenant
        .update(Workspace)
        .set({ name, updatedAt: sql`now()` })
        .where(eq(Workspace.id, id))
        .returning({
          id: Workspace.id,
          name: Workspace.name,
        });

      if (!workspace) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Workspace not found",
        });
      }

      return workspace;
    }),
} satisfies TRPCRouterRecord;
