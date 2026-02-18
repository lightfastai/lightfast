"use client";

import { cn } from "@repo/ui/lib/utils";
import type { PITCH_SLIDES } from "~/config/pitch-deck-data";
import type { SlideVariant } from "./title-slide-content";

interface ContentSlideContentProps {
  slide: Extract<(typeof PITCH_SLIDES)[number], { type: "content" }>;
  variant?: SlideVariant;
}

export function ContentSlideContent({
  slide,
  variant = "responsive",
}: ContentSlideContentProps) {
  const isFixed = variant === "fixed";

  return (
    <>
      <h2
        className={cn(
          "font-normal text-foreground",
          isFixed ? "text-5xl" : "text-xl sm:text-2xl md:text-3xl"
        )}
      >
        {slide.title}
      </h2>
      <div className="flex-1 flex flex-col justify-end">
        <div
          className={cn(
            "grid",
            isFixed
              ? "grid-cols-2 gap-16"
              : "grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-8"
          )}
        >
          <p
            className={cn(
              "uppercase tracking-wider text-neutral-500",
              isFixed ? "text-base" : "text-[10px] sm:text-xs"
            )}
          >
            {slide.leftText}
          </p>
          <div className={cn(isFixed ? "space-y-6" : "space-y-2 sm:space-y-4")}>
            {slide.rightText.map((text, idx) => (
              <p
                key={`${text}-${idx}`}
                className={cn(
                  "border-b border-neutral-300 text-neutral-700",
                  isFixed ? "text-xl pb-4" : "text-xs sm:text-sm pb-2"
                )}
              >
                {text}
              </p>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
