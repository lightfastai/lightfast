import { describe, expect, it } from "vitest";

import { calculateNextRunAt } from "../utils/automations";

describe("calculateNextRunAt", () => {
  it("advances hourly schedules to the next future occurrence", () => {
    const next = calculateNextRunAt({
      after: new Date("2026-05-27T10:15:00.000Z"),
      from: new Date("2026-05-27T08:00:00.000Z"),
      schedule: {
        kind: "hourly",
        config: { intervalHours: 1 },
      },
    });

    expect(next.toISOString()).toBe("2026-05-27T11:00:00.000Z");
  });

  it("returns the next daily UTC time when today's time has passed", () => {
    const next = calculateNextRunAt({
      after: new Date("2026-05-27T10:15:00.000Z"),
      schedule: {
        kind: "daily",
        config: { time: "09:30" },
      },
    });

    expect(next.toISOString()).toBe("2026-05-28T09:30:00.000Z");
  });

  it("returns today's daily UTC time when it is still in the future", () => {
    const next = calculateNextRunAt({
      after: new Date("2026-05-27T08:15:00.000Z"),
      schedule: {
        kind: "daily",
        config: { time: "09:30" },
      },
    });

    expect(next.toISOString()).toBe("2026-05-27T09:30:00.000Z");
  });
});
