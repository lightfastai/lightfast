import type { ReactNode } from "react";
import React, { useCallback, useEffect, useRef, useState } from "react";

import { InfoCard } from "@repo/ui/components/info-card";
import { cn } from "@repo/ui/lib/utils";

import { GRID_SIZE, MAX_ZOOM, MIN_ZOOM, ZOOM_SPEED } from "./_defaults";

interface WorkspaceProps {
  children: (params: {
    zoom: number;
    cursorPosition: { x: number; y: number };
    gridSize: number;
    setStopPropagation: React.Dispatch<React.SetStateAction<boolean>>;
  }) => ReactNode;
  debug?: boolean;
  maxZoom?: number;
  minZoom?: number;
  zoomSpeed?: number;
  gridSize?: number;
}

export const Workspace = ({
  children,
  debug = false,
  maxZoom = MAX_ZOOM,
  minZoom = MIN_ZOOM,
  zoomSpeed = ZOOM_SPEED,
  gridSize = GRID_SIZE,
}: WorkspaceProps) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [isPanningCanvas, setIsPanningCanvas] = useState(false);
  const [dragStartCanvas, setDragStartCanvas] = useState({ x: 0, y: 0 });
  const [cursorPosition, setCursorPosition] = useState({ x: 0, y: 0 });
  const [stopPropagation, setStopPropagation] = useState(false); // Add this state

  const handleZoom = useCallback((e: WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const canvas = canvasRef.current;
      if (canvas) {
        const rect = canvas.getBoundingClientRect();

        // Calculate mouse position relative to the canvas content
        const mouseX = e.clientX - rect.left + canvas.scrollLeft;
        const mouseY = e.clientY - rect.top + canvas.scrollTop;

        const delta = -e.deltaY * zoomSpeed;
        setZoom((prevZoom) => {
          const newZoom = Math.min(
            maxZoom,
            Math.max(minZoom, prevZoom + delta),
          );

          // Calculate how the content will scale
          const scale = newZoom / prevZoom;

          // Calculate new scroll position to keep mouse point fixed
          canvas.scrollLeft = mouseX * scale - (e.clientX - rect.left);
          canvas.scrollTop = mouseY * scale - (e.clientY - rect.top);

          return newZoom;
        });
      }
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.addEventListener("wheel", handleZoom, { passive: false });
      return () => canvas.removeEventListener("wheel", handleZoom);
    }
  }, [handleZoom]);

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0 && !stopPropagation) {
      // Check disablePanning
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

    // Update cursor position (snapped to grid)
    if (canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const canvas = canvasRef.current;

      // Calculate cursor position relative to the canvas, accounting for scroll and zoom
      const x = (e.clientX - rect.left + canvas.scrollLeft) / zoom;
      const y = (e.clientY - rect.top + canvas.scrollTop) / zoom;

      // Snap to grid
      const snappedX = Math.floor(x / gridSize) * gridSize;
      const snappedY = Math.floor(y / gridSize) * gridSize;

      setCursorPosition({ x: snappedX, y: snappedY });
    }
  };

  const handleCanvasMouseUp = () => {
    setIsPanningCanvas(false);
  };

  return (
    <div className="relative h-full w-full">
      <div
        ref={canvasRef}
        className={cn(
          "relative h-full w-full cursor-grab overflow-hidden active:cursor-grabbing",
        )}
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleCanvasMouseMove}
        onMouseUp={handleCanvasMouseUp}
      >
        <div
          className="h-canvas-grid w-canvas-grid origin-top-left"
          style={{
            backgroundSize: `${gridSize}px ${gridSize}px, ${gridSize}px ${gridSize}px, ${gridSize}px ${gridSize}px`,
            transform: `scale(${zoom})`,
            backgroundImage:
              // This CSS background image creates a grid pattern on the canvas.
              // The grid consists of three layers:
              // 1. A radial gradient for the grid dots, using the --workspace-grid-dot color variable.
              // 2. A linear gradient for the vertical grid lines, using the --workspace-grid-line color variable.
              // 3. A linear gradient for the horizontal grid lines, also using the --workspace-grid-line color variable.
              "radial-gradient(circle, hsl(var(--workspace-grid-dot)) 1px, transparent 1px), linear-gradient(to right, hsl(var(--workspace-grid-line)) 1px, transparent 1px), linear-gradient(to bottom, hsl(var(--workspace-grid-line)) 1px, transparent 1px)",
          }}
        >
          {children({
            zoom,
            cursorPosition,
            gridSize,
            setStopPropagation,
          })}
        </div>
      </div>
      {debug && (
        <div className="absolute bottom-4 right-4 z-50">
          <InfoCard
            title="Workspace Info"
            items={[
              { label: "gridSize", value: gridSize },
              {
                label: "panning",
                value: isPanningCanvas.toString(),
              },
              { label: "zoom", value: zoom.toFixed(2) },
              {
                label: "cursor",
                value: `${cursorPosition.x}, ${cursorPosition.y}`,
              },
            ]}
          />
        </div>
      )}
    </div>
  );
};
