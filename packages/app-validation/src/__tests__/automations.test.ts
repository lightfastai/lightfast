import { describe, expect, it } from "vitest";

import {
  AUTOMATION_ID_PREFIX,
  AUTOMATION_RUN_ID_PREFIX,
  automationIdSchema,
  automationRunIdSchema,
  createAutomationSchema,
  formatAutomationSchedule,
  formatClockTime,
  getAutomationRunSchema,
  normalizeAutomationSchedule,
  updateAutomationSchema,
} from "../schemas/automations";

describe("automation id schemas", () => {
  it("accepts ids using the shared automation prefixes", () => {
    expect(
      automationIdSchema.parse(
        `${AUTOMATION_ID_PREFIX}123e4567-e89b-12d3-a456-426614174000`
      )
    ).toBe(`${AUTOMATION_ID_PREFIX}123e4567-e89b-12d3-a456-426614174000`);

    expect(
      automationRunIdSchema.parse(
        `${AUTOMATION_RUN_ID_PREFIX}123e4567-e89b-12d3-a456-426614174000`
      )
    ).toBe(`${AUTOMATION_RUN_ID_PREFIX}123e4567-e89b-12d3-a456-426614174000`);
  });

  it("rejects ids with the wrong automation prefix", () => {
    expect(() =>
      automationIdSchema.parse(
        `${AUTOMATION_RUN_ID_PREFIX}123e4567-e89b-12d3-a456-426614174000`
      )
    ).toThrow();

    expect(() =>
      automationRunIdSchema.parse(
        `${AUTOMATION_ID_PREFIX}123e4567-e89b-12d3-a456-426614174000`
      )
    ).toThrow();
  });
});

describe("normalizeAutomationSchedule", () => {
  it("normalizes hourly schedules into a bounded interval", () => {
    expect(
      normalizeAutomationSchedule({
        kind: "hourly",
        config: { intervalHours: 6 },
      })
    ).toEqual({
      kind: "hourly",
      config: { intervalHours: 6 },
    });
  });

  it("normalizes daily schedules into a UTC HH:mm time", () => {
    expect(
      normalizeAutomationSchedule({
        kind: "daily",
        config: { time: "09:30" },
      })
    ).toEqual({
      kind: "daily",
      config: { time: "09:30" },
    });
  });

  it("normalizes manual schedules with an empty config", () => {
    expect(
      normalizeAutomationSchedule({
        kind: "manual",
        config: {},
      })
    ).toEqual({
      kind: "manual",
      config: {},
    });
  });

  it("rejects manual schedules carrying extra config keys", () => {
    expect(() =>
      normalizeAutomationSchedule({
        kind: "manual",
        config: { time: "09:00" },
      })
    ).toThrow();
  });

  it("normalizes weekdays schedules into a UTC HH:mm time", () => {
    expect(
      normalizeAutomationSchedule({
        kind: "weekdays",
        config: { time: "08:15" },
      })
    ).toEqual({
      kind: "weekdays",
      config: { time: "08:15" },
    });
  });

  it("normalizes weekly schedules with a dayOfWeek and time", () => {
    expect(
      normalizeAutomationSchedule({
        kind: "weekly",
        config: { dayOfWeek: 1, time: "09:00" },
      })
    ).toEqual({
      kind: "weekly",
      config: { dayOfWeek: 1, time: "09:00" },
    });
  });

  it("rejects weekly schedules with a dayOfWeek outside 0..6", () => {
    expect(() =>
      normalizeAutomationSchedule({
        kind: "weekly",
        config: { dayOfWeek: 7, time: "09:00" },
      })
    ).toThrow();
  });

  it("rejects hourly intervals outside 1..24", () => {
    expect(() =>
      normalizeAutomationSchedule({
        kind: "hourly",
        config: { intervalHours: 0 },
      })
    ).toThrow();
    expect(() =>
      normalizeAutomationSchedule({
        kind: "hourly",
        config: { intervalHours: 25 },
      })
    ).toThrow();
  });

  it("rejects daily times that aren't HH:mm", () => {
    expect(() =>
      normalizeAutomationSchedule({
        kind: "daily",
        config: { time: "9:30" },
      })
    ).toThrow();
    expect(() =>
      normalizeAutomationSchedule({
        kind: "daily",
        config: { time: "24:00" },
      })
    ).toThrow();
  });

  it("rejects mismatched kind/config pairs", () => {
    expect(() =>
      normalizeAutomationSchedule({
        kind: "hourly",
        config: { time: "09:00" },
      })
    ).toThrow();
  });
});

