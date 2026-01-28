"use client";

import { cn } from "@repo/ui/lib/utils";
import { PITCH_SLIDES } from "~/config/pitch-deck-data";
import {
  ContentSlideContent,
  CustomTitleSlide,
  CustomClosingSlide,
  ShowcaseSlideContent,
  ColumnsSlideContent,
} from "./slide-content";
import { MobileBottomBar } from "./mobile-bottom-bar";

export function PitchDeckMobile() {
  return (
    <main aria-label="Pitch Deck Presentation">
      {/* Vertical scroll container */}
      <div className="space-y-6 px-4 pt-20 pb-24">
        {PITCH_SLIDES.map((slide, index) => (
          <article
            key={slide.id}
            aria-label={`Slide ${index + 1}: ${slide.title}`}
          >
            <div
              className={cn(
                "w-full aspect-[16/9] rounded-sm overflow-hidden shadow-lg",
                slide.bgColor
              )}
              style={{ "--foreground": "oklch(0.205 0 0)" } as React.CSSProperties}
            >
              <div className="relative h-full p-4 flex flex-col justify-between">
                <MobileSlideContent slide={slide} />
              </div>
            </div>
          </article>
        ))}
      </div>

      {/* Sticky bottom bar */}
      <MobileBottomBar />
    </main>
  );
}

function MobileSlideContent({ slide }: { slide: (typeof PITCH_SLIDES)[number] }) {
  switch (slide.type) {
    case "title":
      // Handle both title slides: "title" (first) and "vision" (closing)
      if (slide.id === "title") {
        return <CustomTitleSlide slide={slide} variant="responsive" />;
      }
      return <CustomClosingSlide slide={slide} variant="responsive" />;
    case "content":
      return <ContentSlideContent slide={slide} variant="responsive" />;
    case "showcase":
      return <ShowcaseSlideContent slide={slide} variant="responsive" />;
    case "columns":
      return <ColumnsSlideContent slide={slide} variant="responsive" />;
    default:
      return null;
  }
}
