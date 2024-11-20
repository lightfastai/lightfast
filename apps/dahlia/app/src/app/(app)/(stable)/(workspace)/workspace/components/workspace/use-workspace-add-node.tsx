import type { Dispatch, SetStateAction } from "react";
import { useCallback } from "react";
import { useReactFlow } from "@xyflow/react";

import { $NodeType, createDefaultGeometry } from "@repo/db/schema";

import { api } from "~/trpc/react";
import { NetworkEditorContext } from "../../state/context";
import {
  FlowNode,
  GeometryFlowNode,
  MaterialFlowNode,
} from "../../types/flow-nodes";

interface UseWorkspaceAddNodeProps {
  setNodes: Dispatch<SetStateAction<FlowNode[]>>;
  workspaceId: string;
}

interface UseWorkspaceAddNodeReturn {
  handleCanvasClick: (event: React.MouseEvent<HTMLDivElement>) => void;
}

export function useWorkspaceAddNode({
  setNodes,
  workspaceId,
}: UseWorkspaceAddNodeProps): UseWorkspaceAddNodeReturn {
  const { screenToFlowPosition } = useReactFlow();
  const state = NetworkEditorContext.useSelector((state) => state);
  const machineRef = NetworkEditorContext.useActorRef();

  const addNode = api.node.create.useMutation({
    onError: (error) => {
      // Rollback optimistic update on error
      setNodes((nodes) => nodes.slice(0, -1));
      console.error("Failed to add node:", error);
    },
  });

  const handleCanvasClick = useCallback(
    async (event: React.MouseEvent<HTMLDivElement>) => {
      if (state.context.selectedGeometry) {
        const position = screenToFlowPosition({
          x: event.clientX,
          y: event.clientY,
        });

        // Create the node data for geometry
        const newNode: GeometryFlowNode = {
          id: `geometry-${Math.random()}`,
          position,
          type: $NodeType.Enum.geometry,
          data: createDefaultGeometry({
            type: state.context.selectedGeometry,
          }),
        };

        // Optimistically add the node to the UI
        setNodes((nds) => [...nds, newNode]);
        machineRef.send({ type: "UNSELECT_GEOMETRY" });

        try {
          // Add the node to the database
          const result = await addNode.mutateAsync({
            workspaceId,
            position: newNode.position,
            data: newNode.data,
            type: $NodeType.Enum.geometry,
          });

          // Update the node with the database ID
          setNodes((nodes) =>
            nodes.map((node) =>
              node.id === newNode.id ? { ...node, id: result.id } : node,
            ),
          );
        } catch (error) {
          // Error handling is done in onError callback
        }
      }

      if (state.context.selectedMaterial) {
        const position = screenToFlowPosition({
          x: event.clientX,
          y: event.clientY,
        });

        // Create the node data for material
        const newNode: MaterialFlowNode = {
          id: `material-${Math.random()}`,
          position,
          type: $NodeType.Enum.material,
          data: {
            type: state.context.selectedMaterial,
            color: "#ffffff", // Default color
            shouldRenderInNode: true,
          },
        };

        // Optimistically add the node to the UI
        setNodes((nds) => [...nds, newNode]);
        machineRef.send({ type: "UNSELECT_MATERIAL" });

        try {
          // Add the node to the database
          const result = await addNode.mutateAsync({
            workspaceId,
            position: newNode.position,
            data: newNode.data,
            type: "material",
          });

          // Update the node with the database ID
          setNodes((nodes) =>
            nodes.map((node) =>
              node.id === newNode.id ? { ...node, id: result.id } : node,
            ),
          );
        } catch (error) {
          // Error handling is done in onError callback
        }
      }
    },
    [
      state.context.selectedGeometry,
      state.context.selectedMaterial,
      setNodes,
      screenToFlowPosition,
      machineRef,
      workspaceId,
      addNode,
    ],
  );

  return {
    handleCanvasClick,
  };
}
