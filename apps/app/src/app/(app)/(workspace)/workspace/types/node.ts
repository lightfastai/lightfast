import type { Node } from "@xyflow/react";

import type { RouterOutputs } from "~/trpc/server/index";

export { convertToBaseEdge } from "./edge";

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
