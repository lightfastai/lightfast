import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";

import {
  Edge,
  getMaxTargetEdges,
  Node,
  Workspace,
} from "@dahlia/db/tenant/schema";
import { protectedTenantProcedure } from "@vendor/trpc";

export const edgeRouter = {
  getAll: protectedTenantProcedure
    .input(z.object({ workspaceId: z.string() }))
    .query(async ({ input, ctx }) => {
      // First, verify workspace belongs to user
      const [workspace] = await ctx.tenant
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
      const nodes = await ctx.tenant
        .select()
        .from(Node)
        .where(eq(Node.workspaceId, input.workspaceId));

      const nodeIds = nodes.map((node) => node.id);

      // Get all edges where either source or target is in the workspace's nodes
      const edges = await ctx.tenant
        .select()
        .from(Edge)
        .where(
          and(inArray(Edge.source, nodeIds), inArray(Edge.target, nodeIds)),
        );

      return edges;
    }),
  create: protectedTenantProcedure
    .input(
      z.object({
        id: z.string().nanoid(),
        edge: z.object({ source: z.string(), target: z.string() }),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      return await ctx.tenant.transaction(async (tx) => {
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

        // 2. Count existing edges targeting this node
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

        // 3. Get max allowed edges for this node type
        const maxEdges = getMaxTargetEdges(targetNode.type);

        // 4. Validate edge constraint
        if (count >= maxEdges) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Node of type ${targetNode.type} cannot accept more than ${maxEdges} incoming connections`,
          });
        }

        // 5. Create the edge
        const [edge] = await tx
          .insert(Edge)
          .values({
            id: input.id,
            source: input.edge.source,
            target: input.edge.target,
          })
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
  delete: protectedTenantProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const [edge] = await ctx.tenant
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
  replace: protectedTenantProcedure
    .input(
      z.object({
        oldEdgeId: z.string(),
        newEdge: z.object({
          id: z.string().nanoid(),
          source: z.string(),
          target: z.string(),
        }),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      // Use a transaction to ensure atomicity
      return await ctx.tenant.transaction(async (tx) => {
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

        // 2. Count existing edges targeting this node
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

        // 3. Get max allowed edges for this node type
        const maxEdges = getMaxTargetEdges(targetNode.type);

        // 4. Get the old edge to check if we're targeting the same node
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

        // 5. Validate edge constraint
        // Only check the limit if we're targeting a different node
        if (oldEdge.target !== input.newEdge.target && count >= maxEdges) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Node of type ${targetNode.type} cannot accept more than ${maxEdges} incoming connections`,
          });
        }

        // 6. Delete the old edge
        await tx.delete(Edge).where(eq(Edge.id, input.oldEdgeId));

        // 7. Create the new edge
        const [newEdge] = await tx
          .insert(Edge)
          .values({
            id: input.newEdge.id,
            source: input.newEdge.source,
            target: input.newEdge.target,
          })
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
