"use client";

import { useReactFlow, useStore } from "@xyflow/react";
import { Circle, Square, Triangle } from "lucide-react";

interface PendingGeometryPreviewProps {
  geometryType: string | null;
  position: { x: number; y: number } | null;
}

export const PendingGeometryPreview = ({
  geometryType,
  position,
}: PendingGeometryPreviewProps) => {
  const zoom = useStore((state) => state.transform[2]);
  const { flowToScreenPosition } = useReactFlow();

  if (!geometryType || !position) return null;

  // Convert flow coordinates to screen coordinates
  const screenPosition = flowToScreenPosition(position);

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

  // Base size that will be scaled with zoom
  const previewSize = 96;

  return (
    <div
      className="pointer-events-none fixed z-50 flex items-center justify-center rounded-lg border border-dashed border-gray-400 bg-white/10 backdrop-blur-sm"
      style={{
        left: screenPosition.x,
        top: screenPosition.y,
        width: previewSize,
        height: previewSize,
      }}
    >
      <div className="flex flex-col items-center gap-2 text-gray-600">
        {getGeometryIcon()}
        <span className="text-xs font-medium">{geometryType}</span>
      </div>
    </div>
  );
};
