import { useEffect, useState } from "react";

import type {
  AnimationPhases,
  CenterCard,
  GridLayout,
  ViewportSize,
} from "./types";
import { CENTER_SIZE, CENTER_START, GRID_SIZE } from "./constants";

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

// Calculate center card properties - Now much simpler
export const calculateCenterCard = (
  expansionPhase: number,
): Partial<CenterCard> => {
  // This function is now almost a NO-OP if useLandingCSSVariables handles the expansion factor.
  // However, page.tsx calls it and expects it to trigger the factor update.
  // For clarity, let useLandingCSSVariables be the single source of truth for updating CSS from JS state.
  // So, this function can be removed if page.tsx calls useLandingCSSVariables which depends on useAnimationPhases.

  // If still called, it should not also set the expansion factor if useLandingCSSVariables does.
  // For now, assume it's still called but its action of setting expansion factor is now inside useLandingCSSVariables.
  return {};
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
  const { expansionPhase } = useAnimationPhases(useWheelProgress()); // Get expansionPhase here

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

      // --- CenterCard State Calculations ---
      const currentExpansionPhase = expansionPhase; // Use the live expansionPhase from the hook state
      root.style.setProperty(
        "--landing-center-card-expansion-factor",
        currentExpansionPhase.toString(),
      );

      // Static values (can also be read from existing CSS vars if preferred)
      const ccBaseStartSize =
        parseFloat(
          getComputedStyle(root).getPropertyValue(
            "--landing-center-card-start-size",
          ),
        ) || 600;
      const ccViewportFactor =
        parseFloat(
          getComputedStyle(root).getPropertyValue(
            "--landing-center-card-viewport-size-factor",
          ),
        ) || 0.6;
      const ccCalculatedStartSize = Math.min(
        ccBaseStartSize,
        Math.min(viewportWidth, viewportHeight) * ccViewportFactor,
      );
      // root.style.setProperty('--landing-center-card-current-start-size-val', `${ccCalculatedStartSize}px`); // This was an intermediate step, now used directly below

      const ccCenterStartConst = CENTER_START;
      const ccCenterSizeConst = CENTER_SIZE;
      const ccMaxGridWidthForCenter = cellWidth * ccCenterSizeConst;
      const ccMaxGridHeightForCenter = cellHeight * ccCenterSizeConst;
      const ccCalculatedFinalSize = Math.min(
        ccMaxGridWidthForCenter,
        ccMaxGridHeightForCenter,
      );
      // root.style.setProperty('--landing-center-card-final-grid-size-val', `${ccCalculatedFinalSize}px`); // Intermediate, used below

      const ccFinalGridX =
        gridOffsetX + (ccCenterStartConst + ccCenterSizeConst / 2) * cellWidth;
      const ccFinalGridY =
        gridOffsetY + (ccCenterStartConst + ccCenterSizeConst / 2) * cellHeight;
      // root.style.setProperty('--landing-center-card-final-x-grid-val', `${ccFinalGridX}px`); // Intermediate, used below
      // root.style.setProperty('--landing-center-card-final-y-grid-val', `${ccFinalGridY}px`); // Intermediate, used below

      const ccStartX = viewportWidth / 2;
      const ccStartY = viewportHeight / 2;

      // Calculate CURRENT interpolated values for CenterCard and set them globally
      const globalCurrentWidth =
        ccCalculatedStartSize +
        (ccCalculatedFinalSize - ccCalculatedStartSize) * currentExpansionPhase;
      const globalCurrentCenterX =
        ccStartX + (ccFinalGridX - ccStartX) * currentExpansionPhase;
      const globalCurrentCenterY =
        ccStartY + (ccFinalGridY - ccStartY) * currentExpansionPhase;

      root.style.setProperty(
        "--global-cc-current-width",
        `${globalCurrentWidth}px`,
      );
      root.style.setProperty(
        "--global-cc-current-height",
        `${globalCurrentWidth}px`,
      ); // Assuming square
      root.style.setProperty(
        "--global-cc-current-left",
        `${globalCurrentCenterX - globalCurrentWidth / 2}px`,
      );
      root.style.setProperty(
        "--global-cc-current-top",
        `${globalCurrentCenterY - globalCurrentWidth / 2}px`,
      );
      // Also set center positions if needed by other components, though left/top/width/height should be enough
      root.style.setProperty(
        "--global-cc-current-center-x",
        `${globalCurrentCenterX}px`,
      );
      root.style.setProperty(
        "--global-cc-current-center-y",
        `${globalCurrentCenterY}px`,
      );
    };

    // Need to call updateCSSVariables when expansionPhase changes as well, not just resize
    updateCSSVariables();
    window.addEventListener("resize", updateCSSVariables);
    // No direct dependency on expansionPhase in useEffect here, as updateCSSVariables reads it from its own scope.
    // However, this means this effect only runs on mount/resize. If expansionPhase drives these variables,
    // this effect needs to re-run when expansionPhase changes.

    return () => window.removeEventListener("resize", updateCSSVariables);
  }, [expansionPhase]); // ADD expansionPhase as a dependency
};
