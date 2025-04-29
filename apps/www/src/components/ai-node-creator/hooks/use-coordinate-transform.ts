import { useCallback } from "react";

import type { XYPosition } from "../types";

interface UseCoordinateTransformProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
}

export function useCoordinateTransform({
  containerRef,
}: UseCoordinateTransformProps) {
  const screenToContainerPosition = useCallback(
    (screenX: number, screenY: number): XYPosition | null => {
      if (!containerRef.current) return null;

      const containerRect = containerRef.current.getBoundingClientRect();
      return {
        x: screenX - containerRect.left,
        y: screenY - containerRect.top,
      };
    },
    [containerRef],
  );

  const containerToScreenPosition = useCallback(
    (containerX: number, containerY: number): XYPosition | null => {
      if (!containerRef.current) return null;

      const containerRect = containerRef.current.getBoundingClientRect();
      return {
        x: containerX + containerRect.left,
        y: containerY + containerRect.top,
      };
    },
    [containerRef],
  );

  return {
    screenToContainerPosition,
    containerToScreenPosition,
  };
}
