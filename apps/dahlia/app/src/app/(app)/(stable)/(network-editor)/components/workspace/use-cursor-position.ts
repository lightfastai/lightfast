import type { RefObject } from "react";
import { useState } from "react";

interface UseCursorPositionProps {
  canvasRef: RefObject<HTMLDivElement>;
  zoom: number;
  gridSize: number;
}

export const useCursorPosition = ({
  canvasRef,
  zoom,
  gridSize,
}: UseCursorPositionProps) => {
  const [cursorPosition, setCursorPosition] = useState({ x: 0, y: 0 });

  const updateCursorPosition = (e: React.MouseEvent) => {
    if (canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const canvas = canvasRef.current;

      const x = (e.clientX - rect.left + canvas.scrollLeft) / zoom;
      const y = (e.clientY - rect.top + canvas.scrollTop) / zoom;

      const snappedX = Math.floor(x / gridSize) * gridSize;
      const snappedY = Math.floor(y / gridSize) * gridSize;

      setCursorPosition({ x: snappedX, y: snappedY });
    }
  };

  return { cursorPosition, updateCursorPosition };
};
