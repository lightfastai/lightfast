"use client";

import { useEffect, useState } from "react";

import { Icons } from "@repo/ui/components/icons";

// Integration data for the surrounding cards - using 12x12 grid system
// Center card will be at cols 5-6, rows 5-6 (2x2 area in middle)
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
    grid: { colStart: 2, colSpan: 5, rowStart: 0, rowSpan: 5 }, // Top, left of center
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
    grid: { colStart: 7, colSpan: 3, rowStart: 0, rowSpan: 7 }, // Top, right of center
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
    grid: { colStart: 5, colSpan: 5, rowStart: 7, rowSpan: 5 }, // Bottom, right of center
    apps: 3,
    liveApps: 0,
    plannedApps: 3,
  },
];

// Grid constants
const GRID_SIZE = 12;
const CENTER_START = 5;
const CENTER_SIZE = 2;
const CENTER_END = CENTER_START + CENTER_SIZE;

// Calculate grid layout for any viewport
const calculateGridLayout = (viewportWidth: number, viewportHeight: number) => {
  // Container dimensions (accounting for padding)
  const containerWidth = viewportWidth - 64; // 32px padding on each side
  const containerHeight = viewportHeight - 128; // 64px padding on top/bottom

  // Calculate cell dimensions to maintain proportional grid
  // The grid should maintain equal cell sizes when possible
  const minCellSize = Math.min(
    containerWidth / GRID_SIZE,
    containerHeight / GRID_SIZE,
  );

  // Calculate actual grid dimensions centered in the container
  const gridWidth = minCellSize * GRID_SIZE;
  const gridHeight = minCellSize * GRID_SIZE;

  // Calculate offset to center the grid in the container
  const gridOffsetX = 32 + (containerWidth - gridWidth) / 2;
  const gridOffsetY = 64 + (containerHeight - gridHeight) / 2;

  return {
    cellSize: minCellSize,
    gridWidth,
    gridHeight,
    gridOffsetX,
    gridOffsetY,
    containerWidth,
    containerHeight,
  };
};

// Calculate center card properties
const calculateCenterCard = (
  gridLayout: ReturnType<typeof calculateGridLayout>,
  expansionPhase: number,
  viewportWidth: number,
  viewportHeight: number,
) => {
  const { cellSize, gridOffsetX, gridOffsetY } = gridLayout;

  // Center position in the grid (5-6, 5-6 = 2x2 center)
  const gridCenterX = gridOffsetX + (CENTER_START + CENTER_SIZE / 2) * cellSize;
  const gridCenterY = gridOffsetY + (CENTER_START + CENTER_SIZE / 2) * cellSize;

  // Starting position (viewport center)
  const startCenterX = viewportWidth / 2;
  const startCenterY = viewportHeight / 2;

  // Final size when in grid position
  const finalSize = cellSize * CENTER_SIZE;
  const startSize = Math.min(
    600,
    Math.min(viewportWidth, viewportHeight) * 0.6,
  );

  // Current properties based on expansion phase
  const currentSize = startSize - (startSize - finalSize) * expansionPhase;
  const currentCenterX =
    startCenterX + (gridCenterX - startCenterX) * expansionPhase;
  const currentCenterY =
    startCenterY + (gridCenterY - startCenterY) * expansionPhase;

  return {
    size: currentSize,
    centerX: currentCenterX,
    centerY: currentCenterY,
    left: currentCenterX - currentSize / 2,
    top: currentCenterY - currentSize / 2,
    gridCenterX,
    gridCenterY,
  };
};

// export const metadata: Metadata = {
//   title: "Home",
//   description: "Join the waitlist to get early access to Lightfast",
// };

