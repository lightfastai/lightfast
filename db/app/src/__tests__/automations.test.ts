import type { SQL } from "drizzle-orm";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import { describe, expect, it, vi } from "vitest";

import type { Database } from "../client";
import {
  calculateNextRunAt,
  markAutomationRunFailed,
} from "../utils/automations";

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

  it("returns the next daily time in the requested timezone", () => {
    const next = calculateNextRunAt({
      after: new Date("2026-05-27T22:15:00.000Z"),
      schedule: {
        kind: "daily",
        config: { time: "09:30" },
      },
      timezone: "Australia/Melbourne",
    });

    expect(next.toISOString()).toBe("2026-05-27T23:30:00.000Z");
  });

  it("handles daylight saving transitions for daily schedules", () => {
    const next = calculateNextRunAt({
      after: new Date("2026-10-03T20:00:00.000Z"),
      schedule: {
        kind: "daily",
        config: { time: "09:30" },
      },
      timezone: "Australia/Melbourne",
    });

    expect(next.toISOString()).toBe("2026-10-03T22:30:00.000Z");
  });
});

describe("markAutomationRunFailed", () => {
  it("only marks pending or running automation runs as failed", async () => {
    const whereMock = vi.fn((_: SQL) => ({ affectedRows: 0 }));
    const setMock = vi.fn(() => ({ where: whereMock }));
    const db = {
      update: vi.fn(() => ({ set: setMock })),
    } as unknown as Database;

    await expect(
      markAutomationRunFailed(db, {
        clerkOrgId: "org_test",
        errorCode: "TEST_ERROR",
        errorMessage: "Test failure",
        publicId: "automation_run_123e4567-e89b-12d3-a456-426614174000",
      })
    ).resolves.toBe(false);

    const condition = whereMock.mock.calls[0]?.[0];
    expect(condition).toBeDefined();
    if (!condition) {
      throw new Error("expected update where condition");
    }
    const query = new MySqlDialect().sqlToQuery(condition);

    expect(query.sql).toContain("`status` in (?, ?)");
    expect(query.params).toEqual(
      expect.arrayContaining(["pending", "running"])
    );
  });
});
