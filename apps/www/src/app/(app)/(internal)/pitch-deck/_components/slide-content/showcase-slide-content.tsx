import { cn } from "@repo/ui/lib/utils";
import type { PITCH_SLIDES } from "~/config/pitch-deck-data";
import type { SlideVariant } from "./title-slide-content";

interface ShowcaseSlideContentProps {
  slide: Extract<(typeof PITCH_SLIDES)[number], { type: "showcase" }>;
  variant?: SlideVariant;
}

export function ShowcaseSlideContent({
  slide,
  variant = "responsive",
}: ShowcaseSlideContentProps) {
  const isFixed = variant === "fixed";

  return (
    <div className={cn("flex h-full w-full flex-col", slide.textColor)}>
      {/* Title at top */}
      <h2
        className={cn(
          "font-normal tracking-tight text-foreground",
          isFixed
            ? "mb-16 text-6xl"
            : "mb-6 text-xl sm:mb-8 sm:text-2xl md:mb-12 md:text-4xl lg:text-5xl"
        )}
      >
        {slide.title}
      </h2>

      {/* Content area: branded block left, metadata right */}
      <div
        className={cn(
          "flex flex-1",
          isFixed ? "gap-12" : "gap-4 sm:gap-6 md:gap-8"
        )}
      >
        {/* Branded color block (pitch-deck-red) */}
        <div
          className={cn(
            "rounded-2xl bg-[var(--pitch-deck-red)]",
            isFixed ? "w-[55%]" : "w-[50%] sm:w-[55%]"
          )}
        />

        {/* Metadata table */}
        <div
          className={cn(
            "flex flex-1 flex-col justify-end",
            isFixed ? "gap-6" : "gap-2 sm:gap-3 md:gap-4"
          )}
        >
          {slide.metadata.map((item) => (
            <div
              key={item.label}
              className={cn(
                "border-b border-neutral-300",
                isFixed ? "pb-4" : "pb-1.5 sm:pb-2 md:pb-3"
              )}
            >
              <div className="flex items-center justify-between">
                <span
                  className={cn(
                    "font-medium uppercase tracking-wider text-neutral-500",
                    isFixed ? "text-sm" : "text-[9px] sm:text-[10px] md:text-xs"
                  )}
                >
                  {item.label}
                </span>
                <span
                  className={cn(
                    "text-neutral-700",
                    "badge" in item && item.badge
                      ? "rounded bg-neutral-200 px-2 py-0.5"
                      : "",
                    isFixed ? "text-lg" : "text-[10px] sm:text-xs md:text-sm"
                  )}
                >
                  {item.value}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
