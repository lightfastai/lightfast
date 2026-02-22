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

      {/* Centered logo + title + tagline */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <div
          className={cn(
            "flex items-center text-white",
            isFixed
              ? "gap-5"
              : "gap-2 sm:gap-2.5 md:gap-3 lg:gap-4",
          )}
        >
          <Icons.logoShort
            className={cn(
              "text-white shrink-0 [&_path]:[stroke-width:18]",
              isFixed
                ? "w-14 h-14"
                : "w-7 h-7 sm:w-9 sm:h-9 md:w-10 md:h-10 lg:w-12 lg:h-12",
            )}
          />
          <h1
            className={cn(
              "font-medium",
              isFixed ? "text-8xl" : "text-3xl sm:text-4xl md:text-5xl lg:text-6xl",
            )}
            style={{
              fontFamily: "var(--font-pp-supply-sans)",
              letterSpacing: "0.05em",
              lineHeight: 1,
              transform: "translateY(0.06em)",
            }}
          >
            {slide.title}
          </h1>
        </div>
        {slide.subtitle && (
          <p
            className={cn(
              "text-white font-medium text-center",
              isFixed
                ? "mt-6 text-xl max-w-[600px]"
                : "mt-3 sm:mt-4 md:mt-5 text-xs sm:text-sm md:text-base lg:text-lg max-w-[80%] sm:max-w-[70%] md:max-w-[500px]",
            )}
          >
            {slide.subtitle}
          </p>
        )}
      </div>
    </div>
  );
}
