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
    <div className="absolute inset-0 bg-[#F5F5F0] overflow-hidden">
      {/* Red accent strip — wide, ~28% of slide */}
      <div
        className={cn(
          "absolute inset-y-0 left-0 bg-[var(--pitch-deck-red)]",
          isFixed ? "w-[28%]" : "w-[20%] sm:w-[24%] md:w-[28%]",
        )}
      />

      {/* Content layer */}
      <div
        className={cn(
          "relative h-full flex flex-col",
          isFixed
            ? "pl-[20%] pr-12 py-12"
            : "pl-[14%] sm:pl-[16%] md:pl-[20%] pr-4 sm:pr-6 md:pr-10 py-4 sm:py-6 md:py-10",
        )}
      >
        {/* Main content: image left + title & bullets right */}
        <div
          className={cn(
            "flex-1 grid items-center",
            isFixed
              ? "grid-cols-[1.2fr_1fr] gap-10"
              : "grid-cols-1 sm:grid-cols-[1.2fr_1fr] gap-4 sm:gap-6 md:gap-8",
          )}
        >
          {/* Image — bleeds back into the red accent */}
          <div
            className={cn(
              "flex flex-col justify-end self-end",
              isFixed
                ? "-ml-[35%]"
                : "-ml-[20%] sm:-ml-[28%] md:-ml-[35%]",
            )}
          >
            <div className="relative overflow-hidden rounded-lg shadow-lg">
              <Image
                src={slide.image}
                alt={slide.imageAlt}
                width={800}
                height={600}
                className="h-auto w-full"
              />
            </div>
          </div>

          {/* Title + numbered bullets */}
          <div className="flex flex-col justify-center">
            <h2
              className={cn(
                "font-normal text-foreground",
                isFixed
                  ? "text-5xl mb-8"
                  : "text-xl sm:text-2xl md:text-3xl mb-4 sm:mb-6",
              )}
            >
              {slide.title}
            </h2>
            {slide.rightText.map((text, idx) => (
              <div
                key={`bullet-${idx}`}
                className={cn(
                  "border-b border-neutral-300",
                  isFixed ? "py-4" : "py-2 sm:py-3",
                  idx === 0 && "border-t",
                )}
              >
                <div className="flex gap-3 items-baseline">
                  <span
                    className={cn(
                      "font-semibold text-[var(--pitch-deck-red)] shrink-0 tabular-nums",
                      isFixed ? "text-lg" : "text-xs sm:text-sm",
                    )}
                  >
                    {String(idx + 1).padStart(2, "0")}
                  </span>
                  <p
                    className={cn(
                      "text-neutral-700",
                      isFixed
                        ? "text-base leading-snug"
                        : "text-[11px] sm:text-xs md:text-sm leading-snug",
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
