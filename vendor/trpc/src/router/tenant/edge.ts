import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";

import type { NodeType } from "@vendor/db/lightfast/types";
import {
  Edge,
  Node,
  validateEdgeHandles,
  Workspace,
} from "@vendor/db/lightfast/schema";
import {
  $InputHandleId,
  $OutputHandleId,
  getMaxTargetEdges,
} from "@vendor/db/lightfast/types";

import { protectedProcedure } from "../../trpc";

export const edgeRouter = {
  getAll: protectedProcedure
    .input(z.object({ workspaceId: z.string() }))
    .query(async ({ input, ctx }) => {
      // First, verify workspace belongs to user
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

      // Get all nodes in the workspace
      const nodes = await ctx.db
        .select()
        .from(Node)
        .where(eq(Node.workspaceId, input.workspaceId));

      const nodeIds = nodes.map((node) => node.id);

      // Get all edges where either source or target is in the workspace's nodes
      const edges = await ctx.db
        .select()
        .from(Edge)
        .where(
          and(inArray(Edge.source, nodeIds), inArray(Edge.target, nodeIds)),
        );

      return edges;
    }),
  create: protectedProcedure
    .input(
      z.object({
        id: z.string().nanoid(),
        edge: z.object({
          source: z.string(),
          target: z.string(),
          sourceHandle: $OutputHandleId,
          targetHandle: $InputHandleId,
        }),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      return await ctx.db.transaction(async (tx) => {
        // 1. Get the target node and validate it exists
        const [targetNode] = await tx
          .select()
          .from(Node)
          .where(eq(Node.id, input.edge.target))
          .limit(1);

        if (!targetNode) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Target node not found",
          });
        }

        // 2. Validate handle types
        if (
          !validateEdgeHandles({
            sourceHandle: input.edge.sourceHandle,
            targetHandle: input.edge.targetHandle,
          })
        ) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "Invalid connection: source must be an output handle and target must be a texture handle",
          });
        }

        // 3. For multi-input nodes with targetHandle, check if that specific handle already has a connection
        const [existingEdge] = await tx
          .select()
          .from(Edge)
          .where(
            and(
              eq(Edge.target, input.edge.target),
              eq(Edge.targetHandle, input.edge.targetHandle),
            ),
          )
          .limit(1);

        if (existingEdge) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `This input handle already has a connection`,
          });
        }

        // 4. Count existing edges targeting this node
        const [edgeCount] = await tx
          .select({ count: sql<number>`count(*)` })
          .from(Edge)
          .where(eq(Edge.target, input.edge.target));

        if (!edgeCount) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to count edges",
          });
        }

        const { count } = edgeCount;

        // 5. Get max allowed edges for this node type
        const maxEdges = getMaxTargetEdges(
          targetNode.type as NodeType,
          targetNode.data,
        );

        // 6. Validate edge constraint
        if (count >= maxEdges) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Node of type ${targetNode.type} cannot accept more than ${maxEdges} incoming connections`,
          });
        }

        // 7. Create the edge
        const [edge] = await tx
          .insert(Edge)
          .values({
            id: input.id,
            source: input.edge.source,
            target: input.edge.target,
            sourceHandle: input.edge.sourceHandle as string,
            targetHandle: input.edge.targetHandle as string,
          } as typeof Edge.$inferInsert)
          .returning();

        if (!edge) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to add edge",
          });
        }

        return edge;
      });
    }),
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const [edge] = await ctx.db
        .delete(Edge)
        .where(eq(Edge.id, input.id))
        .returning({ id: Edge.id });

      if (!edge) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Edge not found",
        });
      }

      return edge;
    }),
  replace: protectedProcedure
    .input(
      z.object({
        oldEdgeId: z.string(),
        newEdge: z.object({
          id: z.string().nanoid(),
          source: z.string(),
          target: z.string(),
          sourceHandle: $OutputHandleId,
          targetHandle: $InputHandleId,
        }),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      return await ctx.db.transaction(async (tx) => {
        // 1. Get the target node and validate it exists
        const [targetNode] = await tx
          .select()
          .from(Node)
          .where(eq(Node.id, input.newEdge.target))
          .limit(1);

        if (!targetNode) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Target node not found",
          });
        }

        // 2. Validate handle types
        if (
          !validateEdgeHandles({
            sourceHandle: input.newEdge.sourceHandle,
            targetHandle: input.newEdge.targetHandle,
          })
        ) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "Invalid connection: source must be an output handle and target must be a texture handle",
          });
        }

        // 3. Get the old edge to check if we're targeting the same node
        const [oldEdge] = await tx
          .select()
          .from(Edge)
          .where(eq(Edge.id, input.oldEdgeId));

        if (!oldEdge) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Old edge not found",
          });
        }

        // 4. For multi-input nodes with targetHandle, check if that specific handle already has a connection
        // that isn't the one being replaced
        const [existingEdge] = await tx
          .select()
          .from(Edge)
          .where(
            and(
              eq(Edge.target, input.newEdge.target),
              eq(Edge.targetHandle, input.newEdge.targetHandle),
              sql`${Edge.id} != ${input.oldEdgeId}`, // Don't count the edge we're replacing
            ),
          )
          .limit(1);

        if (existingEdge) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `This input handle already has a connection`,
          });
        }

        // 5. For nodes without specific handles, count existing edges
        const [edgeCount] = await tx
          .select({ count: sql<number>`count(*)` })
          .from(Edge)
          .where(eq(Edge.target, input.newEdge.target));

        if (!edgeCount) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to count edges",
          });
        }

        const { count } = edgeCount;

        // 6. Get max allowed edges for this node type
        const maxEdges = getMaxTargetEdges(
          targetNode.type as NodeType,
          targetNode.data,
        );

        // Only check the limit if we're targeting a different node
        if (oldEdge.target !== input.newEdge.target && count >= maxEdges) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Node of type ${targetNode.type} cannot accept more than ${maxEdges} incoming connections`,
          });
        }

        // 7. Delete the old edge
        await tx.delete(Edge).where(eq(Edge.id, input.oldEdgeId));

        // 8. Create the new edge
        const [newEdge] = await tx
          .insert(Edge)
          .values({
            id: input.newEdge.id,
            source: input.newEdge.source,
            target: input.newEdge.target,
            sourceHandle: input.newEdge.sourceHandle as string,
            targetHandle: input.newEdge.targetHandle as string,
          } as typeof Edge.$inferInsert)
          .returning();

        if (!newEdge) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create new edge",
          });
        }

        return newEdge;
      });
    }),
} satisfies TRPCRouterRecord;
