import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { and, eq, sql } from "@vendor/db";
import { InsertNodeSchema, Node, Workspace } from "@vendor/db/lightfast/schema";
import { $Texture, $Txt2Img, $Window } from "@vendor/db/lightfast/types";

import { protectedProcedure } from "../../trpc";
import { verifyNodeOwnership } from "../middleware/verify-node-ownership";

export const nodeRouter = {
  delete: verifyNodeOwnership.mutation(async ({ ctx }) => {
    // Node ownership is already verified, we can safely delete
    const [deletedNode] = await ctx.db
      .delete(Node)
      .where(eq(Node.id, ctx.node.id))
      .returning({
        id: Node.id,
        type: Node.type,
      });

    return deletedNode;
  }),

  create: protectedProcedure
    .input(InsertNodeSchema)
    .mutation(async ({ ctx, input }) => {
      // Verify workspace ownership first
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

      const [node] = await ctx.db
        .insert(Node)
        .values({
          id: input.id,
          workspaceId: input.workspaceId,
          type: input.type,
          position: input.position,
          data: input.data,
        })
        .returning({
          id: Node.id,
          type: Node.type,
          position: Node.position,
          data: Node.data,
        });

      if (!node) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to add node",
        });
      }

      return node;
    }),

  updatePositions: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string(),
        nodes: z.array(
          z.object({
            id: z.string(),
            position: z.object({
              x: z.number(),
              y: z.number(),
            }),
          }),
        ),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify workspace ownership
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

      // Update each node's position
      const updates = input.nodes.map((node) =>
        ctx.db
          .update(Node)
          .set({
            position: node.position,
            updatedAt: sql`now()`,
          })
          .where(
            and(eq(Node.id, node.id), eq(Node.workspaceId, input.workspaceId)),
          )
          .returning({
            id: Node.id,
            position: Node.position,
          }),
      );

      const updatedNodes = await Promise.all(updates);
      return updatedNodes.flat();
    }),

  base: {
    getAll: protectedProcedure
      .input(z.object({ workspaceId: z.string() }))
      .query(async ({ ctx, input }) => {
        const nodes = await ctx.db
          .select({
            id: Node.id,
            type: Node.type,
            position: Node.position,
          })
          .from(Node)
          .where(and(eq(Node.workspaceId, input.workspaceId)))
          .orderBy(Node.createdAt);
        return nodes;
      }),
  },

  data: {
    get: verifyNodeOwnership.query(({ ctx }) => {
      // Node is already verified and available in ctx.node
      return ctx.node.data;
    }),

    update: verifyNodeOwnership
      .input(
        z.object({
          data: $Texture.or($Txt2Img).or($Window),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        // Node is already verified, merge the new data with existing data
        const updatedData = {
          ...ctx.node.data,
          ...input.data,
        };

        // Update the node with new data
        const [updatedNode] = await ctx.db
          .update(Node)
          .set({
            data: updatedData,
            updatedAt: sql`now()`,
          })
          .where(eq(Node.id, ctx.node.id))
          .returning({
            data: Node.data,
          });

        if (!updatedNode) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to update node",
          });
        }

        return updatedNode.data;
      }),
  },
} satisfies TRPCRouterRecord;
