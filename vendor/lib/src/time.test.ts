import {
  formatRelativeTimeToNow,
  formatUtcCalendarDate,
} from "@vendor/lib/time";
import { describe, expect, it, vi } from "vitest";

describe("time helpers", () => {
  it("formats UTC-anchored calendar dates without local timezone shifts", () => {
    const date = new Date("2026-05-01T00:00:00Z");

    expect(formatUtcCalendarDate(date, "en-US")).toBe("May 1, 2026");
    expect(formatUtcCalendarDate(null, "en-US")).toBeNull();
  });

  it("formats relative time labels through one shared settings helper", () => {
    vi.setSystemTime(new Date("2026-05-21T00:00:00Z"));

    expect(
      formatRelativeTimeToNow(new Date("2026-05-20T00:00:00Z"), {
        addSuffix: true,
      })
    ).toBe("1 day ago");

    vi.useRealTimers();
  });
});
