import { useEffect, useState } from "react";

import type {
  AnimationPhases,
  CenterCard,
  GridLayout,
  ViewportSize,
} from "./types";
import { CENTER_SIZE, CENTER_START, GRID_SIZE } from "./constants";
import { getCSSVariableValue } from "./utils";

// Helper function to read CSS variables, can be moved to a utils file or imported if already exists
// Ensure this is consistent with the one in integration-categories.tsx or defined globally
// const getCSSVariableValue = (variableName: string, defaultValue: number = 0): number => {
//   if (typeof window === "undefined") return defaultValue;
//   const value = getComputedStyle(document.documentElement).getPropertyValue(variableName.trim());
//   return parseFloat(value) || defaultValue;
// };

// Calculate grid layout for any viewport
/**
 * @deprecated This function will be replaced by CSS custom properties updated by useLandingCSSVariables.
 * Calculations will be done in CSS directly or by simpler JS functions reading CSS vars.
 */
export const calculateGridLayout = (
  viewportWidth: number,
  viewportHeight: number,
): GridLayout => {
  // Container dimensions (accounting for padding)
  const containerWidth = viewportWidth - 64; // 32px padding on each side
  const containerHeight = viewportHeight - 128; // 64px padding on top/bottom

  // Calculate separate cell dimensions to fit within the container
  const cellWidth = containerWidth / GRID_SIZE;
  const cellHeight = containerHeight / GRID_SIZE;

  // Keep cellSize for backward compatibility (used by center card)
  const cellSize = Math.min(cellWidth, cellHeight);

  // Calculate actual grid dimensions using full container width and height
  const gridWidth = containerWidth;
  const gridHeight = containerHeight; // Always use full height (100vh minus padding)

  // No offset since we're using full width and full height
  const gridOffsetX = 32;
  const gridOffsetY = 64;

  return {
    cellSize,
    cellWidth,
    cellHeight,
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
  expansionPhase: number,
  viewportWidth: number,
  viewportHeight: number,
): CenterCard => {
  // Read necessary grid layout values from CSS custom properties
  const cellWidth = getCSSVariableValue("--landing-grid-cell-width");
  const cellHeight = getCSSVariableValue("--landing-grid-cell-height");
  const gridOffsetX = getCSSVariableValue("--landing-grid-offset-x");
  const gridOffsetY = getCSSVariableValue("--landing-grid-offset-y");
  // GRID_SIZE, CENTER_START, CENTER_SIZE are also available as CSS variables if needed for pure CSS calcs later
  // const gridSizeConst = getCSSVariableValue('--landing-grid-size', GRID_SIZE); // Example
  const centerStartConst = getCSSVariableValue(
    "--landing-center-start-grid-units",
    CENTER_START,
  );
  const centerSizeConst = getCSSVariableValue(
    "--landing-center-size-grid-units",
    CENTER_SIZE,
  );

  // Center position in the grid (5-6, 5-6 = 2x2 center)
  const gridCenterX =
    gridOffsetX + (centerStartConst + centerSizeConst / 2) * cellWidth;
  const gridCenterY =
    gridOffsetY + (centerStartConst + centerSizeConst / 2) * cellHeight;

  // Starting position (viewport center)
  const startCenterX = viewportWidth / 2;
  const startCenterY = viewportHeight / 2;

  // Final size when in grid position - maintain 1:1 aspect ratio (square)
  // Use the smaller grid dimension to ensure the square fits within the grid cells
  let finalSize = getCSSVariableValue("--landing-center-card-final-grid-size");
  if (finalSize === 0) {
    // Fallback if not set or zero, recalculate
    const maxGridWidth = cellWidth * centerSizeConst;
    const maxGridHeight = cellHeight * centerSizeConst;
    finalSize = Math.min(maxGridWidth, maxGridHeight);
  }

  // Use the smaller dimension for the starting size to maintain aspect ratio
  let startSize = getCSSVariableValue(
    "--landing-center-card-current-start-size",
  );
  if (startSize === 0) {
    // Fallback if not set or zero, recalculate
    const maxStartSizeFallback = getCSSVariableValue(
      "--landing-center-card-start-size",
      600,
    );
    const viewportFactorFallback = getCSSVariableValue(
      "--landing-center-card-viewport-size-factor",
      0.6,
    );
    startSize = Math.min(
      maxStartSizeFallback,
      Math.min(viewportWidth, viewportHeight) * viewportFactorFallback,
    );
  }

  // Current properties based on expansion phase
  // Always maintain square (1:1) aspect ratio
  const currentSize = startSize + (finalSize - startSize) * expansionPhase;

  const currentCenterX =
    startCenterX + (gridCenterX - startCenterX) * expansionPhase;
  const currentCenterY =
    startCenterY + (gridCenterY - startCenterY) * expansionPhase;

  return {
    size: currentSize,
    width: currentSize, // Square: width = height
    height: currentSize, // Square: width = height
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

export const useLandingCSSVariables = () => {
  useEffect(() => {
    const updateCSSVariables = () => {
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      // Container dimensions (accounting for padding)
      // These are also set as CSS variables for direct use in CSS if needed
      const containerWidth = viewportWidth - 64; // 32px padding on each side
      const containerHeight = viewportHeight - 128; // 64px padding on top/bottom

      // Calculate separate cell dimensions to fit within the container
      const cellWidth = containerWidth / GRID_SIZE;
      const cellHeight = containerHeight / GRID_SIZE;

      // Grid dimensions
      const gridWidth = containerWidth;
      const gridHeight = containerHeight;

      // Offsets
      const gridOffsetX = 32; // As per original calculateGridLayout
      const gridOffsetY = 64; // As per original calculateGridLayout

      const root = document.documentElement;
      root.style.setProperty(
        "--landing-container-width",
        `${containerWidth}px`,
      );
      root.style.setProperty(
        "--landing-container-height",
        `${containerHeight}px`,
      );
      root.style.setProperty("--landing-grid-cell-width", `${cellWidth}px`);
      root.style.setProperty("--landing-grid-cell-height", `${cellHeight}px`);
      root.style.setProperty("--landing-grid-width", `${gridWidth}px`);
      root.style.setProperty("--landing-grid-height", `${gridHeight}px`);
      root.style.setProperty("--landing-grid-offset-x", `${gridOffsetX}px`);
      root.style.setProperty("--landing-grid-offset-y", `${gridOffsetY}px`);
      root.style.setProperty("--landing-grid-size", GRID_SIZE.toString());
      // Add other variables from constants.ts if they are needed for dynamic CSS calculations
      root.style.setProperty(
        "--landing-center-start-grid-units",
        CENTER_START.toString(),
      );
      root.style.setProperty(
        "--landing-center-size-grid-units",
        CENTER_SIZE.toString(),
      );

      // Update CenterCard related CSS variables if they depend on viewport/grid
      // Example: Start size might be viewport dependent
      const centerCardStartSize = Math.min(
        parseFloat(
          getComputedStyle(root).getPropertyValue(
            "--landing-center-card-start-size",
          ),
        ) || 600,
        Math.min(viewportWidth, viewportHeight) *
          (parseFloat(
            getComputedStyle(root).getPropertyValue(
              "--landing-center-card-viewport-size-factor",
            ),
          ) || 0.6),
      );
      root.style.setProperty(
        "--landing-center-card-current-start-size",
        `${centerCardStartSize}px`,
      );

      // Final size of the center card when in grid (derived from cell dimensions)
      const maxGridWidthForCenter = cellWidth * CENTER_SIZE;
      const maxGridHeightForCenter = cellHeight * CENTER_SIZE;
      const centerCardFinalSize = Math.min(
        maxGridWidthForCenter,
        maxGridHeightForCenter,
      );
      root.style.setProperty(
        "--landing-center-card-final-grid-size",
        `${centerCardFinalSize}px`,
      );
    };

    updateCSSVariables();
    window.addEventListener("resize", updateCSSVariables);
    return () => window.removeEventListener("resize", updateCSSVariables);
  }, []);
};
