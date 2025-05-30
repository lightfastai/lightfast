import { useEffect, useState } from "react";

import type {
  AnimationPhases,
  CenterCard,
  GridLayout,
  ViewportSize,
} from "./types";
import { CENTER_SIZE, CENTER_START, GRID_SIZE } from "./constants";

// Calculate grid layout for any viewport
export const calculateGridLayout = (
  viewportWidth: number,
  viewportHeight: number,
): GridLayout => {
  // Container dimensions (accounting for padding)
  const containerWidth = viewportWidth - 64; // 32px padding on each side
  const containerHeight = viewportHeight - 128; // 64px padding on top/bottom

  // Calculate cell size based on full container width
  // This ensures the grid expands to use the full width available
  const cellSize = containerWidth / GRID_SIZE;

  // Calculate actual grid dimensions using full container width
  const gridWidth = containerWidth;
  const gridHeight = cellSize * GRID_SIZE;

  // No horizontal offset since we're using full width
  // Center vertically if grid height is smaller than container height
  const gridOffsetX = 32;
  const gridOffsetY = 64 + Math.max(0, (containerHeight - gridHeight) / 2);

  return {
    cellSize,
    gridWidth,
    gridHeight,
    gridOffsetX,
    gridOffsetY,
    containerWidth,
    containerHeight,
  };
};

// Calculate center card properties
export const calculateCenterCard = (
  gridLayout: GridLayout,
  expansionPhase: number,
  viewportWidth: number,
  viewportHeight: number,
): CenterCard => {
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

export const useViewportSize = () => {
  const [viewportSize, setViewportSize] = useState<ViewportSize>({
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

  return viewportSize;
};

export const useWheelProgress = () => {
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

  return wheelProgress;
};

export const useAnimationPhases = (wheelProgress: number): AnimationPhases => {
  return {
    textFadePhase: Math.min(wheelProgress / 0.3, 1), // Text fades in first 30%
    logoMovePhase: Math.min(Math.max(0, (wheelProgress - 0.1) / 0.4), 1), // Logo moves 10-50%
    expansionPhase: Math.min(Math.max(0, (wheelProgress - 0.2) / 0.6), 1), // Card expands 20-80%
    categoryPhase: Math.min(Math.max(0, (wheelProgress - 0.5) / 0.5), 1), // Categories appear 50-100%
  };
};
