import { useCallback } from "react";
import { useReactFlow } from "@xyflow/react";

import {
  createGeometryNode,
  createTempNode,
  GeometryFlowNode,
  isTempFlowNode,
  TempFlowNode,
} from "../types/flow-nodes";

interface UseTempNodeProps {
  onComplete?: () => void;
  setTempNodes: React.Dispatch<React.SetStateAction<TempFlowNode[]>>;
}

export const useTempNode = ({
  onComplete,
  setTempNodes,
}: UseTempNodeProps = {}) => {
  const { screenToFlowPosition, setNodes } = useReactFlow();

  const startTempNodeWorkflow = useCallback(
    (params: { type: "geometry" | "material"; preview: any }) => {
      const tempId = `temp-${Math.random()}`;
      let hasMoved = false;

      // Setup mouse tracking
      const handleMouseMove = (event: MouseEvent) => {
        hasMoved = true;
        const position = screenToFlowPosition({
          x: event.clientX,
          y: event.clientY,
        });

        setTempNodes((prevTempNodes) => {
          const tempExists = prevTempNodes.some((node) => node.id === tempId);
          if (!tempExists) {
            const tempNode = createTempNode(
              tempId,
              position,
              params.type,
              params.preview,
            );
            return [...prevTempNodes, tempNode];
          }

          return prevTempNodes.map((node) =>
            node.id === tempId ? { ...node, position } : node,
          );
        });
      };

      const handlePaneClick = (event: MouseEvent) => {
        if (!hasMoved) {
          cleanup();
          return;
        }

        const position = screenToFlowPosition({
          x: event.clientX,
          y: event.clientY,
        });

        setNodes((nodes) => {
          const persistentNodes = nodes.filter(
            (node) => !isTempFlowNode(node),
          ) as GeometryFlowNode[];

          if (params.type === "geometry") {
            const geometryNode = createGeometryNode(
              `geometry-${Math.random()}`,
              position,
              {
                label: params.preview.geometryType,
                geometry: {
                  type: params.preview.geometryType.toLowerCase(),
                  position: { x: 0, y: 0, z: 0 },
                  scale: { x: 1, y: 1, z: 1 },
                  rotation: { x: 0, y: 0, z: 0 },
                  wireframe: false,
                  shouldRenderInNode: true,
                },
              },
            );
            return [...persistentNodes, geometryNode];
          }

          return persistentNodes;
        });

        setTempNodes((prevTempNodes) =>
          prevTempNodes.filter((node) => node.id !== tempId),
        );

        cleanup();
        onComplete?.();
      };

      const cleanup = () => {
        document.removeEventListener("mousemove", handleMouseMove);

        // Remove the click handler from the ReactFlow pane
        const rfPane = document.querySelector(".react-flow__pane");
        if (rfPane) {
          rfPane.removeEventListener("click", handlePaneClick);
        }
      };

      // Add listeners
      document.addEventListener("mousemove", handleMouseMove);

      // Add click handler to ReactFlow pane
      const rfPane = document.querySelector(".react-flow__pane");
      if (rfPane) {
        rfPane.addEventListener("click", handlePaneClick);
      }

      return cleanup;
    },
    [screenToFlowPosition, setNodes, onComplete, setTempNodes],
  );

  return { startTempNodeWorkflow };
};
