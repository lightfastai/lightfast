"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronUp, ChevronDown } from "lucide-react";
import { Icons } from "@repo/ui/components/icons";

interface Slide {
  id: string;
  title?: string;
  content: string[];
  bgColor: string;
  textColor: string;
  type: "intro" | "statement" | "details";
}

const slides: Slide[] = [
  {
    id: "intro",
    bgColor: "bg-gradient-to-br from-red-500 to-orange-600",
    textColor: "text-white",
    type: "intro",
    content: ["LIGHTFAST"],
  },
  {
    id: "greeting",
    bgColor: "bg-gradient-to-br from-pink-200 to-orange-200",
    textColor: "text-gray-900",
    type: "statement",
    title: "Hi, we are Lightfast.",
    content: [],
  },
  {
    id: "vision",
    bgColor: "bg-white",
    textColor: "text-gray-900",
    type: "details",
    title: "Meticulous and experienced.",
    content: [
      "We're building the execution layer for the agent economy",
      "Making AI workflows production-ready by default",
      "Abstracting infrastructure complexity so you can focus on building",
      "From prototype to planet-scale in minutes, not months",
    ],
  },
  {
    id: "principles",
    bgColor: "bg-gradient-to-br from-gray-900 to-gray-800",
    textColor: "text-white",
    type: "statement",
    title: "MCP-First Architecture",
    content: [
      "Universal protocol for AI tool integration",
      "Context over configuration",
      "Security by design, not afterthought",
      "Composable and extensible at every layer",
    ],
  },
  {
    id: "capability",
    bgColor: "bg-white",
    textColor: "text-gray-900",
    type: "details",
    title: "Production is the Benchmark",
    content: [
      "State-machine orchestration for complex workflows",
      "Intelligent resource scheduling and management",
      "Built-in guardrails and runtime constraints",
      "Human-in-the-loop when you need it",
    ],
  },
  {
    id: "marketplace",
    bgColor: "bg-gradient-to-br from-blue-600 to-blue-700",
    textColor: "text-white",
    type: "statement",
    title: "The Agent Marketplace",
    content: [
      "Discover and deploy pre-built agents",
      "Share your agents with the community",
      "Monetize your AI expertise",
      "Composable building blocks for any workflow",
    ],
  },
  {
    id: "mission",
    bgColor: "bg-gray-50",
    textColor: "text-gray-900",
    type: "details",
    title: "Jarvis for Everyone",
    content: [
      "Making AI orchestration accessible to all developers",
      "From simple automations to AGI-level coordination",
      "Your infrastructure should scale with your ambition",
      "Building the brain that orchestrates everything",
    ],
  },
];

