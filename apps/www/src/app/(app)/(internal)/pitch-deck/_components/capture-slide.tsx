"use client";

import { cn } from "@repo/ui/lib/utils";
import { forwardRef } from "react";
import type { PITCH_SLIDES } from "~/config/pitch-deck-data";
import { resolveSlideComponent } from "./slide-content";

interface CaptureSlideProps {
  fontFamily?: string;
  height?: number;
  slide: (typeof PITCH_SLIDES)[number];
  width?: number;
}

/**
 * Static slide component for screenshot capture.
 * Mirrors the interactive PitchSlide wrapper (same padding, same variant)
 * so the PDF output matches what users see on screen.
 */
export const CaptureSlide = forwardRef<HTMLDivElement, CaptureSlideProps>(
  function CaptureSlide({ slide, width = 860, height = 484, fontFamily }, ref) {
    return (
      <div
        className={cn(
          "relative overflow-hidden font-sans antialiased",
          slide.bgColor
        )}
        ref={ref}
        style={
          {
            width,
            height,
            "--foreground": "oklch(0.205 0 0)",
            ...(fontFamily ? { fontFamily } : {}),
          } as React.CSSProperties
        }
      >
        {/* Match interactive PitchSlide wrapper: p-6 sm:p-8 md:p-12 */}
        <div className="relative flex h-full w-full flex-col justify-between p-6 sm:p-8 md:p-12">
          {resolveSlideComponent(slide, "responsive")}
        </div>
      </div>
    );
  }
);
