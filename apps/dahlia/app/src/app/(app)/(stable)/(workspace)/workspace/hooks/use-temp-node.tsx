import { useCallback } from "react";
import { useReactFlow } from "@xyflow/react";

import {
  createGeometryNode,
  createTempNode,
  FlowNode,
  isTempFlowNode,
  TempFlowNode,
} from "../types/flow-nodes";

interface UseTempNodeProps {
  onComplete?: () => void;
  setTempNodes: React.Dispatch<React.SetStateAction<TempFlowNode[]>>;
}

interface DraggedItem {
  type: "geometry" | "material";
  preview: {
    geometryType: "box" | "sphere" | "plane";
    [key: string]: any;
  };
}

export const useTempNode = ({ onComplete, setTempNodes }: UseTempNodeProps) => {
  const { screenToFlowPosition, setNodes } = useReactFlow<FlowNode>();

  const handleDragOver = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
    },
    [],
  );

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();

      try {
        const draggedItem: DraggedItem = JSON.parse(
          event.dataTransfer.getData("application/json"),
        );

        const position = screenToFlowPosition({
          x: event.clientX,
          y: event.clientY,
        });

        setNodes((nodes) => {
          const persistentNodes = nodes.filter((node): node is FlowNode => {
            return !isTempFlowNode(node);
          });

          if (draggedItem.type === "geometry") {
            const geometryNode = createGeometryNode(
              `geometry-${Math.random()}`,
              position,
              {
                label: draggedItem.preview.geometryType,
                geometry: {
                  type: draggedItem.preview.geometryType,
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

        onComplete?.();
      } catch (error) {
        console.error("Error processing dropped item:", error);
      }
    },
    [screenToFlowPosition, setNodes, onComplete],
  );

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

        setTempNodes((prevTempNodes) =>
          prevTempNodes.filter((node) => node.id !== tempId),
        );

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
    [screenToFlowPosition, setNodes, onComplete, setTempNodes],
  );

  return {
    startTempNodeWorkflow,
    handleDragOver,
    handleDrop,
  };
};
