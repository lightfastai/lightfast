import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { desc, eq } from "@vendor/db";
import {
  UpdateNameWorkspaceSchema,
  Workspace,
} from "@vendor/db/lightfast/schema";

import { publicProcedure } from "../../trpc";

export const workspaceRouter = {
  create: publicProcedure.mutation(async ({ ctx }) => {
    const [workspace] = await ctx.db
      .insert(Workspace)
      .values({})
      .returning({ id: Workspace.id, name: Workspace.name });

    if (!workspace) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to create workspace",
      });
    }

    return workspace;
  }),

  get: publicProcedure
    .input(z.object({ workspaceId: z.string() }))
    .query(async ({ ctx, input }) => {
      const [workspace] = await ctx.db
        .select()
        .from(Workspace)
        .where(eq(Workspace.id, input.workspaceId))
        .limit(1);

      if (!workspace) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Workspace not found",
        });
      }

      return workspace;
    }),

  getAll: publicProcedure.query(async ({ ctx }) => {
    const workspaces = await ctx.db
      .select({
        id: Workspace.id,
        name: Workspace.name,
        updatedAt: Workspace.updatedAt,
      })
      .from(Workspace)
      .orderBy(desc(Workspace.updatedAt));

    return workspaces;
  }),

  updateName: publicProcedure
    .input(UpdateNameWorkspaceSchema)
    .mutation(async ({ ctx, input }) => {
      const [workspace] = await ctx.db
        .update(Workspace)
        .set({ name: input.workspaceName })
        .where(eq(Workspace.id, input.id))
        .returning({ id: Workspace.id, name: Workspace.name });

      if (!workspace) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Workspace not found",
        });
      }

      return workspace;
    }),
} satisfies TRPCRouterRecord;
