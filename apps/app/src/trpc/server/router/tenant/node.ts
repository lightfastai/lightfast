import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { and, eq, exists, sql } from "@vendor/db";
import { protectedTenantProcedure } from "@vendor/trpc";

import { Node, Workspace } from "~/db/schema";
import { InsertNodeSchema } from "~/db/schema/tables/Node";
import { $Texture } from "~/db/schema/types/Texture";
import { $Txt2Img } from "~/db/schema/types/Txt2Img";
import { $Window } from "~/db/schema/types/Window";

export const nodeRouter = {
  delete: protectedTenantProcedure
    .input(
      z.object({
        id: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Delete the node
      const [deletedNode] = await ctx.db
        .delete(Node)
        .where(
          and(
            eq(Node.id, input.id),
            exists(
              ctx.db
                .select()
                .from(Workspace)
                .where(and(eq(Workspace.id, Node.workspaceId))),
            ),
          ),
        )
        .returning({
          id: Node.id,
          type: Node.type,
        });

      if (!deletedNode) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Node not found",
        });
      }

      return deletedNode;
    }),

  create: protectedTenantProcedure
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

  updatePositions: protectedTenantProcedure
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
    getAll: protectedTenantProcedure
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
    get: protectedTenantProcedure
      .input(z.object({ id: z.string() }))
      .query(async ({ ctx, input }) => {
        const [node] = await ctx.db
          .select({
            data: Node.data,
          })
          .from(Node)
          .where(and(eq(Node.id, input.id)))
          .limit(1);

        if (!node) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Node not found",
          });
        }

        return node.data;
      }),

    update: protectedTenantProcedure
      .input(
        z.object({
          id: z.string(),
          data: $Texture.or($Txt2Img).or($Window), // Allow any data updates that match the schema
        }),
      )
      .mutation(async ({ ctx, input }) => {
        // First get the existing node to verify type and get current data
        const [existingNode] = await ctx.db
          .select({
            data: Node.data,
            type: Node.type,
            workspaceId: Node.workspaceId,
          })
          .from(Node)
          .where(and(eq(Node.id, input.id)))
          .limit(1);

        if (!existingNode) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Node not found",
          });
        }

        // Update the node with new data
        const [updatedNode] = await ctx.db
          .update(Node)
          .set({
            data: input.data,
            updatedAt: sql`now()`,
          })
          .where(eq(Node.id, input.id))
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