export default function Home() {
  const [wheelProgress, setWheelProgress] = useState(0);
  const [viewportSize, setViewportSize] = useState({
    width: 1920,
    height: 1080,
  });

  useEffect(() => {
    const updateViewportSize = () => {
      setViewportSize({ width: window.innerWidth, height: window.innerHeight });
    };

    updateViewportSize();
    window.addEventListener("resize", updateViewportSize);
    return () => window.removeEventListener("resize", updateViewportSize);
  }, []);

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

  // Calculate grid layout
  const gridLayout = calculateGridLayout(
    viewportSize.width,
    viewportSize.height,
  );
  const centerCard = calculateCenterCard(
    gridLayout,
    expansionPhase,
    viewportSize.width,
    viewportSize.height,
  );

  // Calculate logo position within the card
  const logoSize = 48; // h-12 w-12
  const padding = 32; // p-8

  // Calculate logo position - always center it when move phase is complete
  let logoCurrentX, logoCurrentY;

  if (logoMovePhase >= 1) {
    // Logo is fully centered
    logoCurrentX = (centerCard.size - logoSize) / 2;
    logoCurrentY = (centerCard.size - logoSize) / 2;
  } else {
    // Logo is transitioning from original position to center
    const logoOriginalX = padding;
    const logoOriginalY = centerCard.size - padding - logoSize;
    const logoFinalX = (centerCard.size - logoSize) / 2;
    const logoFinalY = (centerCard.size - logoSize) / 2;

    logoCurrentX = logoOriginalX + (logoFinalX - logoOriginalX) * logoMovePhase;
    logoCurrentY = logoOriginalY + (logoFinalY - logoOriginalY) * logoMovePhase;
  }

  // Calculate content opacity
  const textOpacity = 1 - textFadePhase;

  return (
    <div className="bg-background relative h-screen overflow-hidden">
      {/* Lines extending from center card corners */}
      <div
        className="pointer-events-none absolute inset-0 transition-opacity duration-500"
        style={{ opacity: 1 - expansionPhase * 0.8 }}
      >
        {/* Top horizontal lines */}
        <div
          className="bg-border absolute h-[1px] transition-all duration-300"
          style={{
            top: `${centerCard.top}px`,
            left: 0,
            width: `${centerCard.left}px`,
          }}
        />
        <div
          className="bg-border absolute h-[1px] transition-all duration-300"
          style={{
            top: `${centerCard.top}px`,
            left: `${centerCard.left + centerCard.size}px`,
            width: `${viewportSize.width - (centerCard.left + centerCard.size)}px`,
          }}
        />

        {/* Bottom horizontal lines */}
        <div
          className="bg-border absolute h-[1px] transition-all duration-300"
          style={{
            top: `${centerCard.top + centerCard.size}px`,
            left: 0,
            width: `${centerCard.left}px`,
          }}
        />
        <div
          className="bg-border absolute h-[1px] transition-all duration-300"
          style={{
            top: `${centerCard.top + centerCard.size}px`,
            left: `${centerCard.left + centerCard.size}px`,
            width: `${viewportSize.width - (centerCard.left + centerCard.size)}px`,
          }}
        />

        {/* Left vertical lines */}
        <div
          className="bg-border absolute w-[1px] transition-all duration-300"
          style={{
            left: `${centerCard.left}px`,
            top: 0,
            height: `${centerCard.top}px`,
          }}
        />
        <div
          className="bg-border absolute w-[1px] transition-all duration-300"
          style={{
            left: `${centerCard.left}px`,
            top: `${centerCard.top + centerCard.size}px`,
            height: `${viewportSize.height - (centerCard.top + centerCard.size)}px`,
          }}
        />

        {/* Right vertical lines */}
        <div
          className="bg-border absolute w-[1px] transition-all duration-300"
          style={{
            left: `${centerCard.left + centerCard.size}px`,
            top: 0,
            height: `${centerCard.top}px`,
          }}
        />
        <div
          className="bg-border absolute w-[1px] transition-all duration-300"
          style={{
            left: `${centerCard.left + centerCard.size}px`,
            top: `${centerCard.top + centerCard.size}px`,
            height: `${viewportSize.height - (centerCard.top + centerCard.size)}px`,
          }}
        />
      </div>

      {/* Integration category cards */}
      <div
        className="absolute transition-all duration-500"
        style={{
          left: `${gridLayout.gridOffsetX}px`,
          top: `${gridLayout.gridOffsetY}px`,
          width: `${gridLayout.gridWidth}px`,
          height: `${gridLayout.gridHeight}px`,
          opacity: expansionPhase > 0.3 ? categoryPhase : 0,
        }}
      >
        {integrationCategories.map((cat, index) => {
          const cardWidth = gridLayout.cellSize * cat.grid.colSpan;
          const cardHeight = gridLayout.cellSize * cat.grid.rowSpan;
          const cardLeft = gridLayout.cellSize * cat.grid.colStart;
          const cardTop = gridLayout.cellSize * cat.grid.rowStart;

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
          width: `${centerCard.size}px`,
          height: `${centerCard.size}px`,
          left: `${centerCard.left}px`,
          top: `${centerCard.top}px`,
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
