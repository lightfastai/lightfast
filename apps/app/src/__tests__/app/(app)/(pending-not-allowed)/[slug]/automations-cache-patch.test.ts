import type { Automation } from "@db/app/schema";
import { describe, expect, it, vi } from "vitest";
import {
  applyAutomationPatch,
  upsertRun,
} from "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/automations/_components/automations-cache";

function make(over: Partial<Automation>): Automation {
  return {
    name: "Old name",
    prompt: "Old prompt",
    ...over,
  } as unknown as Automation;
}

describe("applyAutomationPatch", () => {
  it("patches only the name", () => {
    const result = applyAutomationPatch(make({}), { name: "New name" });
    expect(result.name).toBe("New name");
    expect(result.prompt).toBe("Old prompt");
  });

  it("patches only the prompt", () => {
    const result = applyAutomationPatch(make({}), { prompt: "New prompt" });
    expect(result.prompt).toBe("New prompt");
    expect(result.name).toBe("Old name");
  });

  it("leaves fields untouched when the patch has neither key", () => {
    const result = applyAutomationPatch(make({}), {});
    expect(result.name).toBe("Old name");
    expect(result.prompt).toBe("Old prompt");
  });

  it("ignores undefined values (does not blank a field)", () => {
    const result = applyAutomationPatch(make({}), { name: undefined });
    expect(result.name).toBe("Old name");
  });

  it("maps a schedule patch onto scheduleKind + scheduleConfig", () => {
    const result = applyAutomationPatch(
      make({ scheduleKind: "manual", scheduleConfig: {} }),
      { schedule: { kind: "daily", config: { time: "09:30" } } }
    );
    expect(result.scheduleKind).toBe("daily");
    expect(result.scheduleConfig).toEqual({ time: "09:30" });
  });

  it("patches the timezone", () => {
    const result = applyAutomationPatch(make({ timezone: "UTC" }), {
      timezone: "Australia/Sydney",
    });
    expect(result.timezone).toBe("Australia/Sydney");
  });

  it("applies schedule and timezone together without touching name/prompt", () => {
    const result = applyAutomationPatch(
      make({ scheduleKind: "manual", scheduleConfig: {}, timezone: "UTC" }),
      {
        schedule: { kind: "hourly", config: { intervalHours: 3 } },
        timezone: "Europe/London",
      }
    );
    expect(result.scheduleKind).toBe("hourly");
    expect(result.scheduleConfig).toEqual({ intervalHours: 3 });
    expect(result.timezone).toBe("Europe/London");
    expect(result.name).toBe("Old name");
    expect(result.prompt).toBe("Old prompt");
  });
});

describe("upsertRun", () => {
  interface TestRun {
    publicId: string;
    status?: string;
  }

  const run: TestRun = {
    publicId: "automation_run_123e4567-e89b-12d3-a456-426614174000",
  };
  const olderRun: TestRun = {
    publicId: "automation_run_223e4567-e89b-12d3-a456-426614174000",
  };

  const trpc = {
    org: {
      workspace: {
        automations: {
          getRun: {
            queryOptions: (input: unknown) => ({
              queryKey: ["getRun", input],
            }),
          },
          listRuns: {
            queryOptions: (input: unknown) => ({
              queryKey: ["listRuns", input],
            }),
          },
        },
      },
    },
  } as never;

  it("seeds the run detail cache and prepends the run to the current page", () => {
    const setQueryData = vi.fn();
    const qc = { setQueryData } as never;

    upsertRun(qc, trpc, "automation_1", run as never);

    expect(setQueryData).toHaveBeenCalledWith(
      ["getRun", { id: "automation_run_123e4567-e89b-12d3-a456-426614174000" }],
      run
    );
    expect(setQueryData).toHaveBeenCalledWith(
      ["listRuns", { id: "automation_1", limit: 20 }],
      expect.any(Function)
    );

    const listUpdater = setQueryData.mock.calls.find(
      ([key]) => key[0] === "listRuns"
    )?.[1] as (prev?: TestRun[]) => TestRun[];
    expect(listUpdater([olderRun])).toEqual([run, olderRun]);
  });

  it("dedupes existing runs and keeps the latest copy first", () => {
    const setQueryData = vi.fn();
    const qc = { setQueryData } as never;

    upsertRun(qc, trpc, "automation_1", run as never);

    const listUpdater = setQueryData.mock.calls.find(
      ([key]) => key[0] === "listRuns"
    )?.[1] as (prev?: TestRun[]) => TestRun[];
    expect(listUpdater([olderRun, { ...run, status: "pending" }])).toEqual([
      run,
      olderRun,
    ]);
  });
});
