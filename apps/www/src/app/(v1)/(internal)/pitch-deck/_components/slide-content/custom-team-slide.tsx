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
          isFixed
            ? "h-[85%] gap-10"
            : "h-[80%] gap-3 sm:h-[85%] sm:gap-5 md:gap-8"
        )}
      >
        {/* Founder identity block */}
        <div
          className={cn(
            "flex flex-col justify-end rounded-2xl bg-[var(--pitch-deck-red)] text-white",
            isFixed ? "w-[38%] p-10" : "w-[35%] p-3 sm:w-[38%] sm:p-5 md:p-8"
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
                "mt-1 text-white/80",
                isFixed ? "text-lg" : "text-[10px] sm:text-xs md:text-sm"
              )}
            >
              {slide.founder.role}
            </p>
            <p
              className={cn(
                "text-white/60",
                isFixed
                  ? "mt-1 text-sm"
                  : "mt-0.5 text-[9px] sm:text-[10px] md:text-xs"
              )}
            >
              {slide.founder.location}
            </p>
            <p
              className={cn(
                "text-white/90 leading-snug",
                isFixed
                  ? "mt-6 border-white/20 border-t pt-6 text-base"
                  : "mt-3 border-white/20 border-t pt-3 text-[10px] sm:mt-4 sm:pt-4 sm:text-xs md:text-sm"
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
                  "font-medium text-[var(--pitch-deck-red)] uppercase tracking-wider",
                  isFixed
                    ? "mb-3 text-sm"
                    : "mb-1 text-[9px] sm:mb-2 sm:text-[10px] md:text-xs"
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
                    className={cn(
                      "border-neutral-300 border-b text-neutral-700",
                      isFixed
                        ? "pb-2 text-base leading-snug"
                        : "pb-1 text-[10px] leading-snug sm:pb-1.5 sm:text-xs md:text-sm"
                    )}
                    key={`${track.header}-${idx}`}
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
