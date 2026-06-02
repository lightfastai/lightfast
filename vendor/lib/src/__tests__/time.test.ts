import {
  formatDuration,
  formatRelativeTimeToNow,
  formatUtcCalendarDate,
} from "@vendor/lib/time";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("time helpers", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("formats UTC-anchored calendar dates without local timezone shifts", () => {
    const date = new Date("2026-05-01T00:00:00Z");

    expect(formatUtcCalendarDate(date, "en-US")).toBe("May 1, 2026");
    expect(formatUtcCalendarDate(0, "en-US")).toBe("Jan 1, 1970");
    expect(formatUtcCalendarDate(null, "en-US")).toBeNull();
  });

  it("formats relative time labels through one shared settings helper", () => {
    vi.setSystemTime(new Date("2026-05-21T00:00:00Z"));

    expect(
      formatRelativeTimeToNow(new Date("2026-05-20T00:00:00Z"), {
        addSuffix: true,
      })
    ).toBe("1 day ago");
  });

  it("formats durations across millisecond, second, minute, and hour ranges", () => {
    expect(formatDuration(820)).toBe("820ms");
    expect(formatDuration(3200)).toBe("3.2s");
    expect(formatDuration(45_000)).toBe("45s");
    expect(formatDuration(125_000)).toBe("2m 5s");
    expect(formatDuration(120_000)).toBe("2m");
    expect(formatDuration(4_320_000)).toBe("1h 12m");
    expect(formatDuration(3_600_000)).toBe("1h");
  });

  it("returns an em dash for negative or non-finite durations", () => {
    expect(formatDuration(-1)).toBe("—");
    expect(formatDuration(Number.NaN)).toBe("—");
    expect(formatDuration(Number.POSITIVE_INFINITY)).toBe("—");
  });
});
