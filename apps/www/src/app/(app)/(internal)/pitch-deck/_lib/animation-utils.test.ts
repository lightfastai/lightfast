import { describe, it, expect } from "vitest";
import {
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
  shouldBeGridView,
  GRID_COLS,
  GRID_GAP,
  GRID_ROW_GAP,
  GRID_ENTER_THRESHOLD,
} from "./animation-utils";

const TOTAL = 10;

describe("getSlideYKeyframes", () => {
  it("returns 5 keyframes for the first slide", () => {
    const kf = getSlideYKeyframes(0, TOTAL);
    expect(kf.input).toHaveLength(5);
    expect(kf.output).toHaveLength(5);
    expect(kf.output[0]).toBe("0%");
  });

  it("returns 7 keyframes for non-first slides", () => {
    const kf = getSlideYKeyframes(3, TOTAL);
    expect(kf.input).toHaveLength(7);
    expect(kf.output).toHaveLength(7);
    expect(kf.output[0]).toBe("150vh");
    expect(kf.output[2]).toBe("0%");
  });
});

describe("getSlideScaleKeyframes", () => {
  it("returns 5 keyframes for the first slide", () => {
    const kf = getSlideScaleKeyframes(0, TOTAL);
    expect(kf.input).toHaveLength(5);
    expect(kf.output).toHaveLength(5);
  });

  it("returns 6 keyframes for non-first slides", () => {
    const kf = getSlideScaleKeyframes(5, TOTAL);
    expect(kf.input).toHaveLength(6);
    expect(kf.output).toHaveLength(6);
  });

  it("scale values decrease monotonically for first slide", () => {
    const kf = getSlideScaleKeyframes(0, TOTAL);
    for (let i = 1; i < kf.output.length; i++) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      expect(kf.output[i]).toBeLessThanOrEqual(kf.output[i - 1]!);
    }
  });
});

describe("getSlideOpacityKeyframes", () => {
  it("fades from 1 to 0", () => {
    const kf = getSlideOpacityKeyframes(2, TOTAL);
    expect(kf.output[0]).toBe(1);
    expect(kf.output[kf.output.length - 1]).toBe(0);
  });
});

describe("getSlideZIndexKeyframes", () => {
  it("z-index increases at slideStart", () => {
    const kf = getSlideZIndexKeyframes(3, TOTAL);
    expect(kf.output[0]).toBe(3);
    expect(kf.output[1]).toBe(4);
    expect(kf.output[2]).toBe(4);
  });
});

describe("getIndicatorOpacityKeyframes", () => {
  it("returns symmetric fade pattern", () => {
    const kf = getIndicatorOpacityKeyframes(2, TOTAL);
    expect(kf.output).toEqual([0.3, 1, 1, 0.3]);
  });
});

describe("getIndicatorWidthKeyframes", () => {
  it("returns symmetric width pattern", () => {
    const kf = getIndicatorWidthKeyframes(2, TOTAL);
    expect(kf.output).toEqual([24, 40, 40, 24]);
  });
});

describe("getGridDimensions", () => {
  it("calculates correct thumbnail sizing", () => {
    const containerWidth = 1200;
    const { thumbWidth, thumbHeight, gridScale, rowHeight } =
      getGridDimensions(containerWidth);

    const expectedThumbWidth = (1200 - 3 * GRID_GAP) / GRID_COLS;
    expect(thumbWidth).toBe(expectedThumbWidth);
    expect(thumbHeight).toBe(expectedThumbWidth * (9 / 16));
    expect(gridScale).toBe(expectedThumbWidth / 1200);
    expect(rowHeight).toBe(thumbHeight + GRID_ROW_GAP);
  });

  it("handles containerWidth=0", () => {
    const { thumbWidth, gridScale } = getGridDimensions(0);
    expect(thumbWidth).toBe(0);
    expect(gridScale).toBe(0.25);
  });
});

