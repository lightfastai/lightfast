import type { RefObject } from "react";
import { useRef, useState } from "react";

interface UseWorkspacePanProps {
  canvasRef: RefObject<HTMLDivElement>;
  stopPropagation: boolean;
}

export const useWorkspacePan = ({
  canvasRef,
  stopPropagation,
}: UseWorkspacePanProps) => {
  const [isPanningCanvas, setIsPanningCanvas] = useState(false);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const lastPositionRef = useRef<{ x: number; y: number } | null>(null);

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (stopPropagation) return;
    setIsPanningCanvas(true);
    lastPositionRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (!isPanningCanvas || stopPropagation) return;
    const dx = e.clientX - lastPositionRef.current.x;
    const dy = e.clientY - lastPositionRef.current.y;
    setPanOffset((prev) => ({
      x: prev.x + dx,
      y: prev.y + dy,
    }));
    lastPositionRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleCanvasMouseUp = () => {
    setIsPanningCanvas(false);
    lastPositionRef.current = null;
  };

  // Touch event handlers
  const handleCanvasTouchStart = (e: React.TouchEvent) => {
    if (stopPropagation) return;
    setIsPanningCanvas(true);
    const touch = e.touches[0];
    if (touch) {
      lastPositionRef.current = { x: touch.clientX, y: touch.clientY };
    }
  };

  const handleCanvasTouchMove = (e: React.TouchEvent) => {
    if (!isPanningCanvas || stopPropagation) return;
    if (lastPositionRef.current) {
      const touch = e.touches[0];
      const dx = touch.clientX - lastPositionRef.current.x;
      const dy = touch.clientY - lastPositionRef.current.y;
      setPanOffset((prev) => ({
        x: prev.x + dx,
        y: prev.y + dy,
      }));
      lastPositionRef.current = { x: touch.clientX, y: touch.clientY };
    }
  };

  const handleCanvasTouchEnd = () => {
    setIsPanningCanvas(false);
    lastPositionRef.current = null;
  };

  return {
    isPanningCanvas,
    panOffset,
    handleCanvasMouseDown,
    handleCanvasMouseMove,
    handleCanvasMouseUp,
    handleCanvasTouchStart,
    handleCanvasTouchMove,
    handleCanvasTouchEnd,
  };
};
