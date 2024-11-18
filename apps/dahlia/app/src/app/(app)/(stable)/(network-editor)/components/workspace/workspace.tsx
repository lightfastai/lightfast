import type { ReactNode } from "react";
import React, { useEffect, useRef, useState } from "react";

import { InfoCard } from "@repo/ui/components/info-card";
import { cn } from "@repo/ui/lib/utils";

import { GRID_SIZE, MAX_ZOOM, MIN_ZOOM, ZOOM_SPEED } from "./_defaults";
import { SelectionBox } from "./selection-box";
import { useCursorPosition } from "./use-cursor-position";
import { useWorkspacePan } from "./use-workspace-pan";
import { useWorkspaceZoom } from "./use-workspace-zoom";

interface WorkspaceProps {
  children: (params: {
    zoom: number;
    cursorPosition: { x: number; y: number };
    gridSize: number;
    setStopPropagation: React.Dispatch<React.SetStateAction<boolean>>;
    isSelecting: boolean;
    selectionStart: { x: number; y: number };
    selectionEnd: { x: number; y: number };
  }) => ReactNode;
  onSelect?: (
    start: { x: number; y: number },
    end: { x: number; y: number },
    zoom: number,
  ) => void;
  debug?: boolean;
  maxZoom?: number;
  minZoom?: number;
  zoomSpeed?: number;
  gridSize?: number;
}

export const Workspace = ({
  children,
  onSelect,
  debug = false,
  maxZoom = MAX_ZOOM,
  minZoom = MIN_ZOOM,
  zoomSpeed = ZOOM_SPEED,
  gridSize = GRID_SIZE,
}: WorkspaceProps) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [stopPropagation, setStopPropagation] = useState(false);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState({ x: 0, y: 0 });
  const [selectionEnd, setSelectionEnd] = useState({ x: 0, y: 0 });

  const { zoom, handleZoom } = useWorkspaceZoom({
    canvasRef,
    maxZoom,
    minZoom,
    zoomSpeed,
  });

  const { isPanningCanvas, panOffset, handleWheel } = useWorkspacePan({
    canvasRef,
    stopPropagation,
  });

  const { cursorPosition, updateCursorPosition } = useCursorPosition({
    canvasRef,
    zoom,
    gridSize,
    panOffset,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      // Handle both zoom and pan with wheel events
      const handleWheelEvent = (e: WheelEvent) => {
        if (e.ctrlKey) {
          // Pinch zoom
          handleZoom(e);
        } else {
          // Pan
          handleWheel(e);
        }
      };

      canvas.addEventListener("wheel", handleWheelEvent, { passive: false });
      return () => canvas.removeEventListener("wheel", handleWheelEvent);
    }
  }, [handleZoom, handleWheel]);

  return (
    <div className="relative h-full w-full">
      <div
        ref={canvasRef}
        className={cn("relative h-full w-full select-none overflow-hidden")}
        onMouseMove={(e) => {
          updateCursorPosition(e);
          if (isSelecting) {
            setSelectionEnd(cursorPosition);
          }
        }}
        onMouseDown={(e) => {
          if (e.button === 0) {
            setIsSelecting(true);
            setSelectionStart(cursorPosition);
            setSelectionEnd(cursorPosition);
          }
        }}
        onMouseUp={(e) => {
          if (isSelecting) {
            onSelect?.(selectionStart, selectionEnd, zoom);
            setIsSelecting(false);
          }
        }}
        style={{
          WebkitUserSelect: "none",
        }}
      >
        <div
          className="h-canvas-grid w-canvas-grid origin-top-left"
          style={{
            backgroundSize: `${gridSize}px ${gridSize}px, ${gridSize}px ${gridSize}px, ${gridSize}px ${gridSize}px`,
            transform: `translate3d(${panOffset.x}px, ${panOffset.y}px, 0) scale(${zoom})`,
            backgroundImage:
              "radial-gradient(circle, hsl(var(--workspace-grid-dot)) 1px, transparent 1px), linear-gradient(to right, hsl(var(--workspace-grid-line)) 1px, transparent 1px), linear-gradient(to bottom, hsl(var(--workspace-grid-line)) 1px, transparent 1px)",
            willChange: "transform",
          }}
        >
          {children({
            zoom,
            cursorPosition,
            gridSize,
            setStopPropagation,
            isSelecting,
            selectionStart,
            selectionEnd,
          })}

          {isSelecting && (
            <div style={{ position: "relative", zIndex: 5 }}>
              <SelectionBox
                startX={selectionStart.x}
                startY={selectionStart.y}
                endX={selectionEnd.x}
                endY={selectionEnd.y}
              />
            </div>
          )}
        </div>
      </div>
      {debug && (
        <div className="absolute bottom-4 right-4 z-50">
          <InfoCard
            title="Workspace Info"
            items={[
              { label: "gridSize", value: gridSize },
              { label: "panning", value: isPanningCanvas.toString() },
              { label: "zoom", value: zoom.toFixed(2) },
              {
                label: "panOffset",
                value: `${panOffset.x.toFixed(0)}, ${panOffset.y.toFixed(0)}`,
              },
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
