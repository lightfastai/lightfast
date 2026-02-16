import { describe, it, expect } from "vitest";
import {
  getSlideYKeyframes,
  getSlideScaleKeyframes,
  getSlideOpacityKeyframes,
  getSlideZIndexKeyframes,
  getIndicatorOpacityKeyframes,
  getIndicatorWidthKeyframes,
  getSlideIndexFromProgress,
  getScrollTargetForSlide,
} from "./animation-utils";

const TOTAL = 10;

describe("getSlideYKeyframes", () => {
  it("returns 5 keyframes for the first slide", () => {
    const kf = getSlideYKeyframes(0, TOTAL);
    expect(kf.input).toHaveLength(5);
    expect(kf.output).toHaveLength(5);
    expect(kf.output[0]).toBe("0%");
  });

  it("returns 6 keyframes for non-first slides", () => {
    const kf = getSlideYKeyframes(3, TOTAL);
    expect(kf.input).toHaveLength(6);
    expect(kf.output).toHaveLength(6);
    expect(kf.output[0]).toBe("150vh");
    expect(kf.output[1]).toBe("0%");
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
