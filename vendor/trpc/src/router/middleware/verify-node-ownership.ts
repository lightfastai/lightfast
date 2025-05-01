import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { and, eq } from "@vendor/db";
import { Node, Workspace } from "@vendor/db/lightfast/schema";

import { protectedProcedure } from "../../trpc";

export const verifyNodeOwnership = protectedProcedure
  .input(z.object({ nodeId: z.string() }))
  .use(async ({ ctx, input, next }) => {
    // Get the node and its workspace
    const [node] = await ctx.db
      .select({
        id: Node.id,
        workspaceId: Node.workspaceId,
        type: Node.type,
        data: Node.data,
      })
      .from(Node)
      .where(eq(Node.id, input.nodeId))
      .limit(1);

    if (!node) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Node not found",
      });
    }

    // Verify workspace exists and user has access
    const [workspace] = await ctx.db
      .select()
      .from(Workspace)
      .where(and(eq(Workspace.id, node.workspaceId)))
      .limit(1);

    if (!workspace) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "You do not have access to this node's workspace",
      });
    }

    return next({
      ctx: {
        node,
        workspace,
      },
    });
  });
