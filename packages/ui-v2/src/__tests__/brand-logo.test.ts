import { describe, expect, it } from "vitest";

import {
  getLogoMetrics,
  LOGO_MARK_VIEWBOX_SIZE,
  LOGO_PAPER_SPECIMEN_MARK_SIZE,
  LOGO_VISIBLE_GAP_PITCHES,
  WORDMARK_LOCKUP_VIEWBOX_HEIGHT,
  WORDMARK_LOCKUP_VIEWBOX_Y,
} from "../components/brand/logo";

describe("logo geometry", () => {
  it("derives the Paper balanced lockup from the dot pitch system", () => {
    const metrics = getLogoMetrics(LOGO_PAPER_SPECIMEN_MARK_SIZE);

    expect(metrics.markSize).toBe(86);
    expect(metrics.wordmarkSize).toBeCloseTo(88, 6);
    expect(metrics.visibleGap).toBeCloseTo(25.8, 6);
    expect(metrics.gap).toBeCloseTo(18.936, 3);
    expect(metrics.wordmarkHeight).toBeCloseTo(105, 6);
    expect(metrics.wordmarkPathHeight).toBeCloseTo(80.96, 6);
    expect(metrics.wordmarkPathTopPadding).toBeCloseTo(22.4, 6);
    expect(metrics.wordmarkTopInset).toBeCloseTo(12.9, 6);
    expect(metrics.wordmarkWidth).toBeCloseTo(365.64, 6);
    expect(WORDMARK_LOCKUP_VIEWBOX_Y).toBeCloseTo(-970.545_454_545_454_5, 6);
    expect(WORDMARK_LOCKUP_VIEWBOX_HEIGHT).toBeCloseTo(1193.181_818_181_818, 6);
  });

  it("keeps every rendered size on the same pitch-derived spacing scale", () => {
    const metrics = getLogoMetrics(56);

    expect(LOGO_VISIBLE_GAP_PITCHES).toBe(2);
    expect(metrics.dotPitch).toBeCloseTo(8.4, 6);
    expect(metrics.dotDiameter).toBeCloseTo(5.6, 6);
    expect(metrics.wordmarkTopInset).toBeCloseTo(metrics.dotPitch, 6);
    expect(metrics.visibleGap).toBeCloseTo(
      (56 / LOGO_MARK_VIEWBOX_SIZE) * 24,
      6
    );
  });
});
