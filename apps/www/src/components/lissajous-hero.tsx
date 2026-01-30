import { Lissajous } from "./lissajous";

export function LissajousHero() {
  // Grid of lissajous patterns with different frequency ratios
  const patterns = [
    // Row 1
    [
      { a: 1, b: 2 },
      { a: 1, b: 3 },
      { a: 2, b: 3 },
      { a: 3, b: 4 },
      { a: 3, b: 5 },
    ],
    // Row 2
    [
      { a: 1, b: 4 },
      { a: 2, b: 5 },
      { a: 3, b: 2 },
      { a: 4, b: 3 },
      { a: 5, b: 4 },
    ],
    // Row 3
    [
      { a: 2, b: 1 },
      { a: 3, b: 1 },
      { a: 4, b: 1 },
      { a: 5, b: 2 },
      { a: 4, b: 5 },
    ],
    // Row 4
    [
      { a: 5, b: 3 },
      { a: 3, b: 7 },
      { a: 5, b: 6 },
      { a: 7, b: 4 },
      { a: 5, b: 7 },
    ],
    // Row 5
    [
      { a: 7, b: 5 },
      { a: 4, b: 7 },
      { a: 6, b: 5 },
      { a: 7, b: 6 },
      { a: 8, b: 7 },
    ],
  ];

  return (
    <div className="relative w-full aspect-[16/9] bg-muted rounded-sm overflow-hidden">
      {/* Left side - Text */}
      <div className="absolute top-8 left-8 md:top-12 md:left-12 z-10">
        <h3 className="text-2xl md:text-4xl lg:text-5xl font-light leading-[1.1] tracking-[-0.02em] text-foreground">
          Read our
          <br />
          blog
        </h3>
      </div>

      {/* Bottom right - Lissajous grid */}
      <div className="absolute right-4 bottom-4 md:right-8 md:bottom-8 lg:right-12 lg:bottom-12">
        <div className="grid grid-cols-5 gap-1 md:gap-2 lg:gap-3">
          {patterns.map((row, rowIndex) =>
            row.map((pattern, colIndex) => (
              <Lissajous
                key={`${rowIndex}-${colIndex}`}
                a={pattern.a}
                b={pattern.b}
                strokeWidth={0.8}
                className="w-10 h-10 md:w-16 md:h-16 lg:w-20 lg:h-20 text-foreground"
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
