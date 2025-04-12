import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";

import { desc, eq, sql } from "@vendor/db";
import { UpdateNameWorkspaceSchema, User, Workspace } from "@vendor/db/schema";
import { protectedProcedure } from "@vendor/trpc";

import { verifyWorkspaceOwnership } from "../middleware/verify-workspace-ownership";

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

  get: verifyWorkspaceOwnership.query(({ ctx }) => {
    // Workspace details are already verified and available in ctx.workspace
    return {
      id: ctx.workspace.id,
      name: ctx.workspace.name,
      createdAt: ctx.workspace.createdAt,
      updatedAt: ctx.workspace.updatedAt,
    };
  }),

  getAll: protectedProcedure.query(async ({ ctx }) => {
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

    const workspaces = await ctx.db
      .select({
        id: Workspace.id,
        name: Workspace.name,
      })
      .from(Workspace)
      .where(eq(Workspace.userId, user.id))
      .orderBy(desc(Workspace.createdAt));

    return workspaces;
  }),

  updateName: verifyWorkspaceOwnership
    .input(UpdateNameWorkspaceSchema)
    .mutation(async ({ ctx, input }) => {
      const [workspace] = await ctx.db
        .update(Workspace)
        .set({ name: input.workspaceName, updatedAt: sql`now()` })
        .where(eq(Workspace.id, input.id))
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
