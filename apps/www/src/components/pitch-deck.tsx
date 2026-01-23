"use client";

import { useRef, useEffect, useState } from "react";
import { motion, useScroll, useTransform, useMotionValueEvent } from "framer-motion";
import type { MotionValue } from "framer-motion";
import { cn } from "@repo/ui/lib/utils";
import { PITCH_SLIDES } from "~/config/pitch-deck-data";

// Grid configuration - matching Flabbergast dimensions
const GRID_COLUMNS = 4;

interface GridPosition {
  x: number; // percentage from left (viewport-relative)
  y: number; // percentage from top (viewport-relative)
  scale: number;
}

function calculateGridPositions(totalSlides: number): GridPosition[] {
  const rows = Math.ceil(totalSlides / GRID_COLUMNS);
  const positions: GridPosition[] = [];

  // Thumbnail scale: Flabbergast uses 15.76vw thumbnails from 70vw slides
  // 15.76 / 70 = 0.225 (22.5%)
  const thumbnailScale = 0.225;

  // Column positions relative to center (50%)
  // Spread 4 columns across ~48% width, centered
  const columnPositions = [-24, -8, 8, 24];

  // Row positioning: ~22vh between row centers for adequate spacing with larger thumbnails
  const rowHeight = 22;
  const totalGridHeight = rows * rowHeight;
  const startY = (100 - totalGridHeight) / 2 + rowHeight / 2;

  for (let i = 0; i < totalSlides; i++) {
    const col = i % GRID_COLUMNS;
    const row = Math.floor(i / GRID_COLUMNS);

    // X position: center-relative (50% + offset)
    const xPercent = 50 + columnPositions[col]!;
    const yPercent = startY + row * rowHeight;

    positions.push({
      x: xPercent,
      y: yPercent,
      scale: thumbnailScale,
    });
  }

  return positions;
}

// Pre-calculate grid positions
const GRID_POSITIONS = calculateGridPositions(PITCH_SLIDES.length);

export function PitchDeck() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  // Grid view state - triggers when scrolled past last slide
  const [isGridView, setIsGridView] = useState(false);

  // Grid view threshold: last slide ends at (totalSlides) / (totalSlides + 1)
  // For 8 slides with +1 extra: 8/9 = 0.889
  // Trigger grid when scroll exceeds ~0.92 (in the extra scroll space)
  const GRID_THRESHOLD = 0.92;

  useMotionValueEvent(scrollYProgress, "change", (latest) => {
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
        window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <main aria-label="Pitch Deck Presentation">
      <div
        ref={containerRef}
        className="relative"
        style={{ height: `${(PITCH_SLIDES.length + 1) * 100}vh` }}
      >
        <div
          className="sticky top-0 h-screen flex items-center justify-center overflow-visible"
          role="region"
          aria-label="Slide viewer"
        >
          {/* Container with aspect ratio to properly size the slide area */}
          <div
            className="relative w-[70vw] mx-auto aspect-[16/9] overflow-visible"
          >
            {PITCH_SLIDES.map((slide, index) => (
              <PitchSlide
                key={slide.id}
                slide={slide}
                index={index}
                totalSlides={PITCH_SLIDES.length}
                scrollProgress={scrollYProgress}
                isGridView={isGridView}
                gridPosition={GRID_POSITIONS[index]!}
              />
            ))}
          </div>

          {/* Progress Indicator */}
          <SlideIndicator
            totalSlides={PITCH_SLIDES.length}
            scrollProgress={scrollYProgress}
          />
        </div>
      </div>
    </main>
  );
}

function SlideIndicator({
  totalSlides,
  scrollProgress,
}: {
  totalSlides: number;
  scrollProgress: MotionValue<number>;
}) {
  return (
    <div className="fixed right-4 sm:right-8 top-1/2 -translate-y-1/2 z-50 flex flex-col gap-2">
      {Array.from({ length: totalSlides }).map((_, index) => (
        <IndicatorDot
          key={index}
          index={index}
          totalSlides={totalSlides}
          scrollProgress={scrollProgress}
        />
      ))}
    </div>
  );
}

function IndicatorDot({
  index,
  totalSlides,
  scrollProgress,
}: {
  index: number;
  totalSlides: number;
  scrollProgress: MotionValue<number>;
}) {
  const slideStart = index / totalSlides;
  const slideEnd = (index + 1) / totalSlides;

  const opacity = useTransform(
    scrollProgress,
    [slideStart - 0.05, slideStart, slideEnd - 0.05, slideEnd],
    [0.3, 1, 1, 0.3]
  );

  const scaleY = useTransform(
    scrollProgress,
    [slideStart - 0.05, slideStart, slideEnd - 0.05, slideEnd],
    [1, 1.5, 1.5, 1]
  );

  return (
    <motion.div
      style={{ opacity, scaleY }}
      className="w-0.5 h-3 bg-foreground rounded-full origin-center"
    />
  );
}

