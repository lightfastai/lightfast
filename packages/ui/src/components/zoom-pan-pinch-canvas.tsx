import type { ReactNode } from "react";
import React, { useCallback, useEffect, useRef, useState } from "react";

import { cn } from "@repo/ui/lib/utils";

import InfoCard from "./info-card";

interface ZoomPanPinchCanvasProps {
  children: (params: {
    zoom: number;
    cursorPosition: { x: number; y: number };
    gridSize: number;
  }) => ReactNode;
  debug?: boolean;
  minZoom?: number;
  maxZoom?: number;
  zoomSpeed?: number;
}

const ZoomPanPinchCanvas = ({
  children,
  debug = false,
  minZoom = 0.1,
  maxZoom = 10,
  zoomSpeed = 0.1,
}: ZoomPanPinchCanvasProps) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const gridSize = 20; // Size of each grid cell in pixels
  const [zoom, setZoom] = useState(1);
  const [isPanningCanvas, setIsPanningCanvas] = useState(false);
  const [dragStartCanvas, setDragStartCanvas] = useState({ x: 0, y: 0 });
  const [cursorPosition, setCursorPosition] = useState({ x: 0, y: 0 });

  const handleZoom = useCallback((e: WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const canvas = canvasRef.current;
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const delta = -e.deltaY * zoomSpeed;
        setZoom((prevZoom) => {
          let newZoom = prevZoom + delta;
          newZoom = Math.min(maxZoom, Math.max(minZoom, newZoom));

          const scaleFactor = newZoom / prevZoom;

          // Calculate the new scroll positions to keep the zoom centered on the mouse
          const newScrollLeft =
            (canvas.scrollLeft + mouseX) * scaleFactor - mouseX;
          const newScrollTop =
            (canvas.scrollTop + mouseY) * scaleFactor - mouseY;

          canvas.scrollLeft = newScrollLeft;
          canvas.scrollTop = newScrollTop;

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
    if (e.button === 0) {
      // Left mouse button
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
          className="h-canvas-grid w-canvas-grid origin-top-left bg-canvas-grid bg-[0_0,0_0,0_0]"
          style={{
            backgroundSize: `${gridSize}px ${gridSize}px, ${gridSize}px ${gridSize}px, ${gridSize}px ${gridSize}px`,
            transform: `scale(${zoom})`,
          }}
        >
          {children({ zoom, cursorPosition, gridSize })}
        </div>
      </div>
      {debug && (
        <div className="absolute bottom-4 right-4 z-50">
          <InfoCard
            title="Debug"
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

export default ZoomPanPinchCanvas;