export function ManifestoPresentation() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [previousSlide, setPreviousSlide] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [hasInteracted, setHasInteracted] = useState(false);

  // Minimum swipe distance for trigger (in px)
  const minSwipeDistance = 50;

  // Track navigation direction
  const isMovingForward = currentSlide > previousSlide;

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isAnimating) return;

      if (e.key === "ArrowDown" || e.key === " " || e.key === "PageDown") {
        e.preventDefault();
        navigateToSlide(Math.min(currentSlide + 1, slides.length - 1));
      } else if (e.key === "ArrowUp" || e.key === "PageUp") {
        e.preventDefault();
        navigateToSlide(Math.max(currentSlide - 1, 0));
      } else if (e.key === "Home") {
        e.preventDefault();
        navigateToSlide(0);
      } else if (e.key === "End") {
        e.preventDefault();
        navigateToSlide(slides.length - 1);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentSlide, isAnimating]);

  // Mouse wheel navigation with throttling
  useEffect(() => {
    let lastWheelTime = 0;
    const wheelThrottle = 50; // ms

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();

      const now = Date.now();
      if (now - lastWheelTime < wheelThrottle) return;
      lastWheelTime = now;

      if (isAnimating) return;

      if (e.deltaY > 30) {
        navigateToSlide(Math.min(currentSlide + 1, slides.length - 1));
      } else if (e.deltaY < -30) {
        navigateToSlide(Math.max(currentSlide - 1, 0));
      }
    };

    window.addEventListener("wheel", handleWheel, { passive: false });
    return () => window.removeEventListener("wheel", handleWheel);
  }, [currentSlide, isAnimating]);

  // Touch handlers for swipe navigation
  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientY);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientY);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;

    const distance = touchStart - touchEnd;
    const isUpSwipe = distance > minSwipeDistance;
    const isDownSwipe = distance < -minSwipeDistance;

    if (isUpSwipe) {
      navigateToSlide(Math.min(currentSlide + 1, slides.length - 1));
    }
    if (isDownSwipe) {
      navigateToSlide(Math.max(currentSlide - 1, 0));
    }
  };

  const navigateToSlide = (index: number) => {
    if (index !== currentSlide && !isAnimating) {
      setHasInteracted(true);
      setIsAnimating(true);
      setPreviousSlide(currentSlide);
      setCurrentSlide(index);
      setTimeout(() => setIsAnimating(false), 700);
    }
  };

  return (
    <div
      className="relative w-full h-full overflow-hidden"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Slide Stack - Centered container with 2:3 aspect ratio */}
      <div className="absolute inset-0 flex items-center justify-center p-8">
        <div
          className="relative w-full max-w-6xl"
          style={{ aspectRatio: "3/2" }}
        >
          <AnimatePresence mode="sync">
            {slides.map((slide, index) => {
              const isActive = index === currentSlide;
              const isPast = index < currentSlide;
              const isFuture = index > currentSlide;
              const slideDistance = currentSlide - index;
              const wasPreviouslyActive = index === previousSlide;

              // Don't render slides that are too far away
              if (slideDistance > 2 && !wasPreviouslyActive) return null;
              if (isFuture && !wasPreviouslyActive) return null;

              // Determine animation based on navigation direction
              let animateY = "0%";
              let animateOpacity: number | undefined = undefined;
              let animateScale = 1;

              if (isActive) {
                // Current active slide - always centered and fully visible
                animateY = "0%";
                animateScale = 1;
                // No opacity change - stays at 1
              } else if (wasPreviouslyActive && !isMovingForward) {
                // When moving backward, previously active slide exits downward
                // NO fade out - keep full opacity during exit
                animateY = "100%";
                animateScale = 1;
              } else if (isPast) {
                // Past slides (behind the active slide) - offset and faded
                animateY = `-${slideDistance * 40}px`;
                animateScale = 1 - slideDistance * 0.03;
                animateOpacity = slideDistance === 1 ? 0.5 : 0.2;
              } else if (isFuture) {
                // Future slides stay below - full opacity (no fade)
                animateY = "100%";
              }

              return (
                <motion.div
                  key={slide.id}
                  className={`absolute inset-0 rounded-xl shadow-2xl overflow-hidden`}
                  initial={
                    // First card on initial load should not slide up
                    index === 0 && !hasInteracted ? { y: "0%" } : { y: "100%" }
                  }
                  animate={{
                    y: animateY,
                    scale: animateScale,
                    // Only apply opacity if defined (not for active slide)
                    ...(animateOpacity !== undefined && {
                      opacity: animateOpacity,
                    }),
                  }}
                  exit={{
                    y: "100%",
                    scale: 1,
                    // No opacity fade on exit
                  }}
                  transition={{
                    duration: 0.7,
                    ease: [0.32, 0.72, 0, 1],
                  }}
                  style={{
                    zIndex: isActive
                      ? 40
                      : wasPreviouslyActive
                        ? 35
                        : isPast
                          ? 30 - slideDistance
                          : 10,
                    boxShadow: isActive
                      ? "0 25px 50px -12px rgba(0, 0, 0, 0.5)"
                      : "0 10px 25px -5px rgba(0, 0, 0, 0.2)",
                  }}
                >
                  {/* Background layer */}
                  <div className={`absolute inset-0 ${slide.bgColor}`} />

                  {/* Content layer */}
                  <div
                    className={`relative w-full h-full flex flex-col items-center justify-center px-16 py-12 overflow-hidden ${slide.textColor}`}
                  >
                    {/* Grid pattern overlay for certain slides */}
                    {(slide.type === "intro" || slide.id === "principles") && (
                      <div className="absolute inset-0 opacity-10">
                        <div
                          className="absolute inset-0"
                          style={{
                            backgroundImage: `linear-gradient(90deg, currentColor 1px, transparent 1px), linear-gradient(currentColor 1px, transparent 1px)`,
                            backgroundSize: "50px 50px",
                          }}
                        />
                      </div>
                    )}

                    {/* Logo or graphic for intro slide */}
                    {slide.type === "intro" && (
                      <motion.div
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 0.3, duration: 0.5 }}
                        className="relative"
                      >
                        <Icons.logo className="w-64 h-64 text-white" />
                        <motion.div
                          className="absolute -bottom-10 left-1/2 -translate-x-1/2 text-white/60 text-sm uppercase tracking-[0.3em] font-medium"
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.8 }}
                        >
                          {slide.content[0]}
                        </motion.div>
                      </motion.div>
                    )}

                    {/* Main content */}
                    {slide.type === "statement" && (
                      <motion.div
                        className="text-center max-w-4xl"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                      >
                        <h1 className="text-7xl font-light tracking-tight mb-8">
                          {slide.title}
                        </h1>
                        {slide.content.length > 0 && (
                          <div className="space-y-4 mt-12">
                            {slide.content.map((line, i) => (
                              <motion.p
                                key={i}
                                className="text-lg opacity-70 leading-relaxed"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 0.7, x: 0 }}
                                transition={{ delay: 0.4 + i * 0.1 }}
                              >
                                {line}
                              </motion.p>
                            ))}
                          </div>
                        )}
                      </motion.div>
                    )}

                    {/* Details slide */}
                    {slide.type === "details" && (
                      <div className="w-full max-w-4xl">
                        <div className="grid grid-cols-5 gap-6">
                          <div className="col-span-2">
                            <motion.h2
                              className="text-3xl font-bold leading-tight"
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: 0.3 }}
                            >
                              {slide.title}
                            </motion.h2>
                            <motion.div
                              className="mt-3 text-xs uppercase tracking-wider opacity-50"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 0.5 }}
                              transition={{ delay: 0.5 }}
                            >
                              TO GET WHERE WE ARE TODAY,
                              <br />
                              WE TEAMED UP WITH THE BEST
                              <br />
                              SPECIALISTS.
                            </motion.div>
                          </div>
                          <div className="col-span-3">
                            <div className="space-y-4 pt-1">
                              {slide.content.map((line, i) => (
                                <motion.div
                                  key={i}
                                  className="relative pl-6"
                                  initial={{ opacity: 0, x: -30 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  transition={{ delay: 0.4 + i * 0.1 }}
                                >
                                  <div className="absolute left-0 top-2 w-3 h-[1px] bg-current opacity-30" />
                                  <p className="text-base leading-relaxed">
                                    {line}
                                  </p>
                                </motion.div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Slide number indicator */}
                    <div className="absolute bottom-8 left-8 text-sm opacity-50">
                      {String(index + 1).padStart(2, "0")} /{" "}
                      {String(slides.length).padStart(2, "0")}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>

      {/* Navigation Dots */}
      <div className="absolute right-12 top-1/2 -translate-y-1/2 z-50 flex flex-col gap-4">
        {slides.map((_, index) => {
          const isActive = index === currentSlide;
          const isPast = index < currentSlide;
          const isFuture = index > currentSlide;

          return (
            <button
              key={index}
              onClick={() => navigateToSlide(index)}
              className="group relative p-2"
              aria-label={`Go to slide ${index + 1}`}
              disabled={isAnimating}
            >
              <motion.div
                className={`relative w-2 h-2 rounded-full transition-colors duration-300 ${
                  isActive
                    ? "bg-white"
                    : isPast
                      ? "bg-white/40"
                      : "bg-white/20 hover:bg-white/30"
                }`}
                animate={{
                  scale: isActive ? 1.5 : 1,
                  transition: { duration: 0.3 },
                }}
              >
                {isActive && (
                  <motion.div
                    className="absolute inset-0 rounded-full bg-white"
                    initial={{ scale: 0 }}
                    animate={{ scale: 2, opacity: 0 }}
                    transition={{ duration: 1, repeat: Infinity }}
                  />
                )}
              </motion.div>
              <span className="absolute right-6 top-1/2 -translate-y-1/2 text-xs text-white opacity-0 group-hover:opacity-60 transition-opacity whitespace-nowrap">
                {index + 1}. {slides[index].title || slides[index].id}
              </span>
            </button>
          );
        })}
      </div>

      {/* Navigation Arrows */}
      <div className="absolute bottom-8 right-8 z-50 flex flex-col gap-2">
        <button
          onClick={() => navigateToSlide(Math.max(currentSlide - 1, 0))}
          className={`p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-all ${
            currentSlide === 0 ? "opacity-30 cursor-not-allowed" : ""
          }`}
          disabled={currentSlide === 0}
          aria-label="Previous slide"
        >
          <ChevronUp className="w-5 h-5 text-white" />
        </button>
        <button
          onClick={() =>
            navigateToSlide(Math.min(currentSlide + 1, slides.length - 1))
          }
          className={`p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-all ${
            currentSlide === slides.length - 1
              ? "opacity-30 cursor-not-allowed"
              : ""
          }`}
          disabled={currentSlide === slides.length - 1}
          aria-label="Next slide"
        >
          <ChevronDown className="w-5 h-5 text-white" />
        </button>
      </div>

      {/* Progress Bar */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-white/10 z-50">
        <motion.div
          className="h-full bg-white/60"
          initial={{ width: "0%" }}
          animate={{
            width: `${((currentSlide + 1) / slides.length) * 100}%`,
          }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
        />
      </div>
    </div>
  );
}

