import type { ReactNode } from "react";
import React, { useCallback, useEffect, useRef, useState } from "react";

import { InfoCard } from "@repo/ui/components/info-card";
import { cn } from "@repo/ui/lib/utils";

import { GRID_SIZE, MAX_ZOOM, MIN_ZOOM, ZOOM_SPEED } from "./_defaults";
import { SelectionBox } from "./selection-box";
import { CursorPosition } from "./types";
import { useCursorPosition } from "./use-cursor-position";
import { useWorkspacePan } from "./use-workspace-pan";
import { useWorkspaceSelectionBox } from "./use-workspace-selection-box";
import { useWorkspaceZoom } from "./use-workspace-zoom";
import { WorkspaceConnections } from "./workspace-connections";
import { WorkspaceNodeWrapper } from "./workspace-node-wrapper";

interface Connection {
  sourceId: string;
  sourcePos: { x: number; y: number };
  targetId: string;
  targetPos: { x: number; y: number };
}

interface ConnectionInProgress {
  sourceId: string;
  sourcePos: { x: number; y: number };
}

interface WorkspaceRenderHelpers {
  zoom: number;
  cursorPosition: CursorPosition;
  gridSize: number;
  setStopPropagation: React.Dispatch<React.SetStateAction<boolean>>;
  isSelecting: boolean;
  renderNode: (params: {
    id: number;
    x: number;
    y: number;
    isSelected: boolean;
    onClick?: (e: React.MouseEvent) => void;
    children: ReactNode;
  }) => ReactNode;
}

interface WorkspaceProps {
  children: (helpers: WorkspaceRenderHelpers) => ReactNode;
  connections: Connection[];
  connectionInProgress?: ConnectionInProgress;
  onSelect?: (start: CursorPosition, end: CursorPosition, zoom: number) => void;
  debug?: boolean;
  maxZoom?: number;
  minZoom?: number;
  zoomSpeed?: number;
  gridSize?: number;
}

export const Workspace = ({
  children,
  connections,
  connectionInProgress,
  onSelect,
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

  const { isPanningCanvas, panOffset, handleWheel } = useWorkspacePan({
    canvasRef,
    stopPropagation,
  });

  const { exactPosition, updateCursorPosition, snappedPosition } =
    useCursorPosition({
      canvasRef,
      zoom,
      gridSize,
      panOffset,
    });

  const {
    isSelecting,
    selectionStart,
    selectionEnd,
    handleMouseMove,
    handleMouseDown,
    handleMouseUp,
  } = useWorkspaceSelectionBox({
    onSelect,
    exactPosition,
  });

  const renderNode = useCallback(
    ({
      id,
      x,
      y,
      isSelected,
      onClick,
      children,
    }: {
      id: number;
      x: number;
      y: number;
      isSelected: boolean;
      onClick?: (e: React.MouseEvent) => void;
      children: ReactNode;
    }) => (
      <WorkspaceNodeWrapper
        key={id}
        id={String(id)}
        x={x}
        y={y}
        isSelected={isSelected}
        onMouseEnter={() => setStopPropagation(true)}
        onMouseLeave={() => setStopPropagation(false)}
        onClick={onClick}
      >
        {children}
      </WorkspaceNodeWrapper>
    ),
    [setStopPropagation],
  );

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
          handleMouseMove();
        }}
        onMouseDown={handleMouseDown}
        onMouseUp={() => handleMouseUp(zoom)}
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
            cursorPosition: snappedPosition,
            gridSize,
            setStopPropagation,
            isSelecting,
            renderNode,
          })}

          <WorkspaceConnections
            cursorPosition={snappedPosition}
            connections={connections}
            connectionInProgress={connectionInProgress}
          />

          {isSelecting && (
            <SelectionBox
              className="z-[5]"
              startX={selectionStart.x}
              startY={selectionStart.y}
              endX={selectionEnd.x}
              endY={selectionEnd.y}
            />
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
                label: "exact",
                value: `${exactPosition.x}, ${exactPosition.y}`,
              },
              {
                label: "snapped",
                value: `${snappedPosition.x}, ${snappedPosition.y}`,
              },
            ]}
          />
        </div>
      )}
    </div>
  );
};
