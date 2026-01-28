"use client";

import { forwardRef } from "react";
import { cn } from "@repo/ui/lib/utils";
import type { PITCH_SLIDES } from "~/config/pitch-deck-data";
import {
  ContentSlideContent,
  CustomTitleSlide,
  CustomClosingSlide,
  ShowcaseSlideContent,
  ColumnsSlideContent,
} from "./slide-content";

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
    // First slide (id: "title") uses the custom grid design
    const isCustomFirstSlide = slide.type === "title" && slide.id === "title";
    // Last slide (id: "vision") uses the custom closing design
    const isCustomClosingSlide = slide.type === "title" && slide.id === "vision";

    return (
      <div
        ref={ref}
        style={{ width, height, "--foreground": "oklch(0.205 0 0)" } as React.CSSProperties}
        className={cn(
          "relative overflow-hidden font-sans antialiased",
          slide.bgColor
        )}
      >
        <div className="relative h-full p-16 flex flex-col justify-between">
          {isCustomFirstSlide ? (
            <CustomTitleSlide slide={slide} variant="fixed" />
          ) : isCustomClosingSlide ? (
            <CustomClosingSlide slide={slide} variant="fixed" />
          ) : slide.type === "showcase" ? (
            <ShowcaseSlideContent slide={slide} variant="fixed" />
          ) : slide.type === "columns" ? (
            <ColumnsSlideContent slide={slide} variant="fixed" />
          ) : (
            <ContentSlideContent slide={slide} variant="fixed" />
          )}
        </div>
      </div>
    );
  }
);
