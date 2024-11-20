"use client";

import { useMemo } from "react";
import { useReactFlow, useStore } from "@xyflow/react";

import { GeometryType } from "@repo/db/schema";

interface WorkspaceSelectionPreviewProps {
  geometryType: GeometryType | null;
  position: { x: number; y: number } | null;
}

export const WorkspaceSelectionPreview = ({
  geometryType,
  position,
}: WorkspaceSelectionPreviewProps) => {
  const zoom = useStore((state) => state.transform[2]);
  const { flowToScreenPosition } = useReactFlow();
  const previewSizeWidth = useMemo(() => 96 / (1 / zoom), [zoom]);
  const previewSizeHeight = useMemo(() => 48 / (1 / zoom), [zoom]);
  const screenPosition = useMemo(
    () => (position ? flowToScreenPosition(position) : null),
    [position, flowToScreenPosition],
  );
  if (!geometryType || !screenPosition) return null;
  return (
    <div
      className="pointer-events-none fixed z-50 flex items-center justify-center rounded-lg border border-dashed border-gray-400 bg-white/10 backdrop-blur-sm"
      style={{
        left: screenPosition.x,
        top: screenPosition.y,
        width: previewSizeWidth,
        height: previewSizeHeight,
      }}
    >
      <div className="flex flex-col items-center gap-2 text-gray-600">
        <span className="text-xs font-medium capitalize">{geometryType}</span>
      </div>
    </div>
  );
};
