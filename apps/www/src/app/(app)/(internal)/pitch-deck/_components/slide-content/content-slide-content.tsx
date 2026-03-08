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
      <div className="flex flex-1 flex-col justify-end">
        <div
          className={cn(
            "grid",
            isFixed
              ? "grid-cols-2 gap-16"
              : "grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-8"
          )}
        >
          <p
            className={cn(
              "text-neutral-500 uppercase tracking-wider",
              isFixed ? "text-base" : "text-[10px] sm:text-xs"
            )}
          >
            {slide.leftText}
          </p>
          <div className={cn(isFixed ? "space-y-6" : "space-y-2 sm:space-y-4")}>
            {slide.rightText.map((text, textIdx) => (
              <p
                className={cn(
                  "border-neutral-300 border-b text-neutral-700",
                  isFixed ? "pb-4 text-xl" : "pb-2 text-xs sm:text-sm"
                )}
                key={`right-text-${textIdx}`}
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
