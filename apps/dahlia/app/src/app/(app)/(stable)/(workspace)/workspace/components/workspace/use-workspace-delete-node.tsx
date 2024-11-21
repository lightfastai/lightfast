import { Edge } from "@xyflow/react";

import { api } from "~/trpc/react";
import { FlowNode } from "../../types/flow-nodes";

interface UseWorkspaceDeleteNodeProps {
  workspaceId: string;
  edges: Edge[];
  setEdges: (edges: Edge[] | ((edges: Edge[]) => Edge[])) => void;
  utils: ReturnType<typeof api.useUtils>;
}

export const useWorkspaceDeleteNode = ({
  workspaceId,
  edges,
  setEdges,
  utils,
}: UseWorkspaceDeleteNodeProps) => {
  const deleteNode = api.node.delete.useMutation({
    onSuccess: () => {
      utils.node.getAllNodeIds.invalidate({ workspaceId });
    },
  });

  const onNodesDelete = (nodesToDelete: FlowNode[]) => {
    const nodeIds = nodesToDelete.map((node) => node.id);

    // Remove connected edges
    setEdges(
      edges.filter(
        (edge) =>
          !nodeIds.includes(edge.source) && !nodeIds.includes(edge.target),
      ),
    );

    // Delete nodes
    nodeIds.forEach((id) => {
      deleteNode.mutate({ id, workspaceId });
    });
  };

  return { onNodesDelete };
};
