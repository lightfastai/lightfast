"use client";

import { cn } from "@repo/ui/lib/utils";
import type { PITCH_SLIDES } from "~/config/pitch-deck-data";
import type { SlideVariant } from "./title-slide-content";

interface ColumnsSlideContentProps {
  slide: Extract<(typeof PITCH_SLIDES)[number], { type: "columns" }>;
  variant?: SlideVariant;
}

export function ColumnsSlideContent({
  slide,
  variant = "responsive",
}: ColumnsSlideContentProps) {
  const isFixed = variant === "fixed";
  const columnCount = slide.columns.length;

  // Dynamic grid classes based on column count (2-4)
  const gridColsFixed: Record<number, string> = {
    2: "grid-cols-2",
    3: "grid-cols-3",
    4: "grid-cols-4",
  };

  const gridColsResponsive: Record<number, string> = {
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-3",
    4: "grid-cols-2 sm:grid-cols-4",
  };

  const fixedGridCols = gridColsFixed[columnCount] ?? "grid-cols-4";
  const responsiveGridCols =
    gridColsResponsive[columnCount] ?? "grid-cols-2 sm:grid-cols-4";

  return (
    <div className={cn("flex h-full w-full flex-col", slide.textColor)}>
      {/* Title at top left */}
      <h2
        className={cn(
          "font-normal text-foreground",
          isFixed ? "text-5xl" : "text-xl sm:text-2xl md:text-3xl"
        )}
      >
        {slide.title}
      </h2>

      {/* Columns at bottom */}
      <div
        className={cn(
          "mt-auto grid",
          isFixed
            ? `${fixedGridCols} gap-12`
            : `${responsiveGridCols} gap-3 sm:gap-4 md:gap-8`
        )}
      >
        {slide.columns.map((column) => (
          <div key={column.header} className="flex flex-col">
            {/* Column header with underline */}
            <h3
              className={cn(
                "border-b border-neutral-300 font-medium uppercase tracking-wider text-neutral-500",
                isFixed ? "mb-4 pb-2 text-sm" : "mb-2 pb-1.5 text-[9px] sm:mb-3 sm:pb-2 sm:text-[10px] md:text-xs"
              )}
            >
              {column.header}
            </h3>

            {/* Column items */}
            <ul
              className={cn(
                "flex flex-col text-neutral-700",
                isFixed ? "gap-2 text-lg" : "gap-1 text-[10px] sm:gap-1.5 sm:text-xs md:gap-2 md:text-sm"
              )}
            >
              {column.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
