import { useCallback, useState } from "react";

interface UseWorkspacePanProps {
  canvasRef: React.RefObject<HTMLDivElement>;
  stopPropagation: boolean;
}

export const useWorkspacePan = ({
  canvasRef,
  stopPropagation,
}: UseWorkspacePanProps) => {
  const [isPanningCanvas, setIsPanningCanvas] = useState(false);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });

  const handleWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault();
      if (stopPropagation) {
        e.stopPropagation();
      }

      // If ctrl key is pressed, it's a pinch zoom gesture
      if (e.ctrlKey) return;

      // Get the canvas and grid elements
      const canvas = canvasRef.current;
      const grid = canvas?.querySelector(".h-canvas-grid") as HTMLElement;

      if (!canvas || !grid) return;

      // Calculate the bounds
      const canvasRect = canvas.getBoundingClientRect();
      const gridRect = grid.getBoundingClientRect();

      // Calculate new potential position
      const newX = panOffset.x - e.deltaX;
      const newY = panOffset.y - e.deltaY;

      // Calculate the maximum allowed pan in each direction
      const maxX = 0; // Right bound
      const minX = canvasRect.width - gridRect.width; // Left bound
      const maxY = 0; // Bottom bound
      const minY = canvasRect.height - gridRect.height; // Top bound

      // Clamp the values within bounds
      const clampedX = Math.min(maxX, Math.max(minX, newX));
      const clampedY = Math.min(maxY, Math.max(minY, newY));

      setPanOffset({
        x: clampedX,
        y: clampedY,
      });
    },
    [stopPropagation, panOffset, canvasRef],
  );

  return {
    isPanningCanvas,
    panOffset,
    handleWheel,
  };
};
