import type { RefObject } from "react";
import { useCallback, useState } from "react";

interface UseWorkspaceZoomProps {
  canvasRef: RefObject<HTMLDivElement>;
  maxZoom: number;
  minZoom: number;
  zoomSpeed: number;
}

export const useWorkspaceZoom = ({
  canvasRef,
  maxZoom,
  minZoom,
  zoomSpeed,
}: UseWorkspaceZoomProps) => {
  const [zoom, setZoom] = useState(1);

  const handleZoom = useCallback(
    (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const canvas = canvasRef.current;
        if (canvas) {
          const rect = canvas.getBoundingClientRect();

          const mouseX = e.clientX - rect.left + canvas.scrollLeft;
          const mouseY = e.clientY - rect.top + canvas.scrollTop;

          const delta = -e.deltaY * zoomSpeed;
          setZoom((prevZoom) => {
            const newZoom = Math.min(
              maxZoom,
              Math.max(minZoom, prevZoom + delta),
            );

            const scale = newZoom / prevZoom;

            canvas.scrollLeft = mouseX * scale - (e.clientX - rect.left);
            canvas.scrollTop = mouseY * scale - (e.clientY - rect.top);

            return newZoom;
          });
        }
      }
    },
    [canvasRef, maxZoom, minZoom, zoomSpeed],
  );

  return { zoom, handleZoom };
};
