import type { Automation, AutomationRun, Database } from "@db/app";
import { beforeEach, describe, expect, it, vi } from "vitest";

const claimDueAutomationRunsMock = vi.fn();
const getAutomationByPublicIdMock = vi.fn();
const getAutomationRunByPublicIdMock = vi.fn();
const markAutomationRunCompletedMock = vi.fn();
const markAutomationRunFailedMock = vi.fn();
const markAutomationRunRunningMock = vi.fn();
const markAutomationRunSkippedMock = vi.fn();
const db = { kind: "mock-db" } as unknown as Database;

type Step = ReturnType<typeof createStep>;
type WorkflowCallback = (input: {
  event: {
    data: {
      automationId: string;
      clerkOrgId: string;
      runId: string;
      scheduleVersion: number;
    };
  };
  step: Step;
}) => Promise<unknown>;
type SchedulerCallback = (input: { step: Step }) => Promise<unknown>;
type WorkflowFailureCallback = (input: {
  error: Error;
  event: {
    data: {
      event: {
        data: {
          clerkOrgId: string;
          runId: string;
        };
      };
    };
  };
  step: Step;
}) => Promise<unknown>;

let schedulerCallback: SchedulerCallback | undefined;
let runCallback: WorkflowCallback | undefined;
let runFailureCallback: WorkflowFailureCallback | undefined;

const createFunctionMock = vi.fn(
  (
    config: { id: string; onFailure?: WorkflowFailureCallback },
    handler: SchedulerCallback | WorkflowCallback
  ): { id: string } => {
    if (config.id === "automation-scheduler") {
      schedulerCallback = handler as SchedulerCallback;
    }
    if (config.id === "run-automation") {
      runCallback = handler as WorkflowCallback;
      runFailureCallback = config.onFailure;
    }
    return { id: config.id };
  }
);

vi.mock("@db/app", () => ({
  claimDueAutomationRuns: claimDueAutomationRunsMock,
  getAutomationByPublicId: getAutomationByPublicIdMock,
  getAutomationRunByPublicId: getAutomationRunByPublicIdMock,
  markAutomationRunCompleted: markAutomationRunCompletedMock,
  markAutomationRunFailed: markAutomationRunFailedMock,
  markAutomationRunRunning: markAutomationRunRunningMock,
  markAutomationRunSkipped: markAutomationRunSkippedMock,
}));

vi.mock("@db/app/client", () => ({ db }));

vi.mock("../inngest/client", () => ({
  inngest: {
    createFunction: createFunctionMock,
  },
}));

const automation: Automation = {
  id: 1,
  publicId: "automation_123e4567-e89b-12d3-a456-426614174000",
  clerkOrgId: "org_test",
  createdByUserId: "user_test",
  name: "Morning check",
  prompt: "Check the workspace",
  scheduleKind: "daily",
  scheduleConfig: { time: "09:00" },
  timezone: "UTC",
  status: "active",
  nextRunAt: new Date("2026-05-28T09:00:00.000Z"),
  lastRunAt: null,
  scheduleVersion: 1,
  createdAt: new Date("2026-05-27T00:00:00.000Z"),
  updatedAt: new Date("2026-05-27T00:00:00.000Z"),
};

const run: AutomationRun = {
  id: 2,
  publicId: "automation_run_123e4567-e89b-12d3-a456-426614174000",
  automationId: 1,
  automationPublicId: automation.publicId,
  clerkOrgId: "org_test",
  trigger: "scheduled",
  status: "pending",
  dueAt: new Date("2026-05-27T09:00:00.000Z"),
  startedAt: null,
  finishedAt: null,
  scheduleVersion: 1,
  idempotencyKey: "scheduled:test",
  output: null,
  errorCode: null,
  errorMessage: null,
  createdAt: new Date("2026-05-27T09:00:00.000Z"),
  updatedAt: new Date("2026-05-27T09:00:00.000Z"),
};

const { automationScheduler } = await import(
  "../inngest/workflow/automation-scheduler"
);
const { runAutomation } = await import("../inngest/workflow/run-automation");

function createStep() {
  return {
    run: vi.fn(<T>(_name: string, fn: () => T | Promise<T>) => fn()),
    sendEvent: vi.fn((_name: string, event: unknown) =>
      Promise.resolve({ ids: ["event_test"], event })
    ),
  };
}

function runScheduler(step: Step) {
  if (!schedulerCallback) {
    throw new Error("scheduler callback was not registered");
  }
  return schedulerCallback({ step });
}

function runExecutor(step: Step) {
  if (!runCallback) {
    throw new Error("run callback was not registered");
  }
  return runCallback({
    event: {
      data: {
        automationId: automation.publicId,
        clerkOrgId: "org_test",
        runId: run.publicId,
        scheduleVersion: 1,
      },
    },
    step,
  });
}

