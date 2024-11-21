import { Dispatch, SetStateAction } from "react";

import {
  createDefaultGeometry,
  createDefaultMaterial,
  Geometry,
  Material,
} from "@repo/db/schema";

import { api } from "~/trpc/react";
import { NetworkEditorContext } from "../../state/context";
import { FlowNode } from "../../types/flow-nodes";

interface UseWorkspaceAddNodeProps {
  workspaceId: string;
  setNodes: Dispatch<SetStateAction<FlowNode[]>>;
}

export const useWorkspaceAddNode = ({
  workspaceId,
  setNodes,
}: UseWorkspaceAddNodeProps) => {
  const utils = api.useUtils();
  const state = NetworkEditorContext.useSelector((state) => state);

  const addNode = api.node.create.useMutation({
    onMutate: async (newNode) => {
      console.log("onMutate", newNode);
      await utils.node.getAllNodeIds.cancel({ workspaceId });

      const previousIds =
        utils.node.getAllNodeIds.getData({ workspaceId }) ?? [];

      const optimisticNode: FlowNode = {
        id: `temp-${Date.now()}`,
        type: newNode.type,
        position: newNode.position,
        data: newNode.data as Geometry | Material,
      };

      setNodes((nodes) => [...nodes, optimisticNode]);

      utils.node.getAllNodeIds.setData({ workspaceId }, [
        ...previousIds,
        optimisticNode.id,
      ]);

      utils.node.get.setData(
        { id: optimisticNode.id, workspaceId },
        optimisticNode,
      );

      return { optimisticNode, previousIds };
    },

    onSuccess: (result, variables, context) => {
      if (!context) return;

      const currentIds =
        utils.node.getAllNodeIds.getData({ workspaceId }) ?? [];

      setNodes((nodes) =>
        nodes.map((node) =>
          node.id === context.optimisticNode.id
            ? { ...node, id: result.id, data: result.data }
            : node,
        ),
      );

      utils.node.getAllNodeIds.setData(
        { workspaceId },
        currentIds.map((id) =>
          id === context.optimisticNode.id ? result.id : id,
        ),
      );

      utils.node.get.setData(
        { id: result.id, workspaceId },
        {
          ...context.optimisticNode,
          id: result.id,
          data: result.data,
        },
      );
    },

    onError: (err, newNode, context) => {
      console.log("onError", err, newNode, context);
      if (!context) return;

      setNodes((nodes) =>
        nodes.filter((node) => node.id !== context.optimisticNode.id),
      );

      utils.node.getAllNodeIds.setData({ workspaceId }, context.previousIds);
      utils.node.get.setData(
        { id: context.optimisticNode.id, workspaceId },
        undefined,
      );
    },
    onSettled: (newNode) => {
      utils.node.getAllNodeIds.invalidate({ workspaceId });
      if (!newNode) return;
      utils.node.get.invalidate({ id: newNode.id, workspaceId });
    },
  });

  const handleCanvasClick = (event: React.MouseEvent) => {
    console.log("handleCanvasClick", event);
    if (state.context.selectedGeometry) {
      console.log("adding geometry");
      addNode.mutate({
        workspaceId,
        type: "geometry",
        position: { x: event.clientX, y: event.clientY },
        data: createDefaultGeometry({
          type: state.context.selectedGeometry,
        }),
      });
    } else if (state.context.selectedMaterial) {
      console.log("adding material");
      addNode.mutate({
        workspaceId,
        type: "material",
        position: { x: event.clientX, y: event.clientY },
        data: createDefaultMaterial({
          type: state.context.selectedMaterial,
        }),
      });
    }
  };

  return { handleCanvasClick };
};
