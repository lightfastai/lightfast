"use client";

import { useCallback, useMemo, useState } from "react";
import { useReactFlow, useStore, XYPosition } from "@xyflow/react";

import { useDebounce } from "../../../../../../../hooks/use-debounce";

// Constants
const PREVIEW_BASE_WIDTH = 96;
const PREVIEW_BASE_HEIGHT = 48;

// Interfaces
interface UseWorkspaceSelectionPreviewParams {
  active: boolean;
}

interface UseWorkspaceSelectionPreviewReturn {
  render: () => React.ReactNode | null;
  handleMouseMove: (event: React.MouseEvent) => void;
}

/**
 * Custom hook to manage the workspace selection preview functionality.
 *
 * @param {Object} params - Parameters for the hook.
 * @param {boolean} params.active - Indicates whether the preview is active.
 * @returns {Object} - Contains the render function and mouse move handler.
 */
export const useWorkspaceSelectionPreview = ({
  active,
}: UseWorkspaceSelectionPreviewParams): UseWorkspaceSelectionPreviewReturn => {
  const [position, setPosition] = useState<XYPosition | null>(null);
  const { flowToScreenPosition, screenToFlowPosition } = useReactFlow();
  const zoom = useStore((state) => state.transform[2]);

  /**
   * Calculates the size of the preview based on the current zoom level.
   *
   * @returns {object} - The calculated width and height for the preview.
   */
  const calculatedPreviewSize = useMemo(
    () => ({
      width: PREVIEW_BASE_WIDTH / (1 / zoom),
      height: PREVIEW_BASE_HEIGHT / (1 / zoom),
    }),
    [zoom],
  );

  // Memoize screen position calculation
  const screenPosition = useMemo(
    () => (position ? flowToScreenPosition(position) : null),
    [position, flowToScreenPosition],
  );

  /**
   * Updates the position state with debounce to optimize performance.
   *
   * @param {XYPosition} newPosition - The new position to set.
   */
  const debouncedUpdatePosition = useDebounce((newPosition: XYPosition) => {
    setPosition(newPosition);
  }, 4);

  /**
   * Handles mouse move events to update the preview position.
   *
   * @param {React.MouseEvent} event - The mouse event.
   */
  const handleMouseMove = useCallback(
    (event: React.MouseEvent) => {
      // ensure calculations are only made when the preview is active
      if (!active) return;

      const newPosition = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      debouncedUpdatePosition(newPosition);
    },
    [active, screenToFlowPosition, debouncedUpdatePosition],
  );

  const render = useCallback(() => {
    if (!active || !screenPosition) return null;

    return (
      <div
        className="pointer-events-none fixed z-50 flex items-center justify-center rounded-lg border border-dashed border-gray-400 bg-white/10 backdrop-blur-sm"
        style={{
          left: screenPosition.x,
          top: screenPosition.y,
          width: calculatedPreviewSize.width,
          height: calculatedPreviewSize.height,
        }}
      />
    );
  }, [active, screenPosition, calculatedPreviewSize]);

  return {
    render,
    handleMouseMove,
  };
};
