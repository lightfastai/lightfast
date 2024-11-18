import type { RefObject } from "react";
import { useState } from "react";

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
  const [cursorPosition, setCursorPosition] = useState({ x: 0, y: 0 });

  const updateCursorPosition = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (canvas) {
      let clientX: number;
      let clientY: number;

      if ("touches" in e && e.touches.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else if ("clientX" in e) {
        clientX = e.clientX;
        clientY = e.clientY;
      } else {
        return;
      }

      const rect = canvas.getBoundingClientRect();
      const x = (clientX - rect.left - panOffset.x) / zoom;
      const y = (clientY - rect.top - panOffset.y) / zoom;

      setCursorPosition({ x, y });
    }
  };

  return { cursorPosition, updateCursorPosition };
};
