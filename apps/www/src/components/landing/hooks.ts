import { useEffect, useState } from "react";

import type {
  AnimationPhases,
  CenterCard,
  GridLayout,
  ViewportSize,
} from "./types";
import { CENTER_SIZE, CENTER_START, GRID_SIZE } from "./constants";
import { getCSSVariableValue } from "./utils"; // Import the helper

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
export const calculateCenterCard = (expansionPhase: number): CenterCard => {
  if (typeof window !== "undefined") {
    document.documentElement.style.setProperty(
      "--landing-center-card-expansion-factor",
      expansionPhase.toString(),
    );
  }

  // Temporarily, we need to reconstruct the CenterCard object by reading the interpolated CSS variables
  // This is until CenterCard.tsx itself is refactored to use these CSS variables directly for its style.
  const startSize = getCSSVariableValue(
    "--landing-center-card-current-start-size-val",
  );
  const finalSize = getCSSVariableValue(
    "--landing-center-card-final-grid-size-val",
  );

  const startX =
    (getCSSVariableValue("--landing-center-card-start-x-vw") / 100) *
    (typeof window !== "undefined" ? window.innerWidth : 0); // Convert vw to px
  const startY =
    (getCSSVariableValue("--landing-center-card-start-y-vh") / 100) *
    (typeof window !== "undefined" ? window.innerHeight : 0); // Convert vh to px

  const finalX = getCSSVariableValue("--landing-center-card-final-x-grid-val");
  const finalY = getCSSVariableValue("--landing-center-card-final-y-grid-val");

  const currentSize = startSize + (finalSize - startSize) * expansionPhase;
  const currentCenterX = startX + (finalX - startX) * expansionPhase;
  const currentCenterY = startY + (finalY - startY) * expansionPhase;

  // Ensure gridCenterX and gridCenterY (which are static) are also part of the return if CenterCardType expects them
  // These are essentially finalX and finalY if the card moves to the center of the grid cell area
  const gridCenterX = finalX;
  const gridCenterY = finalY;

  return {
    size: currentSize,
    width: currentSize,
    height: currentSize,
    centerX: currentCenterX,
    centerY: currentCenterY,
    left: currentCenterX - currentSize / 2,
    top: currentCenterY - currentSize / 2,
    gridCenterX: gridCenterX, // Added, assuming CenterCardType needs it
    gridCenterY: gridCenterY, // Added, assuming CenterCardType needs it
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
      const root = document.documentElement;

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

      // Calculate and set CenterCard animation state variables
      const centerStartConst = CENTER_START;
      const centerSizeConst = CENTER_SIZE;

      // Start Size (viewport dependent)
      const baseStartSize =
        parseFloat(
          getComputedStyle(root).getPropertyValue(
            "--landing-center-card-start-size",
          ),
        ) || 600;
      const viewportFactor =
        parseFloat(
          getComputedStyle(root).getPropertyValue(
            "--landing-center-card-viewport-size-factor",
          ),
        ) || 0.6;
      const calculatedStartSize = Math.min(
        baseStartSize,
        Math.min(viewportWidth, viewportHeight) * viewportFactor,
      );
      root.style.setProperty(
        "--landing-center-card-current-start-size-val",
        `${calculatedStartSize}px`,
      );

      // Final Size (grid dependent)
      const maxGridWidthForCenter = cellWidth * centerSizeConst;
      const maxGridHeightForCenter = cellHeight * centerSizeConst;
      const calculatedFinalSize = Math.min(
        maxGridWidthForCenter,
        maxGridHeightForCenter,
      );
      root.style.setProperty(
        "--landing-center-card-final-grid-size-val",
        `${calculatedFinalSize}px`,
      );

      // Final X and Y in grid context (these are static once grid is known)
      const finalGridX =
        gridOffsetX + (centerStartConst + centerSizeConst / 2) * cellWidth;
      const finalGridY =
        gridOffsetY + (centerStartConst + centerSizeConst / 2) * cellHeight;
      root.style.setProperty(
        "--landing-center-card-final-x-grid-val",
        `${finalGridX}px`,
      );
      root.style.setProperty(
        "--landing-center-card-final-y-grid-val",
        `${finalGridY}px`,
      );

      // Initial X and Y are based on viewport center, defined in CSS as 50vw, 50vh by default
      // So, --landing-center-card-start-x-vw and --landing-center-card-start-y-vh are used directly by CSS
    };

    updateCSSVariables();
    window.addEventListener("resize", updateCSSVariables);
    return () => window.removeEventListener("resize", updateCSSVariables);
  }, []);
};
