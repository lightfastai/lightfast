import { useEffect, useState } from "react";

import type { AnimationPhases } from "./types";
import { CENTER_SIZE, CENTER_START, GRID_SIZE } from "./constants";
import { getCSSVariableValue } from "./utils";

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
    textFadePhase: Math.min(wheelProgress / 0.3, 1),
    logoMovePhase: Math.min(Math.max(0, (wheelProgress - 0.1) / 0.4), 1),
    expansionPhase: Math.min(Math.max(0, (wheelProgress - 0.2) / 0.6), 1),
    categoryPhase: Math.min(Math.max(0, (wheelProgress - 0.5) / 0.5), 1),
  };
};

export const useLandingCSSVariables = () => {
  const wheelProgress = useWheelProgress();
  const animationPhases = useAnimationPhases(wheelProgress);

  useEffect(() => {
    const updateCSSVariables = () => {
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const root = document.documentElement;

      const { expansionPhase, categoryPhase, textFadePhase, logoMovePhase } =
        animationPhases; // Destructure all phases

      // Grid, Container, and CenterCard base values (already being set)
      const containerWidth = viewportWidth - 64;
      const containerHeight = viewportHeight - 128;
      const cellWidth = containerWidth / GRID_SIZE;
      const cellHeight = containerHeight / GRID_SIZE;
      const gridWidth = containerWidth;
      const gridHeight = containerHeight;
      const gridOffsetX = 32;
      const gridOffsetY = 64;

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
      root.style.setProperty(
        "--landing-center-start-grid-units",
        CENTER_START.toString(),
      );
      root.style.setProperty(
        "--landing-center-size-grid-units",
        CENTER_SIZE.toString(),
      );

      root.style.setProperty(
        "--landing-center-card-expansion-factor",
        expansionPhase.toString(),
      );
      root.style.setProperty(
        "--grid-lines-opacity",
        (1 - expansionPhase * 0.8).toString(),
      );
      root.style.setProperty(
        "--integration-container-opacity",
        (expansionPhase > 0.3 ? categoryPhase : 0).toString(),
      );
      root.style.setProperty(
        "--integration-card-opacity",
        categoryPhase.toString(),
      );
      root.style.setProperty(
        "--integration-card-scale",
        (0.8 + categoryPhase * 0.2).toString(),
      );

      const ccBaseStartSize = getCSSVariableValue(
        "--landing-center-card-base-start-size",
        600,
      );
      const ccViewportFactor = getCSSVariableValue(
        "--landing-center-card-viewport-size-factor",
        0.6,
      );
      const ccCalculatedStartSize = Math.min(
        ccBaseStartSize,
        Math.min(viewportWidth, viewportHeight) * ccViewportFactor,
      );
      const ccCenterStartConst = CENTER_START;
      const ccCenterSizeConst = CENTER_SIZE;
      const ccMaxGridWidthForCenter = cellWidth * ccCenterSizeConst;
      const ccMaxGridHeightForCenter = cellHeight * ccCenterSizeConst;
      const ccCalculatedFinalSize = Math.min(
        ccMaxGridWidthForCenter,
        ccMaxGridHeightForCenter,
      );
      const ccFinalGridX =
        gridOffsetX + (ccCenterStartConst + ccCenterSizeConst / 2) * cellWidth;
      const ccFinalGridY =
        gridOffsetY + (ccCenterStartConst + ccCenterSizeConst / 2) * cellHeight;
      const ccStartX = viewportWidth / 2;
      const ccStartY = viewportHeight / 2;
      const globalCurrentWidth =
        ccCalculatedStartSize +
        (ccCalculatedFinalSize - ccCalculatedStartSize) * expansionPhase;
      const globalCurrentCenterX =
        ccStartX + (ccFinalGridX - ccStartX) * expansionPhase;
      const globalCurrentCenterY =
        ccStartY + (ccFinalGridY - ccStartY) * expansionPhase;
      root.style.setProperty(
        "--global-cc-current-width",
        `${globalCurrentWidth}px`,
      );
      root.style.setProperty(
        "--global-cc-current-height",
        `${globalCurrentWidth}px`,
      );
      root.style.setProperty(
        "--global-cc-current-left",
        `${globalCurrentCenterX - globalCurrentWidth / 2}px`,
      );
      root.style.setProperty(
        "--global-cc-current-top",
        `${globalCurrentCenterY - globalCurrentWidth / 2}px`,
      );
      root.style.setProperty(
        "--global-cc-current-center-x",
        `${globalCurrentCenterX}px`,
      );
      root.style.setProperty(
        "--global-cc-current-center-y",
        `${globalCurrentCenterY}px`,
      );

      // NEW: Set phase-based opacity/scale variables
      const gridLinesOpacity = 1 - expansionPhase * 0.8;
      const integrationContainerOpacity =
        expansionPhase > 0.3 ? categoryPhase : 0;
      const integrationCardOpacity = categoryPhase;
      const integrationCardScale = 0.8 + categoryPhase * 0.2;

      root.style.setProperty(
        "--grid-lines-opacity",
        gridLinesOpacity.toString(),
      );
      root.style.setProperty(
        "--integration-container-opacity",
        integrationContainerOpacity.toString(),
      );
      root.style.setProperty(
        "--integration-card-opacity",
        integrationCardOpacity.toString(),
      );
      root.style.setProperty(
        "--integration-card-scale",
        integrationCardScale.toString(),
      );

      // Ensure these are actually set
      root.style.setProperty("--text-fade-factor", textFadePhase.toString());
      root.style.setProperty("--logo-move-factor", logoMovePhase.toString());
    };

    updateCSSVariables();
    window.addEventListener("resize", updateCSSVariables);
  }, [animationPhases]);
};
