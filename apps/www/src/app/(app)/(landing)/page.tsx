"use client";

import { useEffect, useState } from "react";

import { Icons } from "@repo/ui/components/icons";

// Integration data for the surrounding cards - using 12x12 grid system
// Center card will be at approximately cols 5-7, rows 5-7 (2x2 area in middle)
const integrationCategories = [
  {
    name: "3D Modeling",
    grid: { colStart: 0, colSpan: 2, rowStart: 0, rowSpan: 7 }, // Left side, top portion
    apps: 7,
    liveApps: 1,
    plannedApps: 6,
  },
  {
    name: "Audio Production",
    grid: { colStart: 0, colSpan: 2, rowStart: 7, rowSpan: 5 }, // Left side, bottom portion
    apps: 5,
    liveApps: 0,
    plannedApps: 5,
  },
  {
    name: "2D Graphics",
    grid: { colStart: 2, colSpan: 4, rowStart: 0, rowSpan: 5 }, // Top, left of center
    apps: 5,
    liveApps: 0,
    plannedApps: 5,
  },
  {
    name: "Game Engines",
    grid: { colStart: 2, colSpan: 3, rowStart: 5, rowSpan: 7 }, // Bottom, left of center
    apps: 4,
    liveApps: 0,
    plannedApps: 4,
  },
  {
    name: "Video & VFX",
    grid: { colStart: 6, colSpan: 3, rowStart: 0, rowSpan: 7 }, // Top, right of center
    apps: 5,
    liveApps: 0,
    plannedApps: 5,
  },
  {
    name: "Design Tools",
    grid: { colStart: 10, colSpan: 2, rowStart: 0, rowSpan: 4 }, // Right side, top portion
    apps: 3,
    liveApps: 1,
    plannedApps: 2,
  },
  {
    name: "Interactive & Live",
    grid: { colStart: 10, colSpan: 2, rowStart: 4, rowSpan: 8 }, // Right side, bottom portion
    apps: 4,
    liveApps: 0,
    plannedApps: 4,
  },
  {
    name: "3D Texturing & CAD",
    grid: { colStart: 5, colSpan: 4, rowStart: 7, rowSpan: 5 }, // Bottom, right of center
    apps: 3,
    liveApps: 0,
    plannedApps: 3,
  },
];

// export const metadata: Metadata = {
//   title: "Home",
//   description: "Join the waitlist to get early access to Lightfast",
// };

