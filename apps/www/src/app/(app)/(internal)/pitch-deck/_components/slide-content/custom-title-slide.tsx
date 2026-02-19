import { cn } from "@repo/ui/lib/utils";
import { Icons } from "@repo/ui/components/icons";
import type { PITCH_SLIDES } from "~/config/pitch-deck-data";
import type { SlideVariant } from "./title-slide-content";

interface CustomTitleSlideProps {
  slide: Extract<(typeof PITCH_SLIDES)[number], { type: "title" }>;
  variant?: SlideVariant;
}

/**
 * Custom first slide with Flabbergast-inspired grid design
 * Features a grid layout with centered logo
 */
export function CustomTitleSlide({
  slide,
  variant = "responsive",
}: CustomTitleSlideProps) {
  const isFixed = variant === "fixed";

  return (
    <div className="absolute inset-0 bg-[var(--pitch-deck-red)] overflow-hidden">
      {/* Square grid overlay — 16×9 maps to 16:9 aspect ratio */}
      <div className="absolute inset-0 grid grid-cols-16 grid-rows-9 gap-1.5 p-2">
        {Array.from({ length: 144 }).map((_, i) => (
          <div
            key={i}
            className="aspect-square rounded-sm border-[1.5px] border-[var(--pitch-deck-red-overlay)]/30 transition-colors duration-1000 hover:duration-75 hover:bg-[var(--pitch-deck-red-overlay)]"
          />
        ))}
      </div>

      {/* Subtitle */}
      <span
        className={cn(
          "absolute text-white/60 font-normal pointer-events-none",
          isFixed
            ? "left-6 bottom-6 text-sm"
            : "left-4 bottom-4 text-[10px] sm:text-xs",
        )}
      >
        {slide.subtitle}
      </span>

      {/* Centered logo + text */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="flex items-center gap-2 sm:gap-3 md:gap-4">
          <Icons.logoShort
            className={cn(
              "text-white",
              isFixed
                ? "w-16 h-16"
                : "w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 lg:w-14 lg:h-14",
            )}
          />
          <h1
            className={cn(
              "font-normal text-white tracking-tight",
              isFixed
                ? "text-8xl"
                : "text-3xl sm:text-4xl md:text-5xl lg:text-6xl",
            )}
          >
            {slide.title}
          </h1>
        </div>
      </div>
    </div>
  );
}