interface PitchSlideProps {
  slide: (typeof PITCH_SLIDES)[number];
  index: number;
  totalSlides: number;
  scrollProgress: MotionValue<number>;
  isGridView: boolean;
  gridPosition: GridPosition;
}

function PitchSlide({
  slide,
  index,
  totalSlides,
  scrollProgress,
  isGridView,
  gridPosition,
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
      : ["150vh", "150vh", "0%", "-30px", "-50px", "-60px", "-60px"]
  );

  const scale = useTransform(
    scrollProgress,
    isFirstSlide
      ? [0, slideEnd, slideEnd + 0.1, slideEnd + 0.2, slideEnd + 0.3]
      : [slideStart - 0.08, slideStart, slideEnd, slideEnd + 0.1, slideEnd + 0.2, slideEnd + 0.3],
    isFirstSlide
      ? [1, 0.95, 0.9, 0.85, 0.85]
      : [1, 1, 0.95, 0.9, 0.85, 0.85]
  );

  // Opacity: all slides start visible, fade out when stacking behind
  const opacity = useTransform(
    scrollProgress,
    [slideEnd + 0.15, slideEnd + 0.25, slideEnd + 0.35],
    [1, 0.6, 0]
  );

  const zIndex = useTransform(
    scrollProgress,
    [slideStart - 0.1, slideStart, slideEnd],
    [index, index + 1, index + 1]
  );

  // Stagger delay: last slide animates first (reverse order)
  // 50ms between each slide
  const staggerDelay = (totalSlides - 1 - index) * 0.05;

  // Click handler for grid view navigation
  const handleGridClick = () => {
    if (!isGridView) return;

    // Calculate scroll position for this slide
    // Each slide occupies 100vh, so slide N starts at N * 100vh
    const scrollTarget = index * window.innerHeight;

    window.scrollTo({
      top: scrollTarget,
      behavior: "smooth",
    });
  };

  return (
    <motion.article
      onClick={handleGridClick}
      style={!isGridView ? { y, scale, opacity, zIndex } : undefined}
      animate={
        isGridView
          ? {
              // Position relative to viewport center (container is centered at 50%)
              x: `${gridPosition.x - 50}vw`,
              y: `${gridPosition.y - 50}vh`,
              scale: gridPosition.scale,
              opacity: 1,
              zIndex: totalSlides - index,
            }
          : undefined
      }
      transition={
        isGridView
          ? {
              duration: 0.4,
              delay: staggerDelay,
              ease: [0.25, 0.1, 0.25, 1],
            }
          : { duration: 0 }
      }
      className={cn(
        "absolute inset-0 will-change-transform origin-center"
      )}
      aria-label={`Slide ${index + 1} of ${totalSlides}: ${slide.title}`}
    >
      <div
        className={cn(
          "w-full aspect-[16/9] rounded-[15px] overflow-hidden shadow-2xl transition-all",
          isGridView && "cursor-pointer hover:ring-4 hover:ring-white/30",
          slide.bgColor
        )}
      >
        <div className="relative h-full p-6 sm:p-8 md:p-12 flex flex-col justify-between">
          <SlideContent slide={slide} />
        </div>
      </div>
    </motion.article>
  );
}

function SlideContent({ slide }: { slide: (typeof PITCH_SLIDES)[number] }) {
  switch (slide.type) {
    case "title":
      return (
        <>
          {/* Grid pattern overlay for title slides */}
          <div
            className="absolute inset-0 opacity-10 pointer-events-none"
            style={{
              backgroundImage: `
                linear-gradient(to right, white 1px, transparent 1px),
                linear-gradient(to bottom, white 1px, transparent 1px)
              `,
              backgroundSize: "60px 60px",
            }}
          />
          <div className="relative flex-1 flex items-center justify-center">
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-center text-white tracking-tight">
              {slide.title}
            </h1>
          </div>
          <p className="relative text-xs sm:text-sm text-center text-white/70">
            {slide.subtitle}
          </p>
        </>
      );
    case "content":
      return (
        <>
          <h2 className="text-xl sm:text-2xl md:text-3xl font-light text-neutral-900">
            {slide.title}
          </h2>
          <div className="flex-1 flex flex-col justify-end">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-8">
              <p className="text-[10px] sm:text-xs uppercase tracking-wider text-neutral-500">
                {slide.leftText}
              </p>
              <div className="space-y-2 sm:space-y-4">
                {slide.rightText.map((text, i) => (
                  <p
                    key={i}
                    className="text-xs sm:text-sm border-b border-neutral-300 pb-2 text-neutral-700"
                  >
                    {text}
                  </p>
                ))}
              </div>
            </div>
          </div>
        </>
      );
    default:
      return null;
  }
}