function runFailure(step: Step, error: Error) {
  if (!runFailureCallback) {
    throw new Error("run failure callback was not registered");
  }
  return runFailureCallback({
    error,
    event: {
      data: {
        event: {
          data: {
            clerkOrgId: "org_test",
            runId: run.publicId,
          },
        },
      },
    },
    step,
  });
}

beforeEach(() => {
  claimDueAutomationRunsMock.mockReset();
  getAutomationByPublicIdMock.mockReset();
  getAutomationRunByPublicIdMock.mockReset();
  markAutomationRunCompletedMock.mockReset();
  markAutomationRunFailedMock.mockReset();
  markAutomationRunRunningMock.mockReset();
  markAutomationRunSkippedMock.mockReset();

  claimDueAutomationRunsMock.mockResolvedValue([{ automation, run }]);
  getAutomationByPublicIdMock.mockResolvedValue(automation);
  getAutomationRunByPublicIdMock.mockResolvedValue(run);
  markAutomationRunCompletedMock.mockResolvedValue(true);
  markAutomationRunFailedMock.mockResolvedValue(true);
  markAutomationRunRunningMock.mockResolvedValue(true);
  markAutomationRunSkippedMock.mockResolvedValue(true);
});

describe("automation Inngest workflows", () => {
  it("registers the scheduler and executor functions", () => {
    expect(automationScheduler).toEqual({ id: "automation-scheduler" });
    expect(runAutomation).toEqual({ id: "run-automation" });
    expect(createFunctionMock).toHaveBeenCalledWith(
      {
        id: "automation-scheduler",
        idempotency: "event.id",
        retries: 2,
        timeouts: { finish: "2m", start: "1m" },
        triggers: { cron: "* * * * *" },
      },
      expect.any(Function)
    );
    expect(createFunctionMock).toHaveBeenCalledWith(
      {
        id: "run-automation",
        idempotency: "event.data.runId",
        onFailure: expect.any(Function),
        retries: 2,
        timeouts: { finish: "5m", start: "5m" },
        triggers: expect.objectContaining({
          event: "app/automation.run.requested",
        }),
      },
      expect.any(Function)
    );
  });

  it("claims due automation runs and queues executor events", async () => {
    const step = createStep();

    await expect(runScheduler(step)).resolves.toEqual({ queued: 1 });

    expect(claimDueAutomationRunsMock).toHaveBeenCalledWith(db, { limit: 25 });
    expect(step.sendEvent).toHaveBeenCalledWith("queue automation run", {
      name: "app/automation.run.requested",
      data: {
        automationId: automation.publicId,
        clerkOrgId: "org_test",
        runId: run.publicId,
        scheduleVersion: 1,
      },
    });
  });

  it("marks a pending run completed with scaffold output", async () => {
    const step = createStep();

    await expect(runExecutor(step)).resolves.toEqual({
      status: "completed",
    });

    expect(markAutomationRunRunningMock).toHaveBeenCalledWith(db, {
      clerkOrgId: "org_test",
      publicId: run.publicId,
    });
    expect(markAutomationRunCompletedMock).toHaveBeenCalledWith(db, {
      clerkOrgId: "org_test",
      publicId: run.publicId,
      output: {
        automationId: automation.publicId,
        message: "Automation scaffold executed. AI execution is not enabled.",
        promptPreview: "Check the workspace",
        runId: run.publicId,
        schemaVersion: "automation.run.scaffold.v1",
      },
    });
  });

  it("skips stale events when the automation schedule version has changed", async () => {
    const step = createStep();
    getAutomationByPublicIdMock.mockResolvedValueOnce({
      ...automation,
      scheduleVersion: 2,
    });

    await expect(runExecutor(step)).resolves.toEqual({ status: "skipped" });

    expect(markAutomationRunSkippedMock).toHaveBeenCalledWith(db, {
      clerkOrgId: "org_test",
      errorCode: "AUTOMATION_STALE_EVENT",
      errorMessage: "Automation changed before this run started.",
      publicId: run.publicId,
    });
    expect(markAutomationRunRunningMock).not.toHaveBeenCalled();
  });

  it("marks the run failed from onFailure after retries are exhausted", async () => {
    const step = createStep();

    await expect(
      runFailure(step, new Error("executor unavailable"))
    ).resolves.toEqual({
      status: "failed",
    });

    expect(markAutomationRunFailedMock).toHaveBeenCalledWith(db, {
      clerkOrgId: "org_test",
      errorCode: "AUTOMATION_RUN_FAILED",
      errorMessage: "executor unavailable",
      publicId: run.publicId,
    });
  });
});
