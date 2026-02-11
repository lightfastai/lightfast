"use client";

import { cn } from "@repo/ui/lib/utils";
import type { ReactNode } from "react";

interface GridSectionProps {
  rows: number;
  cols: number;
  mobileCols?: number;
  cellAspectRatio?: string;
  borderVariant?: "single-line" | "double-line" | "simple";
  borderColorClass?: string;
  outerBorder?: boolean;
  cellBackground?: string;
  borderlessZone?: Set<string>;
  interactive?: boolean;
  hoverClass?: string;
  renderCell?: (row: number, col: number) => ReactNode;
  children?: ReactNode;
}

export function GridSection({
  rows,
  cols,
  mobileCols,
  cellAspectRatio = "aspect-square",
  borderVariant = "single-line",
  borderColorClass = "border-border",
  outerBorder = true,
  cellBackground = "bg-transparent",
  borderlessZone,
  interactive = false,
  hoverClass,
  renderCell,
  children,
}: GridSectionProps) {
  const borderStyle =
    borderVariant === "double-line"
      ? "border-double border-4"
      : borderVariant === "simple"
        ? "border"
        : "border border-1";

  const gridCells = [];
  for (let row = 1; row <= rows; row++) {
    for (let col = 1; col <= cols; col++) {
      const cellKey = `${row}-${col}`;
      const isBorderless = borderlessZone?.has(cellKey);

      gridCells.push(
        <div
          key={cellKey}
          className={cn(
            cellAspectRatio,
            cellBackground,
            !isBorderless && borderStyle,
            !isBorderless && borderColorClass,
            interactive && "transition-colors duration-200",
            interactive && hoverClass
          )}
        >
          {renderCell?.(row, col)}
        </div>
      );
    }
  }

  return (
    <div
      className={cn(
        "relative grid gap-0",
        outerBorder && borderStyle,
        outerBorder && borderColorClass
      )}
      style={{
        gridTemplateColumns: `repeat(${mobileCols ?? cols}, minmax(0, 1fr))`,
        ...(mobileCols && {
          ["@media (min-width: 768px)" as any]: {
            gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
          },
        }),
      }}
    >
      {gridCells}
      {children}
    </div>
  );
}
