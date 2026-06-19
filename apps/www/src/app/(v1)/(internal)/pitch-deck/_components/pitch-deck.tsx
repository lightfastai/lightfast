"use client";

import { cn } from "@repo/ui/lib/utils";
import type { MotionValue } from "framer-motion";
import {
  AnimatePresence,
  LazyMotion,
  m,
  useMotionValueEvent,
  useScroll,
  useTransform,
} from "framer-motion";
import { ChevronDown, ChevronUp } from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PITCH_SLIDES } from "~/config/pitch-deck-data";
import {
  getIndicatorOpacityKeyframes,
  getIndicatorWidthKeyframes,
  getScrollTargetForSlide,
  getSlideIndexFromProgress,
  getSlideOpacityKeyframes,
  getSlideScaleKeyframes,
  getSlideYKeyframes,
  getSlideZIndexKeyframes,
} from "../_lib/animation-utils";
import { loadMotionFeatures } from "../_lib/motion-features";
import { MobileBottomBar } from "./mobile-bottom-bar";
import { resolveSlideComponent } from "./slide-content";

export function PitchDeck() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  const [currentSlide, setCurrentSlide] = useState(0);

  // Update current slide based on scroll progress
  useMotionValueEvent(scrollYProgress, "change", (latest) => {
    const slideIndex = getSlideIndexFromProgress(latest, PITCH_SLIDES.length);
    if (slideIndex !== currentSlide) {
      setCurrentSlide(slideIndex);
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

  const handlePrevSlide = useCallback(() => {
    if (currentSlide > 0) {
      const scrollTarget = getScrollTargetForSlide(
        currentSlide - 1,
        PITCH_SLIDES.length,
        document.documentElement.scrollHeight
      );
      window.scrollTo({ top: scrollTarget, behavior: "smooth" });
    }
  }, [currentSlide]);

  const handleNextSlide = useCallback(() => {
    if (currentSlide < PITCH_SLIDES.length - 1) {
      const scrollTarget = getScrollTargetForSlide(
        currentSlide + 1,
        PITCH_SLIDES.length,
        document.documentElement.scrollHeight
      );
      window.scrollTo({ top: scrollTarget, behavior: "smooth" });
    }
  }, [currentSlide]);

  const handleIndicatorClick = useCallback((index: number) => {
    const scrollTarget = getScrollTargetForSlide(
      index,
      PITCH_SLIDES.length,
      document.documentElement.scrollHeight
    );
    window.scrollTo({ top: scrollTarget, behavior: "smooth" });
  }, []);

  return (
    <LazyMotion features={loadMotionFeatures} strict>
      <main aria-label="Pitch Deck Presentation">
        {/* Desktop: Scroll-driven stacking experience */}
        <div
          className="relative hidden md:block"
          ref={containerRef}
          style={{
            height: `${(PITCH_SLIDES.length + 1) * 100}vh`,
          }}
        >
          {/* Sticky wrapper */}
          <section
            aria-label="Slide viewer"
            className="page-gutter sticky top-0 flex h-screen flex-col items-center justify-center overflow-visible py-16"
          >
            {/* Slide container */}
            <div className="relative aspect-[16/9] w-full max-w-[860px] overflow-visible">
              {PITCH_SLIDES.map((slide, index) => (
                <PitchSlide
                  index={index}
                  key={slide.id}
                  scrollProgress={scrollYProgress}
                  slide={slide}
                  totalSlides={PITCH_SLIDES.length}
                />
              ))}
            </div>

            {/* Progress Indicator */}
            <SlideIndicator
              onDotClick={handleIndicatorClick}
              scrollProgress={scrollYProgress}
              totalSlides={PITCH_SLIDES.length}
            />

            {/* Scroll Hint - disappears on first scroll */}
            <ScrollHint />

            {/* Navigation Controls */}
            <NavigationControls
              currentSlide={currentSlide}
              onNext={handleNextSlide}
              onPrev={handlePrevSlide}
              totalSlides={PITCH_SLIDES.length}
            />
          </section>
        </div>

        {/* Mobile: Simple vertical scroll */}
        <div className="space-y-6 px-4 pt-20 pb-24 md:hidden">
          {PITCH_SLIDES.map((slide, index) => (
            <article
              aria-label={`Slide ${index + 1}: ${slide.title}`}
              key={slide.id}
            >
              <div
                className={cn(
                  "aspect-[16/9] w-full overflow-hidden rounded-sm shadow-lg",
                  slide.bgColor
                )}
                style={
                  { "--foreground": "oklch(0.205 0 0)" } as React.CSSProperties
                }
              >
                <div className="relative flex h-full flex-col justify-between p-4">
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
  onDotClick,
}: {
  totalSlides: number;
  scrollProgress: MotionValue<number>;
  onDotClick: (index: number) => void;
}) {
  return (
    <div className="fixed top-1/2 right-6 z-50 flex -translate-y-1/2 flex-col items-end gap-2">
      {Array.from({ length: totalSlides }).map((_, index) => (
        <IndicatorLine
          index={index}
          key={index}
          onDotClick={onDotClick}
          scrollProgress={scrollProgress}
          totalSlides={totalSlides}
        />
      ))}
    </div>
  );
}

const IndicatorLine = memo(function IndicatorLine({
  index,
  totalSlides,
  scrollProgress,
  onDotClick,
}: {
  index: number;
  totalSlides: number;
  scrollProgress: MotionValue<number>;
  onDotClick: (index: number) => void;
}) {
  const opacityKf = useMemo(
    () => getIndicatorOpacityKeyframes(index, totalSlides),
    [index, totalSlides]
  );
  const widthKf = useMemo(
    () => getIndicatorWidthKeyframes(index, totalSlides),
    [index, totalSlides]
  );

  const handleClick = useCallback(() => onDotClick(index), [onDotClick, index]);

  const opacity = useTransform(
    scrollProgress,
    opacityKf.input,
    opacityKf.output
  );
  const width = useTransform(scrollProgress, widthKf.input, widthKf.output);

  return (
    <m.button
      aria-label={`Go to slide ${index + 1}`}
      className="block h-px min-w-6 cursor-pointer bg-foreground transition-colors hover:bg-foreground/80"
      onClick={handleClick}
      style={{ opacity, width }}
    />
  );
});

function ScrollHint() {
  const [hasScrolled, setHasScrolled] = useState(false);

  // Self-cleaning listener: removes itself after first positive check
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 10) {
        setHasScrolled(true);
        window.removeEventListener("scroll", handleScroll);
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <AnimatePresence>
      {!hasScrolled && (
        <m.div
          className="pointer-events-none fixed bottom-16 left-1/2 z-50 flex -translate-x-1/2 flex-col items-center"
          exit={{ opacity: 0 }}
          initial={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          {/* SCROLL text */}
          <span className="font-medium text-[10px] text-muted-foreground uppercase tracking-[0.3em]">
            Scroll
          </span>

          {/* Vertical line */}
          <div className="mt-1 h-3 w-px bg-muted-foreground/50" />

          {/* Animated diamond indicator */}
          <m.div
            className="mt-1"
            transition={{
              duration: 1.2,
              repeat: Number.POSITIVE_INFINITY,
              ease: "easeInOut",
            }}
          >
            <div className="h-2 w-2 rotate-45 border border-muted-foreground" />
          </m.div>

          {/* Dotted line below */}
          <div className="mt-1 flex flex-col gap-1">
            <div className="h-1 w-px bg-muted-foreground/40" />
            <div className="h-1 w-px bg-muted-foreground/30" />
            <div className="h-1 w-px bg-muted-foreground/20" />
          </div>
        </m.div>
      )}
    </AnimatePresence>
  );
}

function NavigationControls({
  currentSlide,
  totalSlides,
  onPrev,
  onNext,
}: {
  currentSlide: number;
  totalSlides: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  const isFirst = currentSlide === 0;
  const isLast = currentSlide === totalSlides - 1;

  return (
    <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-4">
      <button
        aria-label="Previous slide"
        className="p-2 text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
        disabled={isFirst}
        onClick={onPrev}
        type="button"
      >
        <ChevronUp className="h-4 w-4" />
      </button>

      <span
        aria-live="polite"
        className="text-muted-foreground text-xs tabular-nums"
      >
        {currentSlide + 1} / {totalSlides}
      </span>

      <button
        aria-label="Next slide"
        className="p-2 text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
        disabled={isLast}
        onClick={onNext}
        type="button"
      >
        <ChevronDown className="h-4 w-4" />
      </button>
    </div>
  );
}

const PitchSlide = memo(function PitchSlide({
  slide,
  index,
  totalSlides,
  scrollProgress,
}: {
  slide: (typeof PITCH_SLIDES)[number];
  index: number;
  totalSlides: number;
  scrollProgress: MotionValue<number>;
}) {
  const yKf = useMemo(
    () => getSlideYKeyframes(index, totalSlides),
    [index, totalSlides]
  );
  const scaleKf = useMemo(
    () => getSlideScaleKeyframes(index, totalSlides),
    [index, totalSlides]
  );
  const opacityKf = useMemo(
    () => getSlideOpacityKeyframes(index, totalSlides),
    [index, totalSlides]
  );
  const zIndexKf = useMemo(
    () => getSlideZIndexKeyframes(index, totalSlides),
    [index, totalSlides]
  );

  const y = useTransform(scrollProgress, yKf.input, yKf.output);
  const scale = useTransform(scrollProgress, scaleKf.input, scaleKf.output);
  const opacity = useTransform(
    scrollProgress,
    opacityKf.input,
    opacityKf.output
  );
  const zIndex = useTransform(scrollProgress, zIndexKf.input, zIndexKf.output);

  return (
    <m.article
      aria-label={`Slide ${index + 1} of ${totalSlides}: ${slide.title}`}
      className="absolute inset-0 origin-center will-change-transform"
      style={{ y, scale, opacity, zIndex }}
    >
      <div
        className={cn(
          "aspect-[16/9] w-full overflow-hidden rounded-lg shadow-2xl",
          slide.bgColor
        )}
        style={{ "--foreground": "oklch(0.205 0 0)" } as React.CSSProperties}
      >
        <div className="relative flex h-full w-full flex-col justify-between p-6 sm:p-8 md:p-12">
          <SlideContent slide={slide} />
        </div>
      </div>
    </m.article>
  );
});

function SlideContent({ slide }: { slide: (typeof PITCH_SLIDES)[number] }) {
  return resolveSlideComponent(slide, "responsive");
}
