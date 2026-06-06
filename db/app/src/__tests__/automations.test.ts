import type { SQL } from "drizzle-orm";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import { describe, expect, it, vi } from "vitest";

import type { Database } from "../client";
import {
  calculateNextRunAt,
  createAutomation,
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

    expect(next?.toISOString()).toBe("2026-05-27T11:00:00.000Z");
  });

  it("returns the next daily UTC time when today's time has passed", () => {
    const next = calculateNextRunAt({
      after: new Date("2026-05-27T10:15:00.000Z"),
      schedule: {
        kind: "daily",
        config: { time: "09:30" },
      },
    });

    expect(next?.toISOString()).toBe("2026-05-28T09:30:00.000Z");
  });

  it("returns today's daily UTC time when it is still in the future", () => {
    const next = calculateNextRunAt({
      after: new Date("2026-05-27T08:15:00.000Z"),
      schedule: {
        kind: "daily",
        config: { time: "09:30" },
      },
    });

    expect(next?.toISOString()).toBe("2026-05-27T09:30:00.000Z");
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

    expect(next?.toISOString()).toBe("2026-05-27T23:30:00.000Z");
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

    expect(next?.toISOString()).toBe("2026-10-03T22:30:00.000Z");
  });

  it("returns null for manual schedules", () => {
    expect(
      calculateNextRunAt({
        after: new Date("2026-05-27T10:15:00.000Z"),
        schedule: { kind: "manual", config: {} },
      })
    ).toBeNull();
  });

  it("skips weekend days for weekdays schedules", () => {
    // 2026-05-30 is a Saturday (UTC); next weekday run is Monday 2026-06-01.
    const next = calculateNextRunAt({
      after: new Date("2026-05-30T10:00:00.000Z"),
      schedule: { kind: "weekdays", config: { time: "09:00" } },
    });

    expect(next?.toISOString()).toBe("2026-06-01T09:00:00.000Z");
  });

  it("returns today for a weekdays schedule when the weekday time is still ahead", () => {
    // 2026-05-27 is a Wednesday (UTC); 09:00 is still ahead of 08:15.
    const next = calculateNextRunAt({
      after: new Date("2026-05-27T08:15:00.000Z"),
      schedule: { kind: "weekdays", config: { time: "09:00" } },
    });

    expect(next?.toISOString()).toBe("2026-05-27T09:00:00.000Z");
  });

  it("returns the next matching weekday for weekly schedules", () => {
    // 2026-05-27 is a Wednesday (UTC, getUTCDay() === 3); next Monday (1) is 2026-06-01.
    const next = calculateNextRunAt({
      after: new Date("2026-05-27T08:15:00.000Z"),
      schedule: { kind: "weekly", config: { dayOfWeek: 1, time: "09:00" } },
    });

    expect(next?.toISOString()).toBe("2026-06-01T09:00:00.000Z");
  });

  it("returns today for a weekly schedule when today matches and the time is ahead", () => {
    // 2026-05-27 is a Wednesday (getUTCDay() === 3); time 09:00 is ahead of 08:15.
    const next = calculateNextRunAt({
      after: new Date("2026-05-27T08:15:00.000Z"),
      schedule: { kind: "weekly", config: { dayOfWeek: 3, time: "09:00" } },
    });

    expect(next?.toISOString()).toBe("2026-05-27T09:00:00.000Z");
  });
});

describe("createAutomation", () => {
  it("persists the selected connector provider", async () => {
    let insertedPublicId = "";
    const valuesMock = vi.fn((values: { publicId: string }) => {
      insertedPublicId = values.publicId;
      return Promise.resolve();
    });
    const limitMock = vi.fn(async () => [
      {
        id: 1,
        publicId: insertedPublicId,
        clerkOrgId: "org_test",
        connectorProvider: "linear",
        createdByUserId: "user_test",
        name: "Linear triage",
        prompt: "Create follow-up issues.",
        scheduleKind: "manual",
        scheduleConfig: {},
        timezone: "UTC",
        status: "active",
        nextRunAt: null,
        lastRunAt: null,
        scheduleVersion: 1,
        createdAt: new Date("2026-05-27T00:00:00.000Z"),
        updatedAt: new Date("2026-05-27T00:00:00.000Z"),
      },
    ]);
    const db = {
      insert: vi.fn(() => ({ values: valuesMock })),
      select: vi.fn(() => ({
        from: () => ({
          where: () => ({
            limit: limitMock,
          }),
        }),
      })),
    } as unknown as Database;

    await expect(
      createAutomation(
        db,
        {
          clerkOrgId: "org_test",
          connectorProvider: "linear",
          createdByUserId: "user_test",
          name: "Linear triage",
          prompt: "Create follow-up issues.",
          schedule: { kind: "manual", config: {} },
        },
        { now: new Date("2026-05-27T00:00:00.000Z") }
      )
    ).resolves.toMatchObject({
      connectorProvider: "linear",
    });

    expect(valuesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        connectorProvider: "linear",
      })
    );
  });

  it("persists no connector provider when the automation has no connector", async () => {
    let insertedPublicId = "";
    const valuesMock = vi.fn((values: { publicId: string }) => {
      insertedPublicId = values.publicId;
      return Promise.resolve();
    });
    const limitMock = vi.fn(async () => [
      {
        id: 1,
        publicId: insertedPublicId,
        clerkOrgId: "org_test",
        connectorProvider: null,
        createdByUserId: "user_test",
        name: "Daily summary",
        prompt: "Summarize the workspace.",
        scheduleKind: "manual",
        scheduleConfig: {},
        timezone: "UTC",
        status: "active",
        nextRunAt: null,
        lastRunAt: null,
        scheduleVersion: 1,
        createdAt: new Date("2026-05-27T00:00:00.000Z"),
        updatedAt: new Date("2026-05-27T00:00:00.000Z"),
      },
    ]);
    const db = {
      insert: vi.fn(() => ({ values: valuesMock })),
      select: vi.fn(() => ({
        from: () => ({
          where: () => ({
            limit: limitMock,
          }),
        }),
      })),
    } as unknown as Database;

    await expect(
      createAutomation(
        db,
        {
          clerkOrgId: "org_test",
          createdByUserId: "user_test",
          name: "Daily summary",
          prompt: "Summarize the workspace.",
          schedule: { kind: "manual", config: {} },
        },
        { now: new Date("2026-05-27T00:00:00.000Z") }
      )
    ).resolves.toMatchObject({
      connectorProvider: null,
    });

    expect(valuesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        connectorProvider: null,
      })
    );
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