export default function Home() {
  const [wheelProgress, setWheelProgress] = useState(0);

  useEffect(() => {
    let accumulatedDelta = 0;
    const maxDelta = 1000;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();

      accumulatedDelta += e.deltaY;
      accumulatedDelta = Math.max(0, Math.min(maxDelta, accumulatedDelta));

      const progress = accumulatedDelta / maxDelta;
      setWheelProgress(progress);
    };

    window.addEventListener("wheel", handleWheel, { passive: false });
    return () => window.removeEventListener("wheel", handleWheel);
  }, []);

  // Calculate transformation phases
  const textFadePhase = Math.min(wheelProgress / 0.3, 1); // Text fades in first 30%
  const logoMovePhase = Math.min(Math.max(0, (wheelProgress - 0.1) / 0.4), 1); // Logo moves 10-50%
  const expansionPhase = Math.min(Math.max(0, (wheelProgress - 0.2) / 0.6), 1); // Card expands 20-80%
  const categoryPhase = Math.min(Math.max(0, (wheelProgress - 0.5) / 0.5), 1); // Categories appear 50-100%

  // Calculate container size
  const containerWidth = window.innerWidth - 64;
  const containerHeight = window.innerHeight - 128;

  // Adaptive grid system that maintains proportions
  const aspectRatio = containerWidth / containerHeight;
  const baseGridSize = 12;

  // Calculate effective grid dimensions based on aspect ratio
  // If wider than square, expand columns; if taller, expand rows
  let effectiveCols, effectiveRows;

  if (aspectRatio >= 1) {
    // Landscape: keep 12 rows, scale columns proportionally
    effectiveRows = baseGridSize;
    effectiveCols = Math.round(baseGridSize * aspectRatio);
  } else {
    // Portrait: keep 12 columns, scale rows proportionally
    effectiveCols = baseGridSize;
    effectiveRows = Math.round(baseGridSize / aspectRatio);
  }

  // Calculate cell dimensions
  const colWidth = containerWidth / effectiveCols;
  const rowHeight = containerHeight / effectiveRows;

  // Center card grid position (2x2 area in the middle of effective grid)
  const CENTER_COL_START = Math.floor((effectiveCols - 2) / 2);
  const CENTER_COL_SPAN = 2;
  const CENTER_ROW_START = Math.floor((effectiveRows - 2) / 2);
  const CENTER_ROW_SPAN = 2;

  // Scale the original 12x12 grid positions to the new effective grid
  const scaleColPosition = (originalCol: number) =>
    Math.round((originalCol * effectiveCols) / baseGridSize);
  const scaleColSpan = (originalSpan: number) =>
    Math.round((originalSpan * effectiveCols) / baseGridSize);
  const scaleRowPosition = (originalRow: number) =>
    Math.round((originalRow * effectiveRows) / baseGridSize);
  const scaleRowSpan = (originalSpan: number) =>
    Math.round((originalSpan * effectiveRows) / baseGridSize);

  // Calculate center card properties
  const centerOriginalSize = 600; // Starting card size
  const centerFinalWidth = colWidth * CENTER_COL_SPAN;
  const centerFinalHeight = rowHeight * CENTER_ROW_SPAN;
  const centerFinalSize = Math.min(centerFinalWidth, centerFinalHeight, 150); // Keep it square and not too big

  const centerCurrentSize =
    centerOriginalSize -
    (centerOriginalSize - centerFinalSize) * expansionPhase;

  // Calculate center card's grid-based final position
  const gridCenterLeft =
    32 + CENTER_COL_START * colWidth + (centerFinalWidth - centerFinalSize) / 2;
  const gridCenterTop =
    64 +
    CENTER_ROW_START * rowHeight +
    (centerFinalHeight - centerFinalSize) / 2;

  // Calculate current center position (interpolate from viewport center to grid center)
  const startCenterX = window.innerWidth / 2;
  const startCenterY = window.innerHeight / 2;

  const currentCenterX =
    startCenterX +
    (gridCenterLeft + centerFinalSize / 2 - startCenterX) * expansionPhase;
  const currentCenterY =
    startCenterY +
    (gridCenterTop + centerFinalSize / 2 - startCenterY) * expansionPhase;

  // Convert center position to left/top coordinates for the card
  const centerCurrentLeft = currentCenterX - centerCurrentSize / 2;
  const centerCurrentTop = currentCenterY - centerCurrentSize / 2;

  // Calculate logo position within the card
  const logoSize = 48; // h-12 w-12
  const padding = 32; // p-8

  // Calculate logo position - always center it when move phase is complete
  let logoCurrentX, logoCurrentY;

  if (logoMovePhase >= 1) {
    // Logo is fully centered - always keep it centered regardless of card size changes
    logoCurrentX = (centerCurrentSize - logoSize) / 2;
    logoCurrentY = (centerCurrentSize - logoSize) / 2;
  } else {
    // Logo is transitioning from original position to center
    // Original position (bottom-left of current card)
    const logoOriginalX = padding;
    const logoOriginalY = centerCurrentSize - padding - logoSize;

    // Final position (center of current card)
    const logoFinalX = (centerCurrentSize - logoSize) / 2;
    const logoFinalY = (centerCurrentSize - logoSize) / 2;

    // Current logo position - interpolate between start and end
    logoCurrentX = logoOriginalX + (logoFinalX - logoOriginalX) * logoMovePhase;
    logoCurrentY = logoOriginalY + (logoFinalY - logoOriginalY) * logoMovePhase;
  }

  // Calculate content opacity
  const textOpacity = 1 - textFadePhase;

  return (
    <div className="bg-background relative h-screen overflow-hidden">
      {/* Lines extending from square corners - keep original lines */}
      <div
        className="pointer-events-none absolute inset-0 transition-opacity duration-500"
        style={{ opacity: 1 - expansionPhase * 0.8 }} // Fade out lines during expansion
      >
        {/* Top horizontal lines */}
        <div
          className="bg-border absolute h-[1px] transition-all duration-300"
          style={{
            top: `calc(50vh - ${centerCurrentSize / 2}px)`,
            left: 0,
            width: `calc(50vw - ${centerCurrentSize / 2}px)`,
          }}
        />
        <div
          className="bg-border absolute h-[1px] transition-all duration-300"
          style={{
            top: `calc(50vh - ${centerCurrentSize / 2}px)`,
            left: `calc(50vw + ${centerCurrentSize / 2}px)`,
            width: `calc(50vw - ${centerCurrentSize / 2}px)`,
          }}
        />

        {/* Bottom horizontal lines */}
        <div
          className="bg-border absolute h-[1px] transition-all duration-300"
          style={{
            top: `calc(50vh + ${centerCurrentSize / 2}px - 1px)`,
            left: 0,
            width: `calc(50vw - ${centerCurrentSize / 2}px)`,
          }}
        />
        <div
          className="bg-border absolute h-[1px] transition-all duration-300"
          style={{
            top: `calc(50vh + ${centerCurrentSize / 2}px - 1px)`,
            left: `calc(50vw + ${centerCurrentSize / 2}px)`,
            width: `calc(50vw - ${centerCurrentSize / 2}px)`,
          }}
        />

        {/* Left vertical lines */}
        <div
          className="bg-border absolute w-[1px] transition-all duration-300"
          style={{
            left: `calc(50vw - ${centerCurrentSize / 2}px)`,
            top: 0,
            height: `calc(50vh - ${centerCurrentSize / 2}px)`,
          }}
        />
        <div
          className="bg-border absolute w-[1px] transition-all duration-300"
          style={{
            left: `calc(50vw - ${centerCurrentSize / 2}px)`,
            top: `calc(50vh + ${centerCurrentSize / 2}px)`,
            height: `calc(50vh - ${centerCurrentSize / 2}px)`,
          }}
        />

        {/* Right vertical lines */}
        <div
          className="bg-border absolute w-[1px] transition-all duration-300"
          style={{
            left: `calc(50vw + ${centerCurrentSize / 2}px - 1px)`,
            top: 0,
            height: `calc(50vh - ${centerCurrentSize / 2}px)`,
          }}
        />
        <div
          className="bg-border absolute w-[1px] transition-all duration-300"
          style={{
            left: `calc(50vw + ${centerCurrentSize / 2}px - 1px)`,
            top: `calc(50vh + ${centerCurrentSize / 2}px)`,
            height: `calc(50vh - ${centerCurrentSize / 2}px - 1px)`,
          }}
        />
      </div>

      {/* Integration category cards that appear around the center */}
      <div
        className="absolute transition-all duration-500"
        style={{
          left: "32px",
          top: "64px",
          width: `${containerWidth}px`,
          height: `${containerHeight}px`,
          opacity: expansionPhase > 0.3 ? categoryPhase : 0,
        }}
      >
        {integrationCategories.map((cat, index) => {
          // Scale the original 12x12 grid positions to the effective grid
          const scaledColStart = scaleColPosition(cat.grid.colStart);
          const scaledColSpan = scaleColSpan(cat.grid.colSpan);
          const scaledRowStart = scaleRowPosition(cat.grid.rowStart);
          const scaledRowSpan = scaleRowSpan(cat.grid.rowSpan);

          const cardWidth = colWidth * scaledColSpan;
          const cardHeight = rowHeight * scaledRowSpan;
          const cardLeft = scaledColStart * colWidth;
          const cardTop = scaledRowStart * rowHeight;

          return (
            <div
              key={cat.name}
              className="border-border bg-card/80 hover:bg-card/90 absolute flex items-start justify-start overflow-hidden border p-6 backdrop-blur-sm transition-all duration-700"
              style={{
                width: `${cardWidth}px`,
                height: `${cardHeight}px`,
                left: `${cardLeft}px`,
                top: `${cardTop}px`,
                opacity: categoryPhase,
                transform: `scale(${0.8 + categoryPhase * 0.2})`,
                transitionDelay: `${index * 50}ms`,
              }}
            >
              <div className="flex flex-col">
                <span className="text-foreground/90 mb-4 text-2xl font-semibold">
                  {cat.name}
                </span>
                <div className="flex flex-col gap-1">
                  <span className="text-muted-foreground text-sm">
                    {cat.apps} apps
                  </span>
                  <div className="flex gap-1">
                    {cat.liveApps > 0 && (
                      <span className="bg-primary/20 text-primary rounded-full px-2 py-0.5 text-xs">
                        {cat.liveApps} Live
                      </span>
                    )}
                    {cat.plannedApps > 0 && (
                      <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs">
                        {cat.plannedApps} Soon
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* The transforming center card */}
      <div
        className="bg-card border-border absolute overflow-hidden border shadow-2xl transition-all duration-700"
        style={{
          width: `${centerCurrentSize}px`,
          height: `${centerCurrentSize}px`,
          left: `${centerCurrentLeft}px`,
          top: `${centerCurrentTop}px`,
        }}
      >
        {/* Text content (top-left, fades out) */}
        <div
          className="absolute top-8 right-8 left-8 transition-opacity duration-500"
          style={{ opacity: textOpacity }}
        >
          <p className="max-w-[400px] text-2xl font-bold">
            The intelligent creative copilot that simplifies the way you
            interact with applications like Blender, Unity, Fusion360 and more.
          </p>
        </div>

        {/* Logo (transforms from bottom-left to center) */}
        <div
          className="absolute flex items-center justify-center transition-all duration-700"
          style={{
            left: `${logoCurrentX}px`,
            top: `${logoCurrentY}px`,
            width: `${logoSize}px`,
            height: `${logoSize}px`,
          }}
        >
          <Icons.logoShort className="text-primary h-12 w-12" />
        </div>
      </div>

      {/* Header that appears */}
      <div
        className="absolute top-16 right-0 left-0 text-center transition-opacity duration-500"
        style={{ opacity: categoryPhase }}
      >
        <h2 className="text-foreground mb-4 text-3xl font-bold">
          Works with your
          <span className="text-primary ml-2 italic">favorite tools</span>
        </h2>
      </div>
    </div>
  );
}
