"use client";

import { useState } from "react";
import { cn } from "@repo/ui/lib/utils";
import { PITCH_SLIDES } from "~/config/pitch-deck-data";
import {
  ContentSlideContent,
  CustomTitleSlide,
  CustomClosingSlide,
  ShowcaseSlideContent,
  ColumnsSlideContent,
} from "./slide-content";
import { MobileSlideSheet } from "./mobile-slide-sheet";
import { MobileBottomBar } from "./mobile-bottom-bar";

export function PitchDeckMobile() {
  const [selectedSlideIndex, setSelectedSlideIndex] = useState<number | null>(null);

  return (
    <main aria-label="Pitch Deck Presentation">
      {/* Vertical scroll container */}
      <div className="space-y-6 px-4 pt-20 pb-24">
        {PITCH_SLIDES.map((slide, index) => (
          <button
            key={slide.id}
            onClick={() => setSelectedSlideIndex(index)}
            className="w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm"
            aria-label={`View slide ${index + 1}: ${slide.title}`}
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
          </button>
        ))}
      </div>

      {/* Tap-to-expand sheet */}
      <MobileSlideSheet
        slideIndex={selectedSlideIndex}
        onClose={() => setSelectedSlideIndex(null)}
        onNavigate={setSelectedSlideIndex}
      />

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
