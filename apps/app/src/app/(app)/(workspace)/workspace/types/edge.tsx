import type { Edge } from "@xyflow/react";

import type { InputHandleId, OutputHandleId } from "@vendor/db/types";

import type { RouterOutputs } from "~/trpc/server/index";

/**
 * Override BaseEdge to ensure it includes sourceHandle and targetHandle with proper types.
 * XYFlow's Edge type already includes these fields but we want to make them required
 * and properly typed.
 */
export type BaseEdge = Omit<Edge, "sourceHandle" | "targetHandle"> &
  RouterOutputs["tenant"]["edge"]["getAll"][number] & {
    sourceHandle: OutputHandleId;
    targetHandle: InputHandleId;
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
    sourceHandle: edge.sourceHandle as OutputHandleId,
    targetHandle: edge.targetHandle as InputHandleId,
  }));
