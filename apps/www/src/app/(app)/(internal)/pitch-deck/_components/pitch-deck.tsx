"use client";

import { useRef, useEffect, useState } from "react";
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
  getSlideYKeyframes,
  getSlideScaleKeyframes,
  getSlideOpacityKeyframes,
  getSlideZIndexKeyframes,
  getIndicatorOpacityKeyframes,
  getIndicatorWidthKeyframes,
  getSlideIndexFromProgress,
  getScrollTargetForSlide,
} from "../_lib/animation-utils";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@repo/ui/lib/utils";
import { PITCH_SLIDES } from "~/config/pitch-deck-data";
import { resolveSlideComponent } from "./slide-content";
import { MobileBottomBar } from "./mobile-bottom-bar";

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

  const handleIndicatorClick = (index: number) => {
    const scrollTarget = getScrollTargetForSlide(
      index,
      PITCH_SLIDES.length,
      document.documentElement.scrollHeight,
    );
    window.scrollTo({ top: scrollTarget, behavior: "smooth" });
  };

  return (
    <LazyMotion features={loadMotionFeatures} strict>
      <main aria-label="Pitch Deck Presentation">
        {/* Desktop: Scroll-driven stacking experience */}
        <div
          ref={containerRef}
          className="hidden md:block relative"
          style={{
            height: `${(PITCH_SLIDES.length + 1) * 100}vh`,
          }}
        >
          {/* Sticky wrapper */}
          <div
            className="flex flex-col items-center page-gutter py-16 sticky top-0 h-screen justify-center overflow-visible"
            role="region"
            aria-label="Slide viewer"
          >
            {/* Slide container */}
            <div className="w-full relative max-w-[1200px] aspect-[16/9] overflow-visible">
              {PITCH_SLIDES.map((slide, index) => (
                <PitchSlide
                  key={slide.id}
                  slide={slide}
                  index={index}
                  totalSlides={PITCH_SLIDES.length}
                  scrollProgress={scrollYProgress}
                />
              ))}
            </div>

            {/* Progress Indicator */}
            <SlideIndicator
              totalSlides={PITCH_SLIDES.length}
              scrollProgress={scrollYProgress}
              onDotClick={handleIndicatorClick}
            />

            {/* Scroll Hint - disappears on first scroll */}
            <ScrollHint />

            {/* Navigation Controls */}
            <NavigationControls
              currentSlide={currentSlide}
              totalSlides={PITCH_SLIDES.length}
              onPrev={handlePrevSlide}
              onNext={handleNextSlide}
            />
          </div>
        </div>

        {/* Mobile: Simple vertical scroll */}
        <div className="md:hidden space-y-6 px-4 pt-20 pb-24">
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
  onDotClick,
}: {
  totalSlides: number;
  scrollProgress: MotionValue<number>;
  onDotClick: (index: number) => void;
}) {
  return (
    <div className="fixed right-6 top-1/2 -translate-y-1/2 z-50 flex flex-col items-end gap-2">
      {Array.from({ length: totalSlides }).map((_, index) => (
        <IndicatorLine
          key={index}
          index={index}
          totalSlides={totalSlides}
          scrollProgress={scrollProgress}
          onClick={() => onDotClick(index)}
        />
      ))}
    </div>
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

function ScrollHint() {
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

  if (hasScrolled) return null;

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
}: {
  currentSlide: number;
  totalSlides: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  const isFirst = currentSlide === 0;
  const isLast = currentSlide === totalSlides - 1;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4">
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
    </div>
  );
}

function PitchSlide({
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
  const yKf = getSlideYKeyframes(index, totalSlides);
  const scaleKf = getSlideScaleKeyframes(index, totalSlides);
  const opacityKf = getSlideOpacityKeyframes(index, totalSlides);
  const zIndexKf = getSlideZIndexKeyframes(index, totalSlides);

  const y = useTransform(scrollProgress, yKf.input, yKf.output);
  const scale = useTransform(scrollProgress, scaleKf.input, scaleKf.output);
  const opacity = useTransform(scrollProgress, opacityKf.input, opacityKf.output);
  const zIndex = useTransform(scrollProgress, zIndexKf.input, zIndexKf.output);

  return (
    <m.article
      style={{ y, scale, opacity, zIndex }}
      className="absolute inset-0 will-change-transform origin-center"
      aria-label={`Slide ${index + 1} of ${totalSlides}: ${slide.title}`}
    >
      <div
        className={cn(
          "w-full aspect-[16/9] rounded-lg overflow-hidden shadow-2xl",
          slide.bgColor,
        )}
        style={{ "--foreground": "oklch(0.205 0 0)" } as React.CSSProperties}
      >
        <div className="relative h-full w-full p-6 sm:p-8 md:p-12 flex flex-col justify-between">
          <SlideContent slide={slide} />
        </div>
      </div>
    </m.article>
  );
}

function SlideContent({ slide }: { slide: (typeof PITCH_SLIDES)[number] }) {
  return resolveSlideComponent(slide, "responsive");
}
