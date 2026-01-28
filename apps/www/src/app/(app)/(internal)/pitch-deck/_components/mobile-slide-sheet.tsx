"use client";

import { useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@repo/ui/lib/utils";
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
} from "@repo/ui/components/ui/drawer";
import { Button } from "@repo/ui/components/ui/button";
import { PITCH_SLIDES } from "~/config/pitch-deck-data";
import {
  ContentSlideContent,
  CustomTitleSlide,
  CustomClosingSlide,
  ShowcaseSlideContent,
  ColumnsSlideContent,
} from "./slide-content";

interface MobileSlideSheetProps {
  slideIndex: number | null;
  onClose: () => void;
  onNavigate?: (index: number) => void;
}

export function MobileSlideSheet({
  slideIndex,
  onClose,
  onNavigate,
}: MobileSlideSheetProps) {
  const isOpen = slideIndex !== null;
  const slide = slideIndex !== null ? PITCH_SLIDES[slideIndex] : null;

  const handlePrev = useCallback(() => {
    if (slideIndex !== null && slideIndex > 0) {
      onNavigate?.(slideIndex - 1);
    }
  }, [slideIndex, onNavigate]);

  const handleNext = useCallback(() => {
    if (slideIndex !== null && slideIndex < PITCH_SLIDES.length - 1) {
      onNavigate?.(slideIndex + 1);
    }
  }, [slideIndex, onNavigate]);

  // Keyboard navigation within sheet
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        handlePrev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        handleNext();
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handlePrev, handleNext, onClose]);

  return (
    <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent className="max-h-[90vh] outline-none">
        <DrawerTitle className="sr-only">
          {slide && slideIndex !== null ? `Slide ${slideIndex + 1}: ${slide.title}` : "Slide viewer"}
        </DrawerTitle>

        {/* Header with close and navigation */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </Button>

          <span className="text-sm text-muted-foreground tabular-nums">
            {slideIndex !== null ? slideIndex + 1 : 0} / {PITCH_SLIDES.length}
          </span>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={handlePrev}
              disabled={slideIndex === 0}
              aria-label="Previous slide"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleNext}
              disabled={slideIndex === PITCH_SLIDES.length - 1}
              aria-label="Next slide"
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Slide content - scrollable with pinch-to-zoom via touch-action */}
        <div className="flex-1 overflow-auto p-4 touch-pan-x touch-pan-y touch-pinch-zoom">
          {slide && (
            <div
              className={cn(
                "w-full aspect-[16/9] rounded-sm overflow-hidden shadow-lg",
                slide.bgColor
              )}
              style={{ "--foreground": "oklch(0.205 0 0)" } as React.CSSProperties}
            >
              <div className="relative h-full p-6 flex flex-col justify-between">
                <SheetSlideContent slide={slide} />
              </div>
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

function SheetSlideContent({ slide }: { slide: (typeof PITCH_SLIDES)[number] }) {
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
