import { cn } from "@repo/ui/lib/utils";
import type { PITCH_SLIDES } from "~/config/pitch-deck-data";
import type { SlideVariant } from "./title-slide-content";

interface CustomTeamSlideProps {
  slide: Extract<(typeof PITCH_SLIDES)[number], { type: "team" }>;
  variant?: SlideVariant;
}

export function CustomTeamSlide({
  slide,
  variant = "responsive",
}: CustomTeamSlideProps) {
  const isFixed = variant === "fixed";

  return (
    <div className={cn("flex h-full w-full items-center", slide.textColor)}>
      {/* Content: branded founder block + tracks */}
      <div
        className={cn(
          "flex w-full",
          isFixed ? "gap-10 h-[85%]" : "gap-3 sm:gap-5 md:gap-8 h-[80%] sm:h-[85%]"
        )}
      >
        {/* Founder identity block */}
        <div
          className={cn(
            "flex flex-col justify-end rounded-2xl bg-[var(--pitch-deck-red)] text-white",
            isFixed
              ? "w-[38%] p-10"
              : "w-[35%] sm:w-[38%] p-3 sm:p-5 md:p-8"
          )}
        >
          <div className="mt-auto">
            <p
              className={cn(
                "font-medium",
                isFixed ? "text-3xl" : "text-sm sm:text-lg md:text-2xl"
              )}
            >
              {slide.founder.name}
            </p>
            <p
              className={cn(
                "text-white/80 mt-1",
                isFixed ? "text-lg" : "text-[10px] sm:text-xs md:text-sm"
              )}
            >
              {slide.founder.role}
            </p>
            <p
              className={cn(
                "text-white/60",
                isFixed ? "text-sm mt-1" : "text-[9px] sm:text-[10px] md:text-xs mt-0.5"
              )}
            >
              {slide.founder.location}
            </p>
            <p
              className={cn(
                "text-white/90 leading-snug",
                isFixed
                  ? "text-base mt-6 border-t border-white/20 pt-6"
                  : "text-[10px] sm:text-xs md:text-sm mt-3 sm:mt-4 border-t border-white/20 pt-3 sm:pt-4"
              )}
            >
              {slide.founder.tagline}
            </p>
          </div>
        </div>

        {/* Tracks */}
        <div
          className={cn(
            "flex flex-1 flex-col justify-center",
            isFixed ? "gap-6" : "gap-2 sm:gap-3 md:gap-4"
          )}
        >
          {slide.tracks.map((track) => (
            <div key={track.header}>
              <p
                className={cn(
                  "uppercase tracking-wider font-medium text-[var(--pitch-deck-red)]",
                  isFixed
                    ? "text-sm mb-3"
                    : "text-[9px] sm:text-[10px] md:text-xs mb-1 sm:mb-2"
                )}
              >
                {track.header}
              </p>
              <div
                className={cn(
                  "flex flex-col",
                  isFixed ? "gap-2" : "gap-0.5 sm:gap-1"
                )}
              >
                {track.items.map((item, idx) => (
                  <p
                    key={`${track.header}-${idx}`}
                    className={cn(
                      "border-b border-neutral-300 text-neutral-700",
                      isFixed
                        ? "text-base pb-2 leading-snug"
                        : "text-[10px] sm:text-xs md:text-sm pb-1 sm:pb-1.5 leading-snug"
                    )}
                  >
                    {item}
                  </p>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
