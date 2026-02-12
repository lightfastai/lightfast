// --- Grid layout constants ---
export const GRID_COLS = 4;
export const GRID_GAP = 24; // px
export const GRID_ROW_GAP = 32; // px

export const GRID_ENTER_THRESHOLD = 0.92;
export const GRID_EXIT_THRESHOLD = 0.88;

/**
 * Determine if grid view should be active, with hysteresis.
 * Enter grid at GRID_ENTER_THRESHOLD, exit only below GRID_EXIT_THRESHOLD.
 */
export function shouldBeGridView(
  progress: number,
  currentlyGrid: boolean,
): boolean {
  if (currentlyGrid) {
    return progress >= GRID_EXIT_THRESHOLD;
  }
  return progress >= GRID_ENTER_THRESHOLD;
}

/**
 * Scroll-driven Y transform keyframes for a slide.
 */
export function getSlideYKeyframes(
  index: number,
  totalSlides: number,
): { input: number[]; output: string[] } {
  const slideStart = index / totalSlides;
  const slideEnd = (index + 1) / totalSlides;
  const isFirst = index === 0;

  if (isFirst) {
    return {
      input: [0, slideEnd, slideEnd + 0.1, slideEnd + 0.2, slideEnd + 0.3],
      output: ["0%", "-30px", "-50px", "-60px", "-60px"],
    };
  }

  return {
    input: [
      slideStart - 0.12,
      slideStart - 0.08,
      slideStart,
      slideEnd,
      slideEnd + 0.1,
      slideEnd + 0.2,
      slideEnd + 0.3,
    ],
    output: ["150vh", "150vh", "0%", "-30px", "-50px", "-60px", "-60px"],
  };
}

/**
 * Scroll-driven scale transform keyframes for a slide.
 */
export function getSlideScaleKeyframes(
  index: number,
  totalSlides: number,
): { input: number[]; output: number[] } {
  const slideStart = index / totalSlides;
  const slideEnd = (index + 1) / totalSlides;
  const isFirst = index === 0;

  if (isFirst) {
    return {
      input: [0, slideEnd, slideEnd + 0.1, slideEnd + 0.2, slideEnd + 0.3],
      output: [1, 0.95, 0.9, 0.85, 0.85],
    };
  }

  return {
    input: [
      slideStart - 0.08,
      slideStart,
      slideEnd,
      slideEnd + 0.1,
      slideEnd + 0.2,
      slideEnd + 0.3,
    ],
    output: [1, 1, 0.95, 0.9, 0.85, 0.85],
  };
}

/**
 * Scroll-driven opacity transform keyframes for a slide.
 */
export function getSlideOpacityKeyframes(
  index: number,
  totalSlides: number,
): { input: number[]; output: number[] } {
  const slideEnd = (index + 1) / totalSlides;
  return {
    input: [slideEnd + 0.15, slideEnd + 0.25, slideEnd + 0.35],
    output: [1, 0.6, 0],
  };
}

/**
 * Scroll-driven z-index transform keyframes for a slide.
 */
export function getSlideZIndexKeyframes(
  index: number,
  totalSlides: number,
): { input: number[]; output: number[] } {
  const slideStart = index / totalSlides;
  const slideEnd = (index + 1) / totalSlides;
  return {
    input: [slideStart - 0.1, slideStart, slideEnd],
    output: [index, index + 1, index + 1],
  };
}

/**
 * Indicator line opacity keyframes.
 */
export function getIndicatorOpacityKeyframes(
  index: number,
  totalSlides: number,
): { input: number[]; output: number[] } {
  const slideStart = index / totalSlides;
  const slideEnd = (index + 1) / totalSlides;
  return {
    input: [slideStart - 0.05, slideStart, slideEnd - 0.05, slideEnd],
    output: [0.3, 1, 1, 0.3],
  };
}

/**
 * Indicator line width keyframes.
 */
export function getIndicatorWidthKeyframes(
  index: number,
  totalSlides: number,
): { input: number[]; output: number[] } {
  const slideStart = index / totalSlides;
  const slideEnd = (index + 1) / totalSlides;
  return {
    input: [slideStart - 0.05, slideStart, slideEnd - 0.05, slideEnd],
    output: [24, 40, 40, 24],
  };
}

/**
 * Calculate grid thumbnail dimensions from container width.
 */
export function getGridDimensions(containerWidth: number) {
  const thumbWidth =
    containerWidth > 0
      ? (containerWidth - (GRID_COLS - 1) * GRID_GAP) / GRID_COLS
      : 0;
  const thumbHeight = thumbWidth * (9 / 16);
  const gridScale = containerWidth > 0 ? thumbWidth / containerWidth : 0.25;
  const rowHeight = thumbHeight + GRID_ROW_GAP;
  return { thumbWidth, thumbHeight, gridScale, rowHeight };
}

/**
 * Calculate grid position for a slide at the given index.
 */
export function getGridPosition(
  index: number,
  thumbWidth: number,
  rowHeight: number,
) {
  const col = index % GRID_COLS;
  const row = Math.floor(index / GRID_COLS);
  return {
    x: col * (thumbWidth + GRID_GAP),
    y: row * rowHeight,
  };
}

/**
 * Determine which slide is active based on scroll progress.
 */
export function getSlideIndexFromProgress(
  progress: number,
  totalSlides: number,
): number {
  return Math.min(Math.floor(progress * totalSlides), totalSlides - 1);
}

/**
 * Calculate the correct scroll target for a given slide index.
 * Total scroll height = (totalSlides + 1) * viewport, so each slide
 * maps to scrollHeight / (totalSlides + 1) pixels of scroll.
 */
export function getScrollTargetForSlide(
  index: number,
  totalSlides: number,
  scrollHeight: number,
): number {
  const scrollPerSlide = scrollHeight / (totalSlides + 1);
  return index * scrollPerSlide;
}

/**
 * Reverse stagger delay: last card animates first.
 */
export function getStaggerDelay(index: number, totalSlides: number): number {
  return (totalSlides - 1 - index) * 0.05;
}
