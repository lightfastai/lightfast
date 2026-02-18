"use client";

import { cn } from "@repo/ui/lib/utils";
import type { PITCH_SLIDES } from "~/config/pitch-deck-data";

type SlideVariant = "responsive" | "fixed";

interface CustomClosingSlideProps {
  slide: Extract<(typeof PITCH_SLIDES)[number], { type: "title" }>;
  variant?: SlideVariant;
}

/**
 * Custom closing slide with contact information
 * Clean design with headline and contact details
 */
export function CustomClosingSlide({
  slide,
  variant = "responsive",
}: CustomClosingSlideProps) {
  const isFixed = variant === "fixed";

  return (
    <div
      className="absolute inset-0 bg-[#F5F5F0] overflow-hidden"
      style={{
        // Override theme colors for this light slide
        // @ts-expect-error CSS custom properties
        "--foreground": "oklch(0.205 0 0)",
      }}
    >
      {/* Main headline - top left */}
      <h1
        className={cn(
          "absolute font-normal text-foreground tracking-tight",
          isFixed
            ? "left-16 top-16 text-7xl max-w-[600px]"
            : "left-6 top-6 sm:left-8 sm:top-8 md:left-12 md:top-12 text-2xl sm:text-3xl md:text-4xl lg:text-5xl max-w-[50%]",
        )}
      >
        {slide.title}
      </h1>

      {/* Bottom section - contact label and details aligned */}
      <div
        className={cn(
          "absolute flex items-start text-foreground",
          isFixed
            ? "left-16 right-16 bottom-16"
            : "left-6 right-6 bottom-6 sm:left-8 sm:right-8 sm:bottom-8 md:left-12 md:right-12 md:bottom-12",
        )}
      >
        {/* Contact label - left */}
        <span
          className={cn(
            "font-medium tracking-wide",
            isFixed ? "text-sm" : "text-[10px] sm:text-xs",
          )}
        >
          CONTACT US
        </span>

        {/* Contact details - center */}
        <div
          className={cn(
            "flex-1 flex justify-center",
            isFixed ? "text-lg" : "text-xs sm:text-sm",
          )}
        >
          <div className={isFixed ? "space-y-8" : "space-y-16"}>
            <div className={isFixed ? "space-y-1" : "space-y-0.5"}>
              <p>51 Grosvenor St</p>
              <p>South Yarra, VIC</p>
              <p>Australia</p>
            </div>
            <div className={isFixed ? "space-y-1" : "space-y-0.5"}>
              <p>{slide.subtitle}</p>
              <p>lightfast.ai</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
