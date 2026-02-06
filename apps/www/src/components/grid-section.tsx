"use client";

import type { ReactNode } from "react";
import { useId, useMemo } from "react";
import { cn } from "@repo/ui/lib/utils";

// ============================================================================
// TYPES
// ============================================================================

export interface GridSectionProps {
  /** Number of rows */
  rows: number;
  /** Number of columns (desktop) */
  cols: number;
  /** Number of columns on mobile (default: 4) */
  mobileCols?: number;
  /** Gap between cells (default: "8px") */
  gap?: string;
  /** Cell aspect ratio class (default: "aspect-square") */
  cellAspectRatio?: string;
  /** Border variant */
  borderVariant?: "double-line" | "simple" | "none";
  /** Border color class (default: "border-border") */
  borderColorClass?: string;
  /** Show outer container border (default: true) */
  outerBorder?: boolean;
  /** Cell background class (default: "bg-background") */
  cellBackground?: string;
  /** Set of cell addresses "row-col" to make borderless */
  borderlessZone?: Set<string>;
  /** Enable interactive hover states */
  interactive?: boolean;
  /** Hover background class when interactive */
  hoverClass?: string;
  /** Show debug coordinate labels */
  showLabels?: boolean;
  /** Render function for cell content */
  renderCell?: (row: number, col: number) => ReactNode;
  /** Additional className for container */
  className?: string;
  /** Children rendered as overlays (use grid positioning) */
  children?: ReactNode;
}

// ============================================================================
// BORDER COMPUTATION
// ============================================================================

interface BorderConfig {
  row: number;
  col: number;
  totalRows: number;
  totalCols: number;
  mobileCols: number;
  borderlessZone: Set<string>;
  borderColorClass: string;
}

function computeDoubleBorders(config: BorderConfig): string {
  const {
    row,
    col,
    totalRows,
    totalCols,
    mobileCols,
    borderlessZone,
    borderColorClass,
  } = config;

  const isInZone = (r: number, c: number) => borderlessZone.has(`${r}-${c}`);
  const inZone = isInZone(row, col);
  const aboveInZone = isInZone(row - 1, col);
  const belowInZone = isInZone(row + 1, col);
  const leftInZone = isInZone(row, col - 1);
  const rightInZone = isInZone(row, col + 1);

  const isTopEdge = row === 1;
  const isBottomEdge = row === totalRows;
  const isLeftEdge = col === 1;
  const isRightEdgeDesktop = col === totalCols;
  const isRightEdgeMobile = col === mobileCols;

  const classes: string[] = [];

  // Top border: outer edge OR between cells (skip if both cells in borderless zone)
  if (isTopEdge || !(inZone && aboveInZone)) {
    classes.push(`border-t ${borderColorClass.replace("border-", "border-t-")}`);
  }

  // Bottom border: outer edge OR between cells (skip if both cells in borderless zone)
  if (isBottomEdge || !(inZone && belowInZone)) {
    classes.push(`border-b ${borderColorClass.replace("border-", "border-b-")}`);
  }

  // Left border: outer edge OR between cells (skip if both cells in borderless zone)
  if (isLeftEdge || !(inZone && leftInZone)) {
    classes.push(`border-l ${borderColorClass.replace("border-", "border-l-")}`);
  }

  // Right border (responsive): outer edge OR between cells
  if (col <= mobileCols) {
    // Mobile visible columns
    if (isRightEdgeMobile) {
      // Last mobile column: always has right border on mobile, add desktop border if not last desktop col
      classes.push(`border-r ${borderColorClass.replace("border-", "border-r-")}`);
    } else if (!(inZone && rightInZone)) {
      // Not last mobile column: border between cells
      classes.push(`border-r ${borderColorClass.replace("border-", "border-r-")}`);
    }
  } else {
    // Desktop-only columns
    if (isRightEdgeDesktop) {
      // Last desktop column: always has right border
      classes.push(`border-r ${borderColorClass.replace("border-", "border-r-")}`);
    } else if (!(inZone && rightInZone)) {
      // Not last column: border between cells
      classes.push(`border-r ${borderColorClass.replace("border-", "border-r-")}`);
    }
  }

  return classes.join(" ");
}

