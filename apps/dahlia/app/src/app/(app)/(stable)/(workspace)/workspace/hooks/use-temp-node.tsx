import { useCallback } from "react";
import { useReactFlow } from "@xyflow/react";

import { createGeometryNode, FlowNode } from "../types/flow-nodes";

// Define the type for prevTempNode to fix the implicit any error
type TempNode = {
  position: { x: number; y: number };
} | null;

interface UseTempNodeProps {
  onComplete?: () => void;
  setTempNode: React.Dispatch<React.SetStateAction<TempNode>>;
}

export const useTempNode = ({ onComplete, setTempNode }: UseTempNodeProps) => {
  const { screenToFlowPosition, setNodes } = useReactFlow<FlowNode>();

  const startTempNodeWorkflow = useCallback(
    (params: { type: "geometry" | "material"; preview: any }) => {
      const tempId = `temp-${Math.random()}`;
      let hasMoved = false;

      const handleMouseMove = (event: MouseEvent) => {
        hasMoved = true;
        const position = screenToFlowPosition({
          x: event.clientX,
          y: event.clientY,
        });

        setTempNode((prevTempNode) => {
          if (!prevTempNode) {
            return createTempNode(
              tempId,
              position,
              params.type,
              params.preview,
            );
          }
          return { ...prevTempNode, position };
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
          const persistentNodes = nodes.filter((node): node is FlowNode => {
            return !isTempFlowNode(node);
          });

          if (
            params.type === "geometry" &&
            params.preview.geometryType in ["box", "sphere", "plane"]
          ) {
            const geometryType = params.preview.geometryType as
              | "box"
              | "sphere"
              | "plane";
            const geometryNode = createGeometryNode(
              `geometry-${Math.random()}`,
              position,
              {
                label: geometryType,
                geometry: {
                  type: geometryType,
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

        setTempNode(null);

        cleanup();
        onComplete?.();
      };

      const cleanup = () => {
        window.removeEventListener("mousemove", handleMouseMove);
        const rfPane =
          document.querySelector<HTMLDivElement>(".react-flow__pane");
        if (rfPane) {
          rfPane.removeEventListener("click", handlePaneClick as EventListener);
        }
      };

      window.addEventListener("mousemove", handleMouseMove);
      const rfPane =
        document.querySelector<HTMLDivElement>(".react-flow__pane");
      if (rfPane) {
        rfPane.addEventListener("click", handlePaneClick as EventListener);
      }

      return cleanup;
    },
    [screenToFlowPosition, setNodes, onComplete, setTempNode],
  );

  return {
    startTempNodeWorkflow,
  };
};
