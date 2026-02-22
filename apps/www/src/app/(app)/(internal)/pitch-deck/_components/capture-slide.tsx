"use client";

import { forwardRef } from "react";
import { cn } from "@repo/ui/lib/utils";
import type { PITCH_SLIDES } from "~/config/pitch-deck-data";
import { resolveSlideComponent } from "./slide-content";

interface CaptureSlideProps {
  slide: (typeof PITCH_SLIDES)[number];
  width?: number;
  height?: number;
  fontFamily?: string;
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
        ref={ref}
        style={{
          width,
          height,
          "--foreground": "oklch(0.205 0 0)",
          ...(fontFamily ? { fontFamily } : {}),
        } as React.CSSProperties}
        className={cn(
          "relative overflow-hidden font-sans antialiased",
          slide.bgColor
        )}
      >
        {/* Match interactive PitchSlide wrapper: p-6 sm:p-8 md:p-12 */}
        <div className="relative h-full w-full p-6 sm:p-8 md:p-12 flex flex-col justify-between">
          {resolveSlideComponent(slide, "responsive")}
        </div>
      </div>
    );
  }
);
