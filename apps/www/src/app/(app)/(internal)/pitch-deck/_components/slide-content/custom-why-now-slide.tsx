import { cn } from "@repo/ui/lib/utils";
import Image from "next/image";
import type { PITCH_SLIDES } from "~/config/pitch-deck-data";
import type { SlideVariant } from "./title-slide-content";

interface CustomWhyNowSlideProps {
  slide: Extract<(typeof PITCH_SLIDES)[number], { type: "why-now" }>;
  variant?: SlideVariant;
}

export function CustomWhyNowSlide({
  slide,
  variant = "responsive",
}: CustomWhyNowSlideProps) {
  const isFixed = variant === "fixed";

  return (
    <div className="absolute inset-0 overflow-hidden bg-[#F5F5F0]">
      {/* Red accent strip — wide, ~28% of slide */}
      <div
        className={cn(
          "absolute inset-y-0 left-0 bg-[var(--pitch-deck-red)]",
          isFixed ? "w-[28%]" : "w-[20%] sm:w-[24%] md:w-[28%]"
        )}
      />

      {/* Content layer */}
      <div
        className={cn(
          "relative flex h-full flex-col",
          isFixed
            ? "py-12 pr-12 pl-[20%]"
            : "py-4 pr-4 pl-[14%] sm:py-6 sm:pr-6 sm:pl-[16%] md:py-10 md:pr-10 md:pl-[20%]"
        )}
      >
        {/* Main content: image left + title & bullets right */}
        <div
          className={cn(
            "grid flex-1 items-center",
            isFixed
              ? "grid-cols-[1.2fr_1fr] gap-10"
              : "grid-cols-1 gap-4 sm:grid-cols-[1.2fr_1fr] sm:gap-6 md:gap-8"
          )}
        >
          {/* Image — bleeds back into the red accent */}
          <div
            className={cn(
              "flex flex-col justify-end self-end",
              isFixed ? "-ml-[35%]" : "-ml-[20%] sm:-ml-[28%] md:-ml-[35%]"
            )}
          >
            <div className="relative overflow-hidden rounded-lg shadow-lg">
              <Image
                alt={slide.imageAlt}
                className="h-auto w-full"
                height={600}
                src={slide.image}
                width={800}
              />
            </div>
          </div>

          {/* Title + numbered bullets */}
          <div className="flex flex-col justify-center">
            <h2
              className={cn(
                "font-normal text-foreground",
                isFixed
                  ? "mb-8 text-5xl"
                  : "mb-4 text-xl sm:mb-6 sm:text-2xl md:text-3xl"
              )}
            >
              {slide.title}
            </h2>
            {slide.rightText.map((text, idx) => (
              <div
                className={cn(
                  "border-neutral-300 border-b",
                  isFixed ? "py-4" : "py-2 sm:py-3",
                  idx === 0 && "border-t"
                )}
                key={`bullet-${idx}`}
              >
                <div className="flex items-baseline gap-3">
                  <span
                    className={cn(
                      "shrink-0 font-semibold text-[var(--pitch-deck-red)] tabular-nums",
                      isFixed ? "text-lg" : "text-xs sm:text-sm"
                    )}
                  >
                    {String(idx + 1).padStart(2, "0")}
                  </span>
                  <p
                    className={cn(
                      "text-neutral-700",
                      isFixed
                        ? "text-base leading-snug"
                        : "text-[11px] leading-snug sm:text-xs md:text-sm"
                    )}
                  >
                    {text}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
