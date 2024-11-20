"use client";

import { useCallback, useMemo, useState } from "react";
import { useReactFlow, useStore, XYPosition } from "@xyflow/react";

export const useWorkspaceSelectionPreview = ({
  active,
}: {
  active: boolean;
}) => {
  const zoom = useStore((state) => state.transform[2]);
  const [position, setPosition] = useState<XYPosition | null>(null);
  const { flowToScreenPosition, screenToFlowPosition } = useReactFlow();
  const previewSizeWidth = useMemo(() => 96 / (1 / zoom), [zoom]);
  const previewSizeHeight = useMemo(() => 48 / (1 / zoom), [zoom]);
  const screenPosition = useMemo(
    () => (position ? flowToScreenPosition(position) : null),
    [position, flowToScreenPosition],
  );

  const handleMouseMove = useCallback(
    (event: React.MouseEvent) => {
      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      setPosition(position);
    },
    [screenToFlowPosition],
  );

  const render = useCallback(
    () =>
      active &&
      screenPosition && (
        <div
          className="pointer-events-none fixed z-50 flex items-center justify-center rounded-lg border border-dashed border-gray-400 bg-white/10 backdrop-blur-sm"
          style={{
            left: screenPosition.x,
            top: screenPosition.y,
            width: previewSizeWidth,
            height: previewSizeHeight,
          }}
        />
      ),
    [active, screenPosition],
  );

  return {
    render,
    handleMouseMove,
  };
};
