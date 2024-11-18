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

      // Otherwise it's a pan gesture
      setPanOffset((prev) => ({
        x: prev.x - e.deltaX,
        y: prev.y - e.deltaY,
      }));
    },
    [stopPropagation],
  );

  return {
    isPanningCanvas,
    panOffset,
    handleWheel,
  };
};
