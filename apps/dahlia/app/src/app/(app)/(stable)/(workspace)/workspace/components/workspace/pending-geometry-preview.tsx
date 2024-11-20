"use client";

import { useStore } from "@xyflow/react";
import { Circle, Square, Triangle } from "lucide-react";

interface PendingGeometryPreviewProps {
  geometryType: string | null;
  position: { x: number; y: number } | null;
}

export const PendingGeometryPreview = ({
  geometryType,
  position,
}: PendingGeometryPreviewProps) => {
  // Get the current zoom level from the store
  const zoom = useStore((state) => state.transform[2]);

  if (!geometryType || !position) return null;

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
      }}
    >
      <div className="flex flex-col items-center gap-2 text-gray-600">
        {getGeometryIcon()}
        <span className="text-xs font-medium">{geometryType}</span>
      </div>
    </div>
  );
};
