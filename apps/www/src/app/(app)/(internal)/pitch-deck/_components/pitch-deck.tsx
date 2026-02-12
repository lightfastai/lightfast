"use client";

import { useRef, useEffect, useState } from "react";
import { flushSync } from "react-dom";
import {
  LazyMotion,
  m,
  useScroll,
  useTransform,
  useMotionValueEvent,
} from "framer-motion";
import type { MotionValue } from "framer-motion";
import { loadMotionFeatures } from "../_lib/motion-features";
import {
  GRID_COLS,
  shouldBeGridView,
  getSlideYKeyframes,
  getSlideScaleKeyframes,
  getSlideOpacityKeyframes,
  getSlideZIndexKeyframes,
  getIndicatorOpacityKeyframes,
  getIndicatorWidthKeyframes,
  getGridDimensions,
  getGridPosition,
  getSlideIndexFromProgress,
  getScrollTargetForSlide,
  getStaggerDelay,
} from "../_lib/animation-utils";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@repo/ui/lib/utils";
import { PITCH_SLIDES } from "~/config/pitch-deck-data";
import { usePitchDeck } from "./pitch-deck-context";
import { resolveSlideComponent } from "./slide-content";
import { MobileBottomBar } from "./mobile-bottom-bar";

export function PitchDeck() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  const { isGridView, setIsGridView } = usePitchDeck();
  const [currentSlide, setCurrentSlide] = useState(0);
  const isTransitioningRef = useRef(false);

  // Update current slide based on scroll progress (desktop only, but safe to run)
  useMotionValueEvent(scrollYProgress, "change", (latest) => {
    const slideIndex = getSlideIndexFromProgress(latest, PITCH_SLIDES.length);
    if (slideIndex !== currentSlide) {
      setCurrentSlide(slideIndex);
    }

    // Prevent grid toggle during reverse transition
    if (isTransitioningRef.current) return;

    // Grid view logic with hysteresis
    const nextGridState = shouldBeGridView(latest, isGridView);
    if (nextGridState !== isGridView) {
      setIsGridView(nextGridState);
    }
  });

  // Keyboard navigation (desktop only behavior, but safe to attach)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Disable scroll-based keyboard navigation in grid mode
      if (isGridView) return;

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
  }, [isGridView]);

  // Exit grid view and scroll to a specific slide
  const exitGridToSlide = (index: number) => {
    isTransitioningRef.current = true;

    // flushSync ensures React commits the DOM change (height: auto → 1100vh)
    // before we read scrollHeight or call scrollTo.
    flushSync(() => {
      setIsGridView(false);
    });

    requestAnimationFrame(() => {
      const scrollTarget = getScrollTargetForSlide(
        index,
        PITCH_SLIDES.length,
        document.documentElement.scrollHeight,
      );
      window.scrollTo({ top: scrollTarget, behavior: "instant" });
      setTimeout(() => {
        isTransitioningRef.current = false;
      }, 100);
    });
  };

  const handleGridItemClick = (index: number) => {
    exitGridToSlide(index);
  };

  // Scroll backward in grid mode → return to last slide
  useEffect(() => {
    if (!isGridView) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.deltaY < 0) {
        e.preventDefault();
        exitGridToSlide(PITCH_SLIDES.length - 1);
      }
    };

    window.addEventListener("wheel", handleWheel, { passive: false });
    return () => window.removeEventListener("wheel", handleWheel);
  }, [isGridView]);

  const handlePrevSlide = () => {
    if (currentSlide > 0) {
      const scrollTarget = getScrollTargetForSlide(
        currentSlide - 1,
        PITCH_SLIDES.length,
        document.documentElement.scrollHeight,
      );
      window.scrollTo({ top: scrollTarget, behavior: "smooth" });
    }
  };

  const handleNextSlide = () => {
    if (currentSlide < PITCH_SLIDES.length - 1) {
      const scrollTarget = getScrollTargetForSlide(
        currentSlide + 1,
        PITCH_SLIDES.length,
        document.documentElement.scrollHeight,
      );
      window.scrollTo({ top: scrollTarget, behavior: "smooth" });
    }
  };

  return (
    <LazyMotion features={loadMotionFeatures} strict>
      <main aria-label="Pitch Deck Presentation">
        {/* Desktop: Scroll-driven stacking experience */}
        <div
          ref={containerRef}
          className="hidden lg:block relative"
          style={{
            height: isGridView ? "auto" : `${(PITCH_SLIDES.length + 1) * 100}vh`,
          }}
        >
          {/* Sticky wrapper — only sticky in scroll mode */}
          <div
            className={cn(
              "flex flex-col items-center page-gutter py-16",
              isGridView
                ? "min-h-screen justify-start pt-24"
                : "sticky top-0 h-screen justify-center overflow-visible",
            )}
            role="region"
            aria-label="Slide viewer"
          >
            {/* Slide container — stays in absolute positioning, cards animate to grid positions */}
            <SlideContainer
              isGridView={isGridView}
              scrollYProgress={scrollYProgress}
              onGridItemClick={handleGridItemClick}
            />

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

        {/* Mobile: Simple vertical scroll */}
        <div className="lg:hidden space-y-6 px-4 pt-20 pb-24">
          {PITCH_SLIDES.map((slide, index) => (
            <article
              key={slide.id}
              aria-label={`Slide ${index + 1}: ${slide.title}`}
            >
              <div
                className={cn(
                  "w-full aspect-[16/9] rounded-sm overflow-hidden shadow-lg",
                  slide.bgColor,
                )}
                style={
                  { "--foreground": "oklch(0.205 0 0)" } as React.CSSProperties
                }
              >
                <div className="relative h-full p-4 flex flex-col justify-between">
                  <SlideContent slide={slide} />
                </div>
              </div>
            </article>
          ))}
          <MobileBottomBar />
        </div>

      </main>
    </LazyMotion>
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
    <m.div
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
    </m.div>
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
  const opacityKf = getIndicatorOpacityKeyframes(index, totalSlides);
  const widthKf = getIndicatorWidthKeyframes(index, totalSlides);

  const opacity = useTransform(scrollProgress, opacityKf.input, opacityKf.output);
  const width = useTransform(scrollProgress, widthKf.input, widthKf.output);

  return (
    <m.button
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
    <m.div
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
      <m.div
        className="mt-1"
        transition={{
          duration: 1.2,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      >
        <div className="w-2 h-2 rotate-45 border border-muted-foreground" />
      </m.div>

      {/* Dotted line below */}
      <div className="flex flex-col gap-1 mt-1">
        <div className="w-px h-1 bg-muted-foreground/40" />
        <div className="w-px h-1 bg-muted-foreground/30" />
        <div className="w-px h-1 bg-muted-foreground/20" />
      </div>
    </m.div>
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
    <m.div
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
    </m.div>
  );
}

function SlideContainer({
  isGridView,
  scrollYProgress,
  onGridItemClick,
}: {
  isGridView: boolean;
  scrollYProgress: MotionValue<number>;
  onGridItemClick: (index: number) => void;
}) {
  const slideContainerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  // Measure container width
  useEffect(() => {
    const el = slideContainerRef.current;
    if (!el) return;

    const measure = () => setContainerWidth(el.offsetWidth);
    measure();

    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Calculate thumbnail size from container width
  const { thumbWidth, gridScale, rowHeight } = getGridDimensions(containerWidth);
  const totalRows = Math.ceil(PITCH_SLIDES.length / GRID_COLS);

  return (
    <div
      ref={slideContainerRef}
      className={cn(
        "w-full relative",
        isGridView
          ? "max-w-7xl"
          : "max-w-[1200px] aspect-[16/9] overflow-visible",
      )}
      style={
        isGridView
          ? { height: `${totalRows * rowHeight}px` }
          : undefined
      }
    >
      {PITCH_SLIDES.map((slide, index) => (
        <PitchSlide
          key={slide.id}
          slide={slide}
          index={index}
          totalSlides={PITCH_SLIDES.length}
          scrollProgress={scrollYProgress}
          isGridView={isGridView}
          onGridItemClick={() => onGridItemClick(index)}
          gridScale={gridScale}
          thumbWidth={thumbWidth}
          rowHeight={rowHeight}
        />
      ))}
    </div>
  );
}

interface PitchSlideProps {
  slide: (typeof PITCH_SLIDES)[number];
  index: number;
  totalSlides: number;
  scrollProgress: MotionValue<number>;
  isGridView: boolean;
  onGridItemClick: () => void;
  gridScale: number;
  thumbWidth: number;
  rowHeight: number;
}

function PitchSlide({
  slide,
  index,
  totalSlides,
  scrollProgress,
  isGridView,
  onGridItemClick,
  gridScale,
  thumbWidth,
  rowHeight,
}: PitchSlideProps) {
  // --- Scroll-driven transforms ---
  const yKf = getSlideYKeyframes(index, totalSlides);
  const scaleKf = getSlideScaleKeyframes(index, totalSlides);
  const opacityKf = getSlideOpacityKeyframes(index, totalSlides);
  const zIndexKf = getSlideZIndexKeyframes(index, totalSlides);

  const y = useTransform(scrollProgress, yKf.input, yKf.output);
  const scale = useTransform(scrollProgress, scaleKf.input, scaleKf.output);
  const opacity = useTransform(scrollProgress, opacityKf.input, opacityKf.output);
  const zIndex = useTransform(scrollProgress, zIndexKf.input, zIndexKf.output);

  // --- Grid position calculation ---
  const { x: gridX, y: gridY } = getGridPosition(index, thumbWidth, rowHeight);

  // Reduced motion check — read during render so must be state, not ref
  const [prefersReducedMotion] = useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false,
  );

  // Animation delay: reverse order (last card first, first card last)
  const staggerDelay = getStaggerDelay(index, totalSlides);

  return (
    <m.article
      initial={false}
      style={isGridView ? undefined : { y, scale, opacity, zIndex }}
      animate={
        isGridView
          ? {
              x: gridX,
              y: gridY,
              scale: gridScale,
              opacity: 1,
              zIndex: 1,
              transition: {
                duration: prefersReducedMotion ? 0 : 0.6,
                delay: prefersReducedMotion ? 0 : staggerDelay,
                ease: [0.25, 0.1, 0.25, 1],
              },
            }
          : undefined
      }
      className={cn(
        "absolute inset-0",
        isGridView
          ? "cursor-pointer group origin-top-left"
          : "will-change-transform origin-center",
      )}
      onClick={isGridView ? onGridItemClick : undefined}
      aria-label={`Slide ${index + 1} of ${totalSlides}: ${slide.title}`}
    >
      {/* Slide content wrapper */}
      <div
        className={cn(
          "w-full aspect-[16/9] rounded-lg overflow-hidden shadow-2xl",
          isGridView &&
            "rounded-sm shadow-lg transition-shadow duration-200 group-hover:shadow-xl group-hover:ring-2 group-hover:ring-white/20",
          slide.bgColor,
        )}
        style={{ "--foreground": "oklch(0.205 0 0)" } as React.CSSProperties}
      >
        <div className="relative h-full w-full p-6 sm:p-8 md:p-12 flex flex-col justify-between">
          <SlideContent slide={slide} />
        </div>
      </div>

      {/* Grid title label — only in grid mode */}
      {isGridView && "gridTitle" in slide && (
        <p
          className="text-xs text-muted-foreground text-center truncate mt-2"
          style={{
            // Scale up the title text to counteract the parent's scale-down
            transform: `scale(${1 / gridScale})`,
            transformOrigin: "top center",
            width: `${thumbWidth}px`,
          }}
        >
          {slide.gridTitle}
        </p>
      )}
    </m.article>
  );
}

function SlideContent({ slide }: { slide: (typeof PITCH_SLIDES)[number] }) {
  return resolveSlideComponent(slide, "responsive");
}
