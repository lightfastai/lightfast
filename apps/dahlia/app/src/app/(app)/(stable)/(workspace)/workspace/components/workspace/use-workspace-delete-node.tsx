import type { Edge } from "@xyflow/react";
import { useCallback } from "react";
import { getConnectedEdges, getIncomers, getOutgoers } from "@xyflow/react";

import type { FlowNode } from "../../types/flow-nodes";
import { api } from "~/trpc/react";

interface UseWorkspaceDeleteNodeProps {
  workspaceId: string;
  nodes: FlowNode[];
  edges: Edge[];
  setNodes: React.Dispatch<React.SetStateAction<FlowNode[]>>;
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>;
}

export function useWorkspaceDeleteNode({
  workspaceId,
  nodes,
  edges,
  setNodes,
  setEdges,
}: UseWorkspaceDeleteNodeProps) {
  const deleteNode = api.node.delete.useMutation({
    onError: (error) => {
      console.error("Failed to delete node:", error);
      // Revert the optimistic update
      setNodes((nodes) => {
        // We should store the deleted node somewhere before deletion
        // For now, we'll just log the error
        console.error("Unable to revert node deletion - implement backup");
        return nodes;
      });
    },
  });

  const onNodesDelete = useCallback(
    (deleted: FlowNode[]) => {
      // Handle reconnecting edges when nodes are deleted
      setEdges((eds) => {
        return deleted.reduce((acc, node) => {
          const incomers = getIncomers(node, nodes, edges);
          const outgoers = getOutgoers(node, nodes, edges);
          const connectedEdges = getConnectedEdges([node], edges);

          const remainingEdges = acc.filter(
            (edge) => !connectedEdges.includes(edge),
          );

          const createdEdges = incomers.flatMap(({ id: source }) =>
            outgoers.map(({ id: target }) => ({
              id: `${source}->${target}`,
              source,
              target,
            })),
          );

          return [...remainingEdges, ...createdEdges];
        }, eds);
      });

      // Delete nodes from the database
      deleted.forEach((node) => {
        deleteNode.mutate({
          id: node.id,
          workspaceId,
        });
      });
    },
    [nodes, edges, workspaceId, deleteNode, setEdges],
  );

  return {
    onNodesDelete,
  };
}
