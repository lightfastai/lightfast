"use client";

import { cn } from "@repo/ui/lib/utils";
import type { PITCH_SLIDES } from "~/config/pitch-deck-data";

export type SlideVariant = "responsive" | "fixed";

interface TitleSlideContentProps {
  slide: Extract<(typeof PITCH_SLIDES)[number], { type: "title" }>;
  variant?: SlideVariant;
}

export function TitleSlideContent({
  slide,
  variant = "responsive",
}: TitleSlideContentProps) {
  const isFixed = variant === "fixed";

  return (
    <>
      {/* Grid pattern overlay */}
      <div
        className="absolute inset-0 opacity-10 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(to right, white 1px, transparent 1px),
            linear-gradient(to bottom, white 1px, transparent 1px)
          `,
          backgroundSize: "60px 60px",
        }}
      />
      <div className="relative flex-1 flex items-center justify-center">
        <h1
          className={cn(
            "font-bold text-center text-white tracking-tight",
            isFixed
              ? "text-8xl"
              : "text-3xl sm:text-4xl md:text-5xl lg:text-6xl"
          )}
        >
          {slide.title}
        </h1>
      </div>
      <p
        className={cn(
          "relative text-center text-white/70",
          isFixed ? "text-lg" : "text-xs sm:text-sm"
        )}
      >
        {slide.subtitle}
      </p>
    </>
  );
}
