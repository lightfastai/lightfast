import { useCallback, useRef } from "react";

import type { NodePosition } from "../types";
import { useCoordinateTransform } from "./use-coordinate-transform";

interface UseDragOperationProps {
  containerRef: React.RefObject<HTMLDivElement>;
  onPositionChange: (index: number, position: NodePosition) => void;
}

export function useDragOperation({
  containerRef,
  onPositionChange,
}: UseDragOperationProps) {
  const draggedNodeRef = useRef<number | null>(null);
  const dragOffsetRef = useRef<NodePosition | null>(null);
  const { screenToContainerPosition } = useCoordinateTransform({
    containerRef,
  });

  const handleDragStart = useCallback(
    (e: React.DragEvent, index: number) => {
      draggedNodeRef.current = index;

      // Calculate and store the initial offset between cursor and node position
      const nodeElement = e.currentTarget as HTMLElement;
      const nodeRect = nodeElement.getBoundingClientRect();
      const containerPosition = screenToContainerPosition(e.clientX, e.clientY);

      if (containerPosition) {
        dragOffsetRef.current = {
          x: containerPosition.x - nodeRect.left,
          y: containerPosition.y - nodeRect.top,
        };
      }

      // Set up invisible drag image
      const dragImage = document.createElement("div");
      dragImage.style.opacity = "0";
      document.body.appendChild(dragImage);
      e.dataTransfer.setDragImage(dragImage, 0, 0);
      requestAnimationFrame(() => document.body.removeChild(dragImage));
    },
    [screenToContainerPosition],
  );

  const handleDrag = useCallback(
    (e: React.DragEvent, index: number) => {
      if (
        !e.clientX ||
        !e.clientY ||
        draggedNodeRef.current === null ||
        !dragOffsetRef.current
      )
        return;

      const containerPosition = screenToContainerPosition(e.clientX, e.clientY);
      if (!containerPosition) return;

      const newPosition = {
        x: containerPosition.x - dragOffsetRef.current.x,
        y: containerPosition.y - dragOffsetRef.current.y,
      };

      onPositionChange(index, newPosition);
    },
    [screenToContainerPosition, onPositionChange],
  );

  const handleDragEnd = useCallback(() => {
    draggedNodeRef.current = null;
    dragOffsetRef.current = null;
  }, []);

  return {
    draggedNodeRef,
    handleDragStart,
    handleDrag,
    handleDragEnd,
  };
}
