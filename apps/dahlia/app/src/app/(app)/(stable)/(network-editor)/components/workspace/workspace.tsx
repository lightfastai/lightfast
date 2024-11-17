import type { ReactNode } from "react";
import React, { useEffect, useRef, useState } from "react";

import { InfoCard } from "@repo/ui/components/info-card";
import { cn } from "@repo/ui/lib/utils";

import { GRID_SIZE, MAX_ZOOM, MIN_ZOOM, ZOOM_SPEED } from "./_defaults";
import { useCursorPosition } from "./use-cursor-position";
import { useWorkspacePan } from "./use-workspace-pan";
import { useWorkspaceZoom } from "./use-workspace-zoom";

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
  const [stopPropagation, setStopPropagation] = useState(false);

  const { zoom, handleZoom } = useWorkspaceZoom({
    canvasRef,
    maxZoom,
    minZoom,
    zoomSpeed,
  });

  const {
    isPanningCanvas,
    handleCanvasMouseDown,
    handleCanvasMouseMove,
    handleCanvasMouseUp,
  } = useWorkspacePan({
    canvasRef,
    stopPropagation,
  });

  const { cursorPosition, updateCursorPosition } = useCursorPosition({
    canvasRef,
    zoom,
    gridSize,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.addEventListener("wheel", handleZoom, { passive: false });
      return () => canvas.removeEventListener("wheel", handleZoom);
    }
  }, [handleZoom]);

  const handleMouseMove = (e: React.MouseEvent) => {
    handleCanvasMouseMove(e);
    updateCursorPosition(e);
  };

  return (
    <div className="relative h-full w-full">
      <div
        ref={canvasRef}
        className={cn(
          "relative h-full w-full cursor-grab overflow-hidden active:cursor-grabbing",
        )}
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleMouseMove}
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
