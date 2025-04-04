import type { Edge, Node } from "@xyflow/react";

import type { HandleId } from "@vendor/db/schema";

import type { RouterOutputs } from "~/trpc/server/index";

export type BaseNode = Node &
  RouterOutputs["tenant"]["node"]["base"]["getAll"][number];

/**
 * We have to convert the base node to a node because the data is not
 * included in the base node. If data is ever included in the base node
 * we can remove this conversion.
 */
export const convertToBaseNode = (
  nodes: RouterOutputs["tenant"]["node"]["base"]["getAll"],
): BaseNode[] =>
  nodes.map((node) => ({
    ...node,
    data: {},
  }));

/**
 * Override BaseEdge to ensure it includes sourceHandle and targetHandle with proper types.
 * XYFlow's Edge type already includes these fields but we want to make them required
 * and properly typed.
 */
export type BaseEdge = Omit<Edge, "sourceHandle" | "targetHandle"> &
  RouterOutputs["tenant"]["edge"]["getAll"][number] & {
    sourceHandle: HandleId;
    targetHandle: HandleId;
  };

/**
 * Convert router output edges to BaseEdge type with proper handle validation
 */
export const convertToBaseEdge = (
  edges: RouterOutputs["tenant"]["edge"]["getAll"],
): BaseEdge[] =>
  edges.map((edge) => ({
    ...edge,
    // Ensure sourceHandle and targetHandle are properly typed
    sourceHandle: edge.sourceHandle as HandleId,
    targetHandle: edge.targetHandle as HandleId,
  }));
