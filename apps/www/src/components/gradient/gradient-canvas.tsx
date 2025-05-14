"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";

import "context-filter-polyfill";

import { applyGrainEffect } from "~/lib/gradient-utils/effects";
import { debounce } from "~/lib/gradient-utils/gradient-utils";
import { drawShape, generateRandomShape } from "~/lib/gradient-utils/shapes";

export interface GradientCanvasProps {
  width: number;
  height: number;
  backgroundColor: string;
  circles: { color: string; cx: number; cy: number }[];
  blur: number;
  brightness: number;
  contrast: number;
  saturation: number;
  grainIntensity: number;
}

export function GradientCanvas({
  width,
  height,
  backgroundColor,
  circles,
  blur,
  brightness,
  contrast,
  saturation,
  grainIntensity,
}: GradientCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const backgroundLayerRef = useRef<HTMLCanvasElement | null>(null);

  const debouncedRender = useMemo(
    () => debounce((fn: () => void) => fn(), 16),
    [],
  );

  // Initialize background canvas
  useEffect(() => {
    if (!backgroundLayerRef.current) {
      backgroundLayerRef.current = document.createElement("canvas");
    }

    if (backgroundLayerRef.current) {
      backgroundLayerRef.current.width = width;
      backgroundLayerRef.current.height = height;
    }
  }, [width, height]);

  // Draw background and shapes
  useEffect(() => {
    if (!backgroundLayerRef.current) return;
    const ctx = backgroundLayerRef.current.getContext("2d");

    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, width, height);

    circles.forEach((circle) => {
      const shape = generateRandomShape(circle.color);
      drawShape(ctx, shape, circle);
    });

    debouncedRender(renderCanvas);
  }, [backgroundColor, circles, width, height, debouncedRender]);

  // Handle filters
  useEffect(() => {
    debouncedRender(renderCanvas);
  }, [blur, brightness, contrast, saturation, grainIntensity, debouncedRender]);

  const renderCanvas = useCallback(() => {
    if (!canvasRef.current || !backgroundLayerRef.current) return;

    const ctx = canvasRef.current.getContext("2d", {
      alpha: true,
      willReadFrequently: false,
    });

    if (!ctx) return;

    // Clear main canvas
    ctx.clearRect(0, 0, width, height);

    // Draw solid background color first (no filters)
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, width, height);

    // Apply filters to shapes/gradients
    const cssFilters = [
      blur > 0 ? `blur(${blur / 4}px)` : "",
      `brightness(${brightness}%)`,
      `contrast(${contrast}%)`,
      `saturate(${saturation}%)`,
    ]
      .filter(Boolean)
      .join(" ");

    ctx.filter = cssFilters;
    ctx.drawImage(backgroundLayerRef.current, 0, 0);

    // Apply grain effect
    if (grainIntensity > 0) {
      applyGrainEffect(ctx, grainIntensity / 100);
    }
  }, [
    width,
    height,
    backgroundColor,
    blur,
    brightness,
    contrast,
    saturation,
    grainIntensity,
  ]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{
        width: "100%",
        height: "100%",
        objectFit: "cover",
        position: "absolute",
        top: 0,
        left: 0,
        borderRadius: "0.75rem",
      }}
    />
  );
}
