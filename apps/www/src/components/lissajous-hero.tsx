"use client";

import { GridSection } from "./grid-section";
import { Lissajous } from "./lissajous";

export function LissajousHero() {
  // 8x5 grid of Lissajous patterns for bottom-right corner (rows 5-9, cols 9-16)
  const patterns = [
    // Row 1 (grid row 5)
    [
      { a: 1, b: 2 },
      { a: 1, b: 3 },
      { a: 2, b: 3 },
      { a: 3, b: 4 },
      { a: 3, b: 5 },
      { a: 4, b: 5 },
      { a: 5, b: 6 },
      { a: 2, b: 5 },
    ],
    // Row 2 (grid row 6)
    [
      { a: 1, b: 4 },
      { a: 2, b: 5 },
      { a: 3, b: 2 },
      { a: 4, b: 3 },
      { a: 5, b: 4 },
      { a: 6, b: 5 },
      { a: 3, b: 7 },
      { a: 4, b: 7 },
    ],
    // Row 3 (grid row 7)
    [
      { a: 2, b: 1 },
      { a: 3, b: 1 },
      { a: 4, b: 1 },
      { a: 5, b: 2 },
      { a: 4, b: 5 },
      { a: 5, b: 3 },
      { a: 6, b: 7 },
      { a: 7, b: 8 },
    ],
    // Row 4 (grid row 8)
    [
      { a: 5, b: 3 },
      { a: 3, b: 7 },
      { a: 5, b: 6 },
      { a: 7, b: 4 },
      { a: 5, b: 7 },
      { a: 6, b: 5 },
      { a: 7, b: 6 },
      { a: 8, b: 7 },
    ],
    // Row 5 (grid row 9)
    [
      { a: 7, b: 5 },
      { a: 4, b: 7 },
      { a: 6, b: 5 },
      { a: 7, b: 6 },
      { a: 8, b: 7 },
      { a: 5, b: 8 },
      { a: 6, b: 7 },
      { a: 9, b: 8 },
    ],
  ];

  // Text occupies top-left area (rows 1-5, cols 1-8) - borderless zone
  const borderlessZone = new Set<string>();
  for (let r = 1; r <= 5; r++) {
    for (let c = 1; c <= 8; c++) {
      borderlessZone.add(`${r}-${c}`);
    }
  }

  // Map grid position to pattern (bottom-right: rows 5-9, cols 9-16)
  const getPattern = (row: number, col: number) => {
    if (row < 5 || col < 9) return null; // Not in pattern zone
    const patternRow = row - 5; // Rows 5-9 → indices 0-4
    const patternCol = col - 9; // Cols 9-16 → indices 0-7
    return patterns[patternRow]?.[patternCol] ?? null;
  };

  return (
    <div className="relative w-full bg-muted rounded-sm overflow-hidden p-2">
      <GridSection
        rows={9}
        cols={16}
        mobileCols={4}
        cellAspectRatio="aspect-square"
        borderVariant="double-line"
        borderColorClass="border-border/50"
        outerBorder={false}
        cellBackground="bg-transparent"
        borderlessZone={borderlessZone}
        renderCell={(row, col) => {
          const pattern = getPattern(row, col);
          if (!pattern) return null;
          return (
            <div className="flex items-center justify-center p-1 w-full h-full">
              <Lissajous
                a={pattern.a}
                b={pattern.b}
                strokeWidth={0.8}
                className="w-full h-full text-foreground"
              />
            </div>
          );
        }}
      >
        {/* Text overlay - positioned in top-left grid area */}
        <div
          className="z-10 flex items-end p-8 md:p-12"
          style={{
            gridColumn: "1 / 9",
            gridRow: "1 / 6",
          }}
        >
          <h3 className="text-2xl md:text-4xl lg:text-5xl font-light leading-[1.1] tracking-[-0.02em] text-foreground">
            Read our
            <br />
            blog
          </h3>
        </div>
      </GridSection>
    </div>
  );
}
