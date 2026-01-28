"use client";

import { forwardRef } from "react";
import { cn } from "@repo/ui/lib/utils";
import type { PITCH_SLIDES } from "~/config/pitch-deck-data";
import { TitleSlideContent, ContentSlideContent } from "./slide-content";

interface CaptureSlideProps {
  slide: (typeof PITCH_SLIDES)[number];
  width?: number;
  height?: number;
}

/**
 * Static slide component for screenshot capture.
 * Renders at exact dimensions without animations.
 */
export const CaptureSlide = forwardRef<HTMLDivElement, CaptureSlideProps>(
  function CaptureSlide({ slide, width = 1920, height = 1080 }, ref) {
    return (
      <div
        ref={ref}
        style={{ width, height }}
        className={cn("relative overflow-hidden font-sans antialiased", slide.bgColor)}
      >
        <div className="h-full p-16 flex flex-col justify-between">
          {slide.type === "title" ? (
            <TitleSlideContent slide={slide} variant="fixed" />
          ) : (
            <ContentSlideContent slide={slide} variant="fixed" />
          )}
        </div>
      </div>
    );
  }
);
