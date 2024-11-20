"use client";

import { useEffect, useState } from "react";
import { useReactFlow, useStore } from "@xyflow/react";
import { Circle, Square, Triangle } from "lucide-react";

interface PendingGeometryPreviewProps {
  geometryType: string | null;
}

interface Position {
  x: number;
  y: number;
}

export const PendingGeometryPreview = ({
  geometryType,
}: PendingGeometryPreviewProps) => {
  const [position, setPosition] = useState<Position>({ x: 0, y: 0 });
  const { screenToFlowPosition } = useReactFlow();

  // Get the current zoom level from the store
  const zoom = useStore((state) => state.transform[2]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      // Convert screen coordinates to flow coordinates
      const flowPosition = screenToFlowPosition({
        x: e.clientX,
        y: e.clientY,
      });

      setPosition(flowPosition);
    };

    if (geometryType) {
      window.addEventListener("mousemove", handleMouseMove);
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, [geometryType, screenToFlowPosition]);

  if (!geometryType) return null;

  const getGeometryIcon = () => {
    switch (geometryType.toLowerCase()) {
      case "box":
        return <Square className="h-6 w-6" />;
      case "sphere":
        return <Circle className="h-6 w-6" />;
      case "plane":
        return <Triangle className="h-6 w-6" />;
      default:
        return null;
    }
  };

  // Scale the preview size based on zoom level
  const previewSize = 96 / zoom; // 96px is our base size (24 * 4)

  return (
    <div
      className="pointer-events-none absolute z-50 flex items-center justify-center rounded-lg border border-dashed border-gray-400 bg-white/10 backdrop-blur-sm"
      style={{
        left: position.x,
        top: position.y,
        width: previewSize,
        height: previewSize,
        transform: `translate(-50%, -50%) scale(${zoom})`,
        // transformOrigin: "center center",
      }}
    >
      <div className="flex flex-col items-center gap-2 text-gray-600">
        {getGeometryIcon()}
        <span className="text-xs font-medium">{geometryType}</span>
      </div>
    </div>
  );
};