describe("automation schemas", () => {
  it("accepts a valid automation run id for run detail lookups", () => {
    expect(
      getAutomationRunSchema.parse({
        id: `${AUTOMATION_RUN_ID_PREFIX}123e4567-e89b-12d3-a456-426614174000`,
      })
    ).toEqual({
      id: `${AUTOMATION_RUN_ID_PREFIX}123e4567-e89b-12d3-a456-426614174000`,
    });
  });

  it("rejects an automation id for run detail lookups", () => {
    expect(() =>
      getAutomationRunSchema.parse({
        id: `${AUTOMATION_ID_PREFIX}123e4567-e89b-12d3-a456-426614174000`,
      })
    ).toThrow();
  });

  it("accepts a valid IANA timezone when creating an automation", () => {
    expect(
      createAutomationSchema.parse({
        connectorProvider: "linear",
        name: "Daily summary",
        prompt: "Summarize my day",
        schedule: {
          kind: "daily",
          config: { time: "09:00" },
        },
        targetKind: "connector",
        timezone: "Australia/Melbourne",
      })
    ).toMatchObject({
      timezone: "Australia/Melbourne",
    });
  });

  it("accepts an explicit connector target when creating an automation", () => {
    expect(
      createAutomationSchema.parse({
        connectorProvider: "x",
        name: "Daily summary",
        prompt: "Summarize my day",
        schedule: {
          kind: "daily",
          config: { time: "09:00" },
        },
        targetKind: "connector",
      })
    ).toMatchObject({
      connectorProvider: "x",
      targetKind: "connector",
      timezone: "UTC",
    });

    expect(
      createAutomationSchema.parse({
        connectorProvider: null,
        name: "Daily summary",
        prompt: "Summarize my day",
        schedule: {
          kind: "daily",
          config: { time: "09:00" },
        },
        targetKind: "decisions",
      })
    ).toMatchObject({
      connectorProvider: null,
      targetKind: "decisions",
      timezone: "UTC",
    });

    expect(() =>
      createAutomationSchema.parse({
        connectorProvider: "github",
        name: "Daily summary",
        prompt: "Summarize my day",
        schedule: {
          kind: "daily",
          config: { time: "09:00" },
        },
        targetKind: "connector",
      })
    ).toThrow();
  });

  it("rejects ambiguous automation targets when creating an automation", () => {
    expect(() =>
      createAutomationSchema.parse({
        connectorProvider: "x",
        name: "Daily summary",
        prompt: "Summarize my day",
        schedule: {
          kind: "daily",
          config: { time: "09:00" },
        },
        targetKind: "decisions",
      })
    ).toThrow();

    expect(() =>
      createAutomationSchema.parse({
        connectorProvider: null,
        name: "Daily summary",
        prompt: "Summarize my day",
        schedule: {
          kind: "daily",
          config: { time: "09:00" },
        },
        targetKind: "connector",
      })
    ).toThrow();

    expect(() =>
      createAutomationSchema.parse({
        name: "Daily summary",
        prompt: "Summarize my day",
        schedule: {
          kind: "daily",
          config: { time: "09:00" },
        },
      })
    ).toThrow();
  });

  it("accepts explicit automation target updates", () => {
    expect(
      updateAutomationSchema.parse({
        id: `${AUTOMATION_ID_PREFIX}123e4567-e89b-12d3-a456-426614174000`,
        connectorProvider: null,
        targetKind: "decisions",
      })
    ).toMatchObject({
      connectorProvider: null,
      targetKind: "decisions",
    });

    expect(
      updateAutomationSchema.parse({
        id: `${AUTOMATION_ID_PREFIX}123e4567-e89b-12d3-a456-426614174000`,
        connectorProvider: "linear",
        targetKind: "connector",
      })
    ).toMatchObject({
      connectorProvider: "linear",
      targetKind: "connector",
    });
  });

  it("rejects an invalid IANA timezone when updating an automation", () => {
    expect(() =>
      updateAutomationSchema.parse({
        id: `${AUTOMATION_ID_PREFIX}123e4567-e89b-12d3-a456-426614174000`,
        timezone: "Mars/Olympus_Mons",
      })
    ).toThrow();
  });
});

describe("formatClockTime", () => {
  it("formats midnight as 12:00 AM", () => {
    expect(formatClockTime("00:00")).toBe("12:00 AM");
  });

  it("formats noon as 12:00 PM", () => {
    expect(formatClockTime("12:00")).toBe("12:00 PM");
  });

  it("pads single-digit minutes", () => {
    expect(formatClockTime("09:05")).toBe("9:05 AM");
  });

  it("converts 24h afternoons to 12h with PM suffix", () => {
    expect(formatClockTime("17:30")).toBe("5:30 PM");
  });
});

describe("formatAutomationSchedule", () => {
  it("returns 'Deleted' for deleted automations regardless of schedule", () => {
    expect(
      formatAutomationSchedule({
        status: "deleted",
        scheduleKind: "daily",
        scheduleConfig: { time: "09:00" },
      })
    ).toBe("Deleted");
  });

  it("returns 'Paused' for paused automations regardless of schedule", () => {
    expect(
      formatAutomationSchedule({
        status: "paused",
        scheduleKind: "daily",
        scheduleConfig: { time: "09:00" },
      })
    ).toBe("Paused");
  });

  it("formats hourly intervals as 'Every N hours'", () => {
    expect(
      formatAutomationSchedule({
        status: "active",
        scheduleKind: "hourly",
        scheduleConfig: { intervalHours: 6 },
      })
    ).toBe("Every 6 hours");
  });

  it("uses the bare 'Hourly' label when interval is 1", () => {
    expect(
      formatAutomationSchedule({
        status: "active",
        scheduleKind: "hourly",
        scheduleConfig: { intervalHours: 1 },
      })
    ).toBe("Hourly");
  });

  it("formats daily schedules with the 12h clock time", () => {
    expect(
      formatAutomationSchedule({
        status: "active",
        scheduleKind: "daily",
        scheduleConfig: { time: "09:00" },
      })
    ).toBe("Daily at 9:00 AM");
  });

  it("labels manual schedules as 'Manual'", () => {
    expect(
      formatAutomationSchedule({
        status: "active",
        scheduleKind: "manual",
        scheduleConfig: {},
      })
    ).toBe("Manual");
  });

  it("formats weekdays schedules with the 12h clock time", () => {
    expect(
      formatAutomationSchedule({
        status: "active",
        scheduleKind: "weekdays",
        scheduleConfig: { time: "08:15" },
      })
    ).toBe("Weekdays at 8:15 AM");
  });

  it("formats weekly schedules with the weekday name and time", () => {
    expect(
      formatAutomationSchedule({
        status: "active",
        scheduleKind: "weekly",
        scheduleConfig: { dayOfWeek: 1, time: "09:00" },
      })
    ).toBe("Weekly on Monday at 9:00 AM");
  });
});
