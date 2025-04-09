import type { NodeChange } from "@xyflow/react";
import { useCallback } from "react";
import { useMutation } from "@tanstack/react-query";

import type { BaseNode } from "../types/node";
import type { RouterInputs } from "~/trpc/server/index";
import { useDebounce } from "~/hooks/use-debounce";
import { useTRPC } from "~/trpc/client/react";
import { useNodeStore } from "../providers/node-store-provider";

interface UseGetWorkspaceNodesProps {
  workspaceId: RouterInputs["tenant"]["workspace"]["get"]["id"];
}

export const useUpdateNodes = ({ workspaceId }: UseGetWorkspaceNodesProps) => {
  const { nodes, onNodesChange } = useNodeStore((state) => state);
  const trpc = useTRPC();
  const updateNodePositions = useMutation(
    trpc.tenant.node.updatePositions.mutationOptions(),
  );

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
