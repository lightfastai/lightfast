import type { RefObject } from "react";
import { useState } from "react";

interface UseWorkspacePanProps {
  canvasRef: RefObject<HTMLDivElement>;
  stopPropagation: boolean;
}

export const useWorkspacePan = ({
  canvasRef,
  stopPropagation,
}: UseWorkspacePanProps) => {
  const [isPanningCanvas, setIsPanningCanvas] = useState(false);
  const [dragStartCanvas, setDragStartCanvas] = useState({ x: 0, y: 0 });

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0 && !stopPropagation) {
      setIsPanningCanvas(true);
      setDragStartCanvas({ x: e.clientX, y: e.clientY });
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (isPanningCanvas && canvasRef.current) {
      const dx = e.clientX - dragStartCanvas.x;
      const dy = e.clientY - dragStartCanvas.y;
      canvasRef.current.scrollLeft -= dx;
      canvasRef.current.scrollTop -= dy;
      setDragStartCanvas({ x: e.clientX, y: e.clientY });
    }
  };

  const handleCanvasMouseUp = () => {
    setIsPanningCanvas(false);
  };

  return {
    isPanningCanvas,
    handleCanvasMouseDown,
    handleCanvasMouseMove,
    handleCanvasMouseUp,
  };
};
