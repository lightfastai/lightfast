import { useCallback } from "react";
import { NodeChange } from "@xyflow/react";

import { RouterInputs } from "@repo/api";

import { useDebounce } from "~/hooks/use-debounce";
import { api } from "~/trpc/react";
import { useNodeStore } from "../providers/node-store-provider";
import { BaseNode } from "../types/node";

interface UseGetWorkspaceNodesProps {
  workspaceId: RouterInputs["tenant"]["workspace"]["get"]["id"];
}

export const useUpdateNodes = ({ workspaceId }: UseGetWorkspaceNodesProps) => {
  const { nodes, onNodesChange } = useNodeStore((state) => state);
  const updateNodePositions = api.tenant.node.updatePositions.useMutation();

  const updatePositions = useCallback(
    (nodes: BaseNode[]) => {
      const nodePositions = nodes.map((node) => ({
        id: node.id,
        position: node.position,
      }));

      updateNodePositions.mutate({
        workspaceId,
        nodes: nodePositions,
      });
    },
    [workspaceId, updateNodePositions],
  );

  const debouncedUpdatePositions = useDebounce(updatePositions, 500);

  const handleNodesChange = useCallback(
    (changes: NodeChange<BaseNode>[]) => {
      onNodesChange(changes);

      const hasPositionChanges = changes.some(
        (change): change is NodeChange<BaseNode> & { type: "position" } =>
          change.type === "position",
      );

      if (hasPositionChanges) {
        debouncedUpdatePositions(nodes);
      }
    },
    [nodes, debouncedUpdatePositions, onNodesChange],
  );

  return {
    nodes,
    onNodesChange: handleNodesChange,
  };
};
