import type { Edge, Node } from "@xyflow/react";

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
 * Override BaseEdge to ensure it includes sourceHandle and targetHandle.
 * XYFlow's Edge type already includes these fields but we want to make sure they're preserved
 * when we convert from the router output.
 */
export type BaseEdge = Edge &
  RouterOutputs["tenant"]["edge"]["getAll"][number] & {
    sourceHandle?: string;
    targetHandle?: string;
  };

/**
 * We have to convert the base edge to an edge because the data is not
 * included in the base edge. If data is ever included in the base edge
 * we can remove this conversion.
 */
export const convertToBaseEdge = (
  edges: RouterOutputs["tenant"]["edge"]["getAll"],
): BaseEdge[] =>
  edges.map((edge) => ({
    ...edge,
    // Ensure sourceHandle and targetHandle are included in the converted edge
    sourceHandle: edge.sourceHandle || undefined,
    targetHandle: edge.targetHandle || undefined,
  }));