function computeSimpleBorders(borderColorClass: string): string {
  return `border ${borderColorClass}`;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function GridSection({
  rows,
  cols,
  mobileCols = 4,
  gap = "8px",
  cellAspectRatio = "aspect-square",
  borderVariant = "double-line",
  borderColorClass = "border-border",
  outerBorder = true,
  cellBackground = "bg-background",
  borderlessZone = new Set<string>(),
  interactive = false,
  hoverClass = "",
  showLabels = false,
  renderCell,
  className,
  children,
}: GridSectionProps) {
  // Generate unique ID for scoped styles
  const gridId = useId().replace(/:/g, "-");

  // Generate cells
  const cells = useMemo(() => {
    const result: ReactNode[] = [];

    for (let rowIdx = 0; rowIdx < rows; rowIdx++) {
      const row = rowIdx + 1; // 1-indexed

      for (let colIdx = 0; colIdx < cols; colIdx++) {
        const col = colIdx + 1; // 1-indexed
        const isMobileVisible = col <= mobileCols;

        // Compute border classes based on variant
        let borderClasses = "";
        if (borderVariant === "double-line") {
          borderClasses = computeDoubleBorders({
            row,
            col,
            totalRows: rows,
            totalCols: cols,
            mobileCols,
            borderlessZone,
            borderColorClass,
          });
        } else if (borderVariant === "simple") {
          borderClasses = computeSimpleBorders(borderColorClass);
        }

        // Visibility class - need to use flex variant for desktop-only cells when showing labels
        const visibilityClass = !isMobileVisible
          ? showLabels
            ? "hidden md:flex"
            : "hidden md:block"
          : "";

        // Interactive class
        const interactiveClass = interactive
          ? `transition-colors duration-1000 hover:duration-75 ${hoverClass}`
          : "";

        result.push(
          <div
            key={`cell-${row}-${col}`}
            data-cell={`${row}-${col}`}
            className={cn(
              cellBackground,
              cellAspectRatio,
              borderClasses,
              visibilityClass,
              interactiveClass,
              showLabels && "flex items-center justify-center"
            )}
            style={{ gridRow: row, gridColumn: col }}
          >
            {showLabels && (
              <span className="text-xs text-muted-foreground/50 font-mono">
                {row}-{col}
              </span>
            )}
            {renderCell?.(row, col)}
          </div>
        );
      }
    }

    return result;
  }, [
    rows,
    cols,
    mobileCols,
    cellAspectRatio,
    borderVariant,
    borderColorClass,
    cellBackground,
    borderlessZone,
    interactive,
    hoverClass,
    showLabels,
    renderCell,
  ]);

  return (
    <>
      {/* Scoped responsive styles for this specific grid instance */}
      <style>{`
        #grid${gridId} {
          grid-template-columns: repeat(${mobileCols}, 1fr);
        }
        @media (min-width: 768px) {
          #grid${gridId} {
            grid-template-columns: repeat(${cols}, 1fr);
          }
        }
      `}</style>

      <section
        id={`grid${gridId}`}
        className={cn(
          "relative w-full grid content-start",
          outerBorder && `border ${borderColorClass}`,
          className
        )}
        style={{ gap }}
      >
        {/* Grid cells */}
        {cells}

        {/* Content overlays (children) */}
        {children}
      </section>
    </>
  );
}

// ============================================================================
// CONVENIENCE VARIANTS
// ============================================================================

/** Pre-configured variant matching the landing page hero grid */
export function HeroGridSection(
  props: Omit<GridSectionProps, "rows" | "cols" | "borderVariant">
) {
  return (
    <GridSection
      rows={7}
      cols={9}
      borderVariant="double-line"
      {...props}
    />
  );
}

/** Pre-configured variant matching the footer grid */
export function FooterGridSection(
  props: Omit<GridSectionProps, "rows" | "cols" | "borderVariant">
) {
  return (
    <GridSection
      rows={1}
      cols={9}
      borderVariant="double-line"
      {...props}
    />
  );
}

/** Pre-configured variant matching the CTA grid */
export function CTAGridSection(
  props: Omit<GridSectionProps, "rows" | "cols" | "borderVariant" | "interactive">
) {
  return (
    <GridSection
      rows={6}
      cols={12}
      borderVariant="simple"
      interactive
      outerBorder
      {...props}
    />
  );
}