describe("getGridPosition", () => {
  it("lays out 4 columns correctly", () => {
    const thumbWidth = 282;
    const rowHeight = 200;

    // First row
    expect(getGridPosition(0, thumbWidth, rowHeight)).toEqual({ x: 0, y: 0 });
    expect(getGridPosition(1, thumbWidth, rowHeight)).toEqual({
      x: 1 * (thumbWidth + GRID_GAP),
      y: 0,
    });
    expect(getGridPosition(3, thumbWidth, rowHeight)).toEqual({
      x: 3 * (thumbWidth + GRID_GAP),
      y: 0,
    });

    // Second row
    expect(getGridPosition(4, thumbWidth, rowHeight)).toEqual({
      x: 0,
      y: rowHeight,
    });
    expect(getGridPosition(7, thumbWidth, rowHeight)).toEqual({
      x: 3 * (thumbWidth + GRID_GAP),
      y: rowHeight,
    });

    // Third row
    expect(getGridPosition(8, thumbWidth, rowHeight)).toEqual({
      x: 0,
      y: 2 * rowHeight,
    });
    expect(getGridPosition(9, thumbWidth, rowHeight)).toEqual({
      x: 1 * (thumbWidth + GRID_GAP),
      y: 2 * rowHeight,
    });
  });
});

describe("getSlideIndexFromProgress", () => {
  it("returns 0 at progress 0", () => {
    expect(getSlideIndexFromProgress(0, TOTAL)).toBe(0);
  });

  it("returns middle slide at 0.5", () => {
    expect(getSlideIndexFromProgress(0.5, TOTAL)).toBe(5);
  });

  it("clamps to last slide at 0.99", () => {
    expect(getSlideIndexFromProgress(0.99, TOTAL)).toBe(9);
  });

  it("clamps to last slide at 1.0", () => {
    expect(getSlideIndexFromProgress(1.0, TOTAL)).toBe(9);
  });
});

describe("getScrollTargetForSlide", () => {
  it("divides by (totalSlides + 1)", () => {
    const scrollHeight = 11000; // (10 + 1) * 1000
    const target = getScrollTargetForSlide(3, TOTAL, scrollHeight);
    expect(target).toBe(3 * (scrollHeight / (TOTAL + 1)));
    expect(target).toBe(3000);
  });

  it("returns 0 for index 0", () => {
    expect(getScrollTargetForSlide(0, TOTAL, 11000)).toBe(0);
  });
});

describe("getStaggerDelay", () => {
  it("first slide gets max delay", () => {
    expect(getStaggerDelay(0, TOTAL)).toBe((TOTAL - 1) * 0.05);
  });

  it("last slide gets 0 delay", () => {
    expect(getStaggerDelay(TOTAL - 1, TOTAL)).toBe(0);
  });

  it("reverses order", () => {
    const delay0 = getStaggerDelay(0, TOTAL);
    const delay5 = getStaggerDelay(5, TOTAL);
    const delay9 = getStaggerDelay(9, TOTAL);
    expect(delay0).toBeGreaterThan(delay5);
    expect(delay5).toBeGreaterThan(delay9);
  });
});

describe("shouldBeGridView", () => {
  it("enters grid above enter threshold", () => {
    expect(shouldBeGridView(0.93, false)).toBe(true);
  });

  it("stays in grid above exit threshold", () => {
    expect(shouldBeGridView(0.90, true)).toBe(true);
  });

  it("exits grid below exit threshold", () => {
    expect(shouldBeGridView(0.87, true)).toBe(false);
  });

  it("stays out of grid below enter threshold", () => {
    expect(shouldBeGridView(0.90, false)).toBe(false);
  });
});

describe("constants", () => {
  it("exports expected values", () => {
    expect(GRID_COLS).toBe(4);
    expect(GRID_GAP).toBe(24);
    expect(GRID_ROW_GAP).toBe(32);
    expect(GRID_ENTER_THRESHOLD).toBe(0.92);
  });
});
