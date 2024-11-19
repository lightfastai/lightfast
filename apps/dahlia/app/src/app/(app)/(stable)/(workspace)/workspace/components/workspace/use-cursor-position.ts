import type { RefObject } from "react";
import { useState } from "react";

import { CursorPosition } from "./types";

interface UseCursorPositionProps {
  canvasRef: RefObject<HTMLDivElement>;
  zoom: number;
  gridSize: number;
  panOffset: { x: number; y: number };
}

export const useCursorPosition = ({
  canvasRef,
  zoom,
  gridSize,
  panOffset,
}: UseCursorPositionProps) => {
  const [exactPosition, setExactPosition] = useState<CursorPosition>({
    x: 0,
    y: 0,
  });
  const [snappedPosition, setSnappedPosition] = useState<CursorPosition>({
    x: 0,
    y: 0,
  });

  const updateCursorPosition = (e: React.MouseEvent) => {
    if (canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const canvas = canvasRef.current;

      const x =
        (e.clientX - rect.left + canvas.scrollLeft) / zoom - panOffset.x / zoom;
      const y =
        (e.clientY - rect.top + canvas.scrollTop) / zoom - panOffset.y / zoom;

      // Store exact position
      setExactPosition({ x, y });

      // Calculate and store snapped position
      const snappedX = Math.floor(x / gridSize) * gridSize;
      const snappedY = Math.floor(y / gridSize) * gridSize;
      setSnappedPosition({ x: snappedX, y: snappedY });
    }
  };

  return {
    exactPosition,
    snappedPosition,
    updateCursorPosition,
  };
};
