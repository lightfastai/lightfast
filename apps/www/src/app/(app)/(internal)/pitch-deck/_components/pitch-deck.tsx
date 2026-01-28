"use client";

import { useRef, useEffect, useState } from "react";
import {
  motion,
  useScroll,
  useTransform,
  useMotionValueEvent,
  AnimatePresence,
} from "framer-motion";
import type { MotionValue } from "framer-motion";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@repo/ui/lib/utils";
import { PITCH_SLIDES } from "~/config/pitch-deck-data";
import { usePitchDeck } from "./pitch-deck-context";
import {
  ContentSlideContent,
  CustomTitleSlide,
  CustomClosingSlide,
  ShowcaseSlideContent,
  ColumnsSlideContent,
} from "./slide-content";

export function PitchDeck() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  const { isGridView, setIsGridView } = usePitchDeck();
  const [currentSlide, setCurrentSlide] = useState(0);

  // Grid view threshold: last slide ends at (totalSlides) / (totalSlides + 1)
  // For 8 slides with +1 extra: 8/9 = 0.889
  // Trigger grid when scroll exceeds ~0.92 (in the extra scroll space)
  const GRID_THRESHOLD = 0.92;

  // Update current slide based on scroll progress
  useMotionValueEvent(scrollYProgress, "change", (latest) => {
    const slideIndex = Math.min(
      Math.floor(latest * PITCH_SLIDES.length),
      PITCH_SLIDES.length - 1,
    );
    if (slideIndex !== currentSlide) {
      setCurrentSlide(slideIndex);
    }

    // Grid view logic
    const shouldBeGrid = latest >= GRID_THRESHOLD;
    if (shouldBeGrid !== isGridView) {
      setIsGridView(shouldBeGrid);
    }
  });

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const scrollAmount = window.innerHeight;

      if (e.key === "ArrowDown" || e.key === " " || e.key === "PageDown") {
        e.preventDefault();
        window.scrollBy({ top: scrollAmount, behavior: "smooth" });
      }
      if (e.key === "ArrowUp" || e.key === "PageUp") {
        e.preventDefault();
        window.scrollBy({ top: -scrollAmount, behavior: "smooth" });
      }
      if (e.key === "Home") {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
      if (e.key === "End") {
        e.preventDefault();
        window.scrollTo({
          top: document.body.scrollHeight,
          behavior: "smooth",
        });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleGridItemClick = (index: number) => {
    const scrollTarget = index * window.innerHeight;
    window.scrollTo({ top: scrollTarget, behavior: "smooth" });
  };

  const handlePrevSlide = () => {
    if (currentSlide > 0) {
      const scrollTarget = (currentSlide - 1) * window.innerHeight;
      window.scrollTo({ top: scrollTarget, behavior: "smooth" });
    }
  };

  const handleNextSlide = () => {
    if (currentSlide < PITCH_SLIDES.length - 1) {
      const scrollTarget = (currentSlide + 1) * window.innerHeight;
      window.scrollTo({ top: scrollTarget, behavior: "smooth" });
    }
  };

  return (
    <main aria-label="Pitch Deck Presentation">
      <div
        ref={containerRef}
        className="relative"
        style={{ height: `${(PITCH_SLIDES.length + 1) * 100}vh` }}
      >
        <div
          className="sticky top-0 h-screen flex flex-col items-center justify-center page-gutter py-16 overflow-visible"
          role="region"
          aria-label="Slide viewer"
        >
          {/* Slide container - fills available space with aspect ratio constraint */}
          <div className="relative w-full max-w-[1200px] aspect-[16/9] overflow-visible">
            {PITCH_SLIDES.map((slide, index) => (
              <PitchSlide
                key={slide.id}
                slide={slide}
                index={index}
                totalSlides={PITCH_SLIDES.length}
                scrollProgress={scrollYProgress}
                isGridView={isGridView}
              />
            ))}
          </div>

          {/* Progress Indicator - positioned with padding offset */}
          <SlideIndicator
            totalSlides={PITCH_SLIDES.length}
            scrollProgress={scrollYProgress}
            isGridView={isGridView}
            onDotClick={handleGridItemClick}
          />

          {/* Scroll Hint - disappears on first scroll */}
          <ScrollHint isGridView={isGridView} />

          {/* Navigation Controls */}
          <NavigationControls
            currentSlide={currentSlide}
            totalSlides={PITCH_SLIDES.length}
            onPrev={handlePrevSlide}
            onNext={handleNextSlide}
            isGridView={isGridView}
          />
        </div>
      </div>

      {/* Grid View Overlay */}
      <AnimatePresence>
        {isGridView && (
          <GridView>
            {PITCH_SLIDES.map((slide, index) => (
              <GridSlideItem
                key={slide.id}
                slide={slide}
                index={index}
                totalSlides={PITCH_SLIDES.length}
                onClick={() => handleGridItemClick(index)}
              />
            ))}
          </GridView>
        )}
      </AnimatePresence>
    </main>
  );
}

// Grid View Overlay with CSS Grid
function GridView({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="fixed inset-0 z-40 bg-background/95 backdrop-blur-sm overflow-auto"
    >
      <div className="min-h-screen py-24 px-8 flex items-center justify-center">
        <div className="max-w-7xl w-full">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {children}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// Grid Item Component - Shows actual slide content scaled down
function GridSlideItem({
  slide,
  index,
  totalSlides,
  onClick,
}: {
  slide: (typeof PITCH_SLIDES)[number];
  index: number;
  totalSlides: number;
  onClick: () => void;
}) {
  // Stagger delay: last slide animates first (reverse order)
  const staggerDelay = (totalSlides - 1 - index) * 0.05;

  return (
    <motion.div
      onClick={onClick}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{
        opacity: 1,
        scale: 1,
        transition: {
          delay: staggerDelay,
          duration: 0.3,
          ease: [0.25, 0.1, 0.25, 1],
        },
      }}
      whileHover={{ scale: 1.02 }}
      transition={{ duration: 0.2 }}
      className="cursor-pointer group"
    >
      {/* Container maintains 16:9 aspect ratio */}
      <div className="w-full aspect-[16/9] rounded-sm overflow-hidden shadow-lg transition-shadow duration-200 group-hover:shadow-xl group-hover:ring-2 group-hover:ring-white/20">
        {/* Inner wrapper scales down the full slide content */}
        <div
          className={cn("w-[400%] h-[400%] origin-top-left", slide.bgColor)}
          style={
            {
              transform: "scale(0.25)",
              "--foreground": "oklch(0.205 0 0)",
            } as React.CSSProperties
          }
        >
          <div className="relative w-full h-full p-6 sm:p-8 md:p-12 flex flex-col justify-between">
            <SlideContent slide={slide} />
          </div>
        </div>
      </div>
      {"gridTitle" in slide && slide.gridTitle && (
        <p className="mt-2 text-xs text-muted-foreground text-center truncate">
          {slide.gridTitle}
        </p>
      )}
    </motion.div>
  );
}

function SlideIndicator({
  totalSlides,
  scrollProgress,
  isGridView,
  onDotClick,
}: {
  totalSlides: number;
  scrollProgress: MotionValue<number>;
  isGridView: boolean;
  onDotClick: (index: number) => void;
}) {
  return (
    <motion.div
      className="fixed right-6 top-1/2 -translate-y-1/2 z-50 flex flex-col items-end gap-2"
      animate={{
        opacity: isGridView ? 0 : 1,
        pointerEvents: isGridView ? "none" : "auto",
      }}
      transition={{ duration: 0.2 }}
    >
      {Array.from({ length: totalSlides }).map((_, index) => (
        <IndicatorLine
          key={index}
          index={index}
          totalSlides={totalSlides}
          scrollProgress={scrollProgress}
          onClick={() => onDotClick(index)}
        />
      ))}
    </motion.div>
  );
}

function IndicatorLine({
  index,
  totalSlides,
  scrollProgress,
  onClick,
}: {
  index: number;
  totalSlides: number;
  scrollProgress: MotionValue<number>;
  onClick: () => void;
}) {
  const slideStart = index / totalSlides;
  const slideEnd = (index + 1) / totalSlides;

  const opacity = useTransform(
    scrollProgress,
    [slideStart - 0.05, slideStart, slideEnd - 0.05, slideEnd],
    [0.3, 1, 1, 0.3],
  );

  const width = useTransform(
    scrollProgress,
    [slideStart - 0.05, slideStart, slideEnd - 0.05, slideEnd],
    [24, 40, 40, 24],
  );

  return (
    <motion.button
      onClick={onClick}
      style={{ opacity, width }}
      className="h-px min-w-6 bg-foreground cursor-pointer hover:bg-foreground/80 transition-colors block"
      aria-label={`Go to slide ${index + 1}`}
    />
  );
}

function ScrollHint({ isGridView }: { isGridView: boolean }) {
  const [hasScrolled, setHasScrolled] = useState(false);

  // Hide on first scroll - never show again
  useEffect(() => {
    if (hasScrolled) return;

    const handleScroll = () => {
      if (window.scrollY > 10) {
        setHasScrolled(true);
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [hasScrolled]);

  // Don't render if user has scrolled or in grid view
  if (hasScrolled || isGridView) return null;

  return (
    <motion.div
      className="fixed bottom-16 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center pointer-events-none"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* SCROLL text */}
      <span className="text-[10px] font-medium tracking-[0.3em] text-muted-foreground uppercase">
        Scroll
      </span>

      {/* Vertical line */}
      <div className="h-3 w-px bg-muted-foreground/50 mt-1" />

      {/* Animated diamond indicator */}
      <motion.div
        className="mt-1"
        transition={{
          duration: 1.2,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      >
        <div className="w-2 h-2 rotate-45 border border-muted-foreground" />
      </motion.div>

      {/* Dotted line below */}
      <div className="flex flex-col gap-1 mt-1">
        <div className="w-px h-1 bg-muted-foreground/40" />
        <div className="w-px h-1 bg-muted-foreground/30" />
        <div className="w-px h-1 bg-muted-foreground/20" />
      </div>
    </motion.div>
  );
}

function NavigationControls({
  currentSlide,
  totalSlides,
  onPrev,
  onNext,
  isGridView,
}: {
  currentSlide: number;
  totalSlides: number;
  onPrev: () => void;
  onNext: () => void;
  isGridView: boolean;
}) {
  const isFirst = currentSlide === 0;
  const isLast = currentSlide === totalSlides - 1;

  return (
    <motion.div
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4"
      initial={{ opacity: 0 }}
      animate={{
        opacity: isGridView ? 0 : 1,
        pointerEvents: isGridView ? "none" : "auto",
      }}
      transition={{ duration: 0.2 }}
    >
      <button
        onClick={onPrev}
        disabled={isFirst}
        className="p-2 text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        aria-label="Previous slide"
      >
        <ChevronUp className="h-4 w-4" />
      </button>

      <span
        className="text-xs text-muted-foreground tabular-nums"
        aria-live="polite"
      >
        {currentSlide + 1} / {totalSlides}
      </span>

      <button
        onClick={onNext}
        disabled={isLast}
        className="p-2 text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        aria-label="Next slide"
      >
        <ChevronDown className="h-4 w-4" />
      </button>
    </motion.div>
  );
}

interface PitchSlideProps {
  slide: (typeof PITCH_SLIDES)[number];
  index: number;
  totalSlides: number;
  scrollProgress: MotionValue<number>;
  isGridView: boolean;
}

function PitchSlide({
  slide,
  index,
  totalSlides,
  scrollProgress,
  isGridView,
}: PitchSlideProps) {
  const slideStart = index / totalSlides;
  const slideEnd = (index + 1) / totalSlides;

  // Scroll-based transforms (used when NOT in grid view)
  // First slide: visible at start, then stacks behind
  // Other slides: start at 150vh below viewport, animate UP into view, then stack
  const isFirstSlide = index === 0;

  const y = useTransform(
    scrollProgress,
    isFirstSlide
      ? [0, slideEnd, slideEnd + 0.1, slideEnd + 0.2, slideEnd + 0.3]
      : [
          slideStart - 0.12, // Well before slide appears - at 150vh
          slideStart - 0.08, // Start entering
          slideStart, // Fully visible (centered)
          slideEnd, // Start stacking
          slideEnd + 0.1,
          slideEnd + 0.2,
          slideEnd + 0.3,
        ],
    isFirstSlide
      ? ["0%", "-30px", "-50px", "-60px", "-60px"]
      : ["150vh", "150vh", "0%", "-30px", "-50px", "-60px", "-60px"],
  );

  const scale = useTransform(
    scrollProgress,
    isFirstSlide
      ? [0, slideEnd, slideEnd + 0.1, slideEnd + 0.2, slideEnd + 0.3]
      : [
          slideStart - 0.08,
          slideStart,
          slideEnd,
          slideEnd + 0.1,
          slideEnd + 0.2,
          slideEnd + 0.3,
        ],
    isFirstSlide ? [1, 0.95, 0.9, 0.85, 0.85] : [1, 1, 0.95, 0.9, 0.85, 0.85],
  );

  // Opacity: all slides start visible, fade out when stacking behind
  const opacity = useTransform(
    scrollProgress,
    [slideEnd + 0.15, slideEnd + 0.25, slideEnd + 0.35],
    [1, 0.6, 0],
  );

  const zIndex = useTransform(
    scrollProgress,
    [slideStart - 0.1, slideStart, slideEnd],
    [index, index + 1, index + 1],
  );

  // Don't render slides when in grid view (they render in GridView instead)
  if (isGridView) {
    return null;
  }

  return (
    <motion.article
      style={{ y, scale, opacity, zIndex }}
      className={cn("absolute inset-0 will-change-transform origin-center")}
      aria-label={`Slide ${index + 1} of ${totalSlides}: ${slide.title}`}
    >
      <div
        className={cn(
          "w-full aspect-[16/9] rounded-sm overflow-hidden shadow-2xl",
          slide.bgColor,
        )}
        style={{ "--foreground": "oklch(0.205 0 0)" } as React.CSSProperties}
      >
        <div className="relative h-full p-6 sm:p-8 md:p-12 flex flex-col justify-between">
          <SlideContent slide={slide} />
        </div>
      </div>
    </motion.article>
  );
}

function SlideContent({ slide }: { slide: (typeof PITCH_SLIDES)[number] }) {
  // First slide (id: "title") uses the custom grid design
  if (slide.type === "title" && slide.id === "title") {
    return <CustomTitleSlide slide={slide} variant="responsive" />;
  }

  // Last slide (id: "vision") uses the custom closing design
  if (slide.type === "title" && slide.id === "vision") {
    return <CustomClosingSlide slide={slide} variant="responsive" />;
  }

  switch (slide.type) {
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
