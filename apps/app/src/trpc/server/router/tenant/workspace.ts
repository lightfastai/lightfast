import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { desc, eq, sql } from "@vendor/db";
import { UpdateNameWorkspaceSchema, User, Workspace } from "@vendor/db/schema";
import { protectedProcedure } from "@vendor/trpc";

export const workspaceRouter = {
  create: protectedProcedure.mutation(async ({ ctx }) => {
    // First get the user's internal ID
    const [user] = await ctx.db
      .select()
      .from(User)
      .where(eq(User.clerkId, ctx.session.user.clerkId))
      .limit(1);

    if (!user) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "User not found",
      });
    }

    const [workspace] = await ctx.db
      .insert(Workspace)
      .values({
        userId: user.id,
      })
      .returning({ id: Workspace.id });

    if (!workspace) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to create workspace",
      });
    }

    return workspace;
  }),
  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const [ownership] = await ctx.db
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
      const [workspace] = await ctx.db
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
  getAll: protectedProcedure.query(async ({ ctx }) => {
    const workspaces = await ctx.db
      .select({
        id: Workspace.id,
        name: Workspace.name,
      })
      .from(Workspace)
      .orderBy(desc(Workspace.createdAt));
    return workspaces;
  }),
  updateName: protectedProcedure
    .input(UpdateNameWorkspaceSchema)
    .mutation(async ({ ctx, input }) => {
      // @todo quick fix due to zod not being able to validate the id as non-null
      if (!input.id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Workspace ID is required",
        });
      }
      const { id, workspaceName: name } = input;
      const [workspace] = await ctx.db
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
