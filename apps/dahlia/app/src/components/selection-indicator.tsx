import { useEffect, useState } from "react";

import { cn } from "@repo/ui/lib/utils";

interface SelectionIndicatorProps {
  x: number;
  y: number;
  gridSize: number;
  isActive: boolean;
}

export const SelectionIndicator = ({
  x,
  y,
  gridSize,
  isActive,
}: SelectionIndicatorProps) => {
  const [position, setPosition] = useState({ x, y });

  useEffect(() => {
    // Snap to grid
    const snappedX = Math.round(x / gridSize) * gridSize;
    const snappedY = Math.round(y / gridSize) * gridSize;

    // Smooth transition using requestAnimationFrame
    const updatePosition = () => {
      setPosition((prev) => ({
        x: snappedX,
        y: snappedY,
      }));
    };

    requestAnimationFrame(updatePosition);
  }, [x, y, gridSize]);

  if (!isActive) return null;

  return (
    <div
      className={cn(
        "pointer-events-none absolute rounded-sm border-2 border-dashed",
        "border-primary transition-opacity duration-200",
        "bg-primary/5 backdrop-blur-[1px]",
        isActive ? "opacity-100" : "opacity-0",
      )}
      style={{
        transform: `translate(${position.x}px, ${position.y}px)`,
        width: `${gridSize * 3}px`,
        height: `${gridSize * 2}px`,
        willChange: "transform",
      }}
    />
  );
};
