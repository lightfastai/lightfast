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
          {/* Left column: image replaces leftText */}
          <div className="flex items-end">
            <Image
              src={slide.image}
              alt={slide.imageAlt}
              width={600}
              height={400}
              className={cn(
                "rounded-md border border-neutral-200 object-contain w-full h-auto",
                isFixed ? "max-h-[320px]" : "max-h-[160px] sm:max-h-[240px]"
              )}
            />
          </div>

          {/* Right column: text bullets */}
          <div
            className={cn(
              isFixed ? "space-y-6" : "space-y-2 sm:space-y-4"
            )}
          >
            {slide.rightText.map((text, textIdx) => (
              <p
                key={`right-text-${textIdx}`}
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
