import type { Dispatch, SetStateAction } from "react";
import { useCallback } from "react";
import { useReactFlow } from "@xyflow/react";

import { NetworkEditorContext } from "../../state/context";
import {
  DEFAULT_GEOMETRY_NODE,
  FlowNode,
  GeometryFlowNode,
} from "../../types/flow-nodes";

interface UseWorkspaceAddNodeProps {
  setNodes: Dispatch<SetStateAction<FlowNode[]>>;
}

interface UseWorkspaceAddNodeReturn {
  handleCanvasClick: (event: React.MouseEvent<HTMLDivElement>) => void;
}

export function useWorkspaceAddNode({
  setNodes,
}: UseWorkspaceAddNodeProps): UseWorkspaceAddNodeReturn {
  const { screenToFlowPosition } = useReactFlow();
  const state = NetworkEditorContext.useSelector((state) => state);
  const machineRef = NetworkEditorContext.useActorRef();

  const handleCanvasClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!state.context.selectedGeometry) return;

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNode: GeometryFlowNode = {
        id: `geometry-${Math.random()}`,
        position,
        ...DEFAULT_GEOMETRY_NODE,
        data: {
          ...DEFAULT_GEOMETRY_NODE.data,
          label: state.context.selectedGeometry,
          geometry: {
            ...DEFAULT_GEOMETRY_NODE.data.geometry,
            type: state.context.selectedGeometry,
          },
        },
      };

      setNodes((nds) => [...nds, newNode]);
      machineRef.send({ type: "UNSELECT_GEOMETRY" });
    },
    [
      state.context.selectedGeometry,
      setNodes,
      screenToFlowPosition,
      machineRef,
    ],
  );

  return {
    handleCanvasClick,
  };
}
