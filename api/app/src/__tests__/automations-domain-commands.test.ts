import type { Automation, AutomationRun } from "@db/app";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthIdentity } from "../auth/identity";
import { actorFromAuthIdentity } from "../domain";
import {
  createAutomationCommand,
  deleteAutomationCommand,
  getAutomationCommand,
  getAutomationRunCommand,
  listAutomationRunsCommand,
  listAutomationsCommand,
  pauseAutomationCommand,
  resumeAutomationCommand,
  runAutomationNowCommand,
  updateAutomationCommand,
} from "../domain/automations";

const createAutomationMock = vi.fn();
const createAutomationRunMock = vi.fn();
const deleteAutomationMock = vi.fn();
const getAutomationByPublicIdMock = vi.fn();
const getAutomationRunByPublicIdMock = vi.fn();
const listAutomationRunsMock = vi.fn();
const listAutomationsMock = vi.fn();
const markAutomationRunFailedMock = vi.fn();
const setAutomationStatusMock = vi.fn();
const updateAutomationMock = vi.fn();
const sendAutomationRunRequestedMock = vi.fn();
const warnMock = vi.fn();

type ActiveAuthIdentity = Extract<AuthIdentity, { type: "active" }>;

const activeIdentity: ActiveAuthIdentity = {
  type: "active",
  userId: "user_current",
  orgId: "org_acme",
  orgGate: { bindingStatus: "bound", nextSetupRequirement: null },
};

const pendingIdentity: AuthIdentity = {
  type: "pending",
  userId: "user_pending",
};

const otherOrgIdentity: ActiveAuthIdentity = {
  ...activeIdentity,
  orgId: "org_other",
};

const runDate = new Date("2026-05-27T00:05:00.000Z");

const automation: Automation = {
  id: 1,
  publicId: "automation_123e4567-e89b-12d3-a456-426614174000",
  clerkOrgId: "org_acme",
  connectorProvider: "linear",
  createdByUserId: "user_current",
  name: "Morning check",
  prompt: "Check the workspace",
  scheduleKind: "daily",
  scheduleConfig: { time: "09:00" },
  timezone: "UTC",
  status: "active",
  targetKind: "connector",
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
  clerkOrgId: "org_acme",
  trigger: "manual",
  status: "pending",
  dueAt: runDate,
  startedAt: null,
  finishedAt: null,
  scheduleVersion: 1,
  idempotencyKey: "manual:test",
  output: null,
  errorCode: null,
  errorMessage: null,
  createdAt: runDate,
  updatedAt: runDate,
};

function ctx(input: { admin?: boolean; identity?: AuthIdentity } = {}) {
  const actor = actorFromAuthIdentity(input.identity ?? activeIdentity, "web");
  return {
    actor:
      input.admin === false || actor.kind !== "clerkUser"
        ? actor
        : { ...actor, orgRole: "admin" as const },
    request: { id: "req_test", source: "tanstack" as const },
  };
}

function deps() {
  return {
    createAutomation: createAutomationMock,
    createAutomationRun: createAutomationRunMock,
    deleteAutomation: deleteAutomationMock,
    getAutomationByPublicId: getAutomationByPublicIdMock,
    getAutomationRunByPublicId: getAutomationRunByPublicIdMock,
    listAutomationRuns: listAutomationRunsMock,
    listAutomations: listAutomationsMock,
    log: { warn: warnMock },
    markAutomationRunFailed: markAutomationRunFailedMock,
    now: () => runDate,
    sendAutomationRunRequested: sendAutomationRunRequestedMock,
    sendAutomationRunRequestedTimeoutMs: 10_000,
    setAutomationStatus: setAutomationStatusMock,
    updateAutomation: updateAutomationMock,
  };
}

beforeEach(() => {
  createAutomationMock.mockReset();
  createAutomationRunMock.mockReset();
  deleteAutomationMock.mockReset();
  getAutomationByPublicIdMock.mockReset();
  getAutomationRunByPublicIdMock.mockReset();
  listAutomationRunsMock.mockReset();
  listAutomationsMock.mockReset();
  markAutomationRunFailedMock.mockReset();
  setAutomationStatusMock.mockReset();
  updateAutomationMock.mockReset();
  sendAutomationRunRequestedMock.mockReset();
  warnMock.mockReset();

  createAutomationMock.mockResolvedValue(automation);
  createAutomationRunMock.mockResolvedValue(run);
  deleteAutomationMock.mockResolvedValue(true);
  getAutomationByPublicIdMock.mockResolvedValue(automation);
  getAutomationRunByPublicIdMock.mockResolvedValue(run);
  listAutomationRunsMock.mockResolvedValue([run]);
  listAutomationsMock.mockResolvedValue([automation]);
  markAutomationRunFailedMock.mockResolvedValue(true);
  setAutomationStatusMock.mockResolvedValue({
    ...automation,
    status: "paused",
  });
  updateAutomationMock.mockResolvedValue({ ...automation, name: "Updated" });
  sendAutomationRunRequestedMock.mockResolvedValue(undefined);
});

describe("automation domain commands", () => {
  it("lists automations scoped to the active organization", async () => {
    await expect(
      listAutomationsCommand.run({
        ctx: ctx({ admin: false }),
        deps: deps(),
        input: {},
      })
    ).resolves.toEqual([automation]);

    expect(listAutomationsMock).toHaveBeenCalledWith({
      clerkOrgId: "org_acme",
    });
  });

  it("creates automations only for organization admins", async () => {
    await expect(
      createAutomationCommand.run({
        ctx: ctx(),
        deps: deps(),
        input: {
          connectorProvider: "linear",
          name: "Morning check",
          prompt: "Check the workspace",
          schedule: { kind: "daily", config: { time: "09:00" } },
          targetKind: "connector",
          timezone: "UTC",
        },
      })
    ).resolves.toEqual(automation);

    expect(createAutomationMock).toHaveBeenCalledWith({
      clerkOrgId: "org_acme",
      connectorProvider: "linear",
      createdByUserId: "user_current",
      name: "Morning check",
      prompt: "Check the workspace",
      schedule: { kind: "daily", config: { time: "09:00" } },
      targetKind: "connector",
      timezone: "UTC",
    });

    await expect(
      createAutomationCommand.run({
        ctx: ctx({ admin: false }),
        deps: deps(),
        input: {
          connectorProvider: null,
          name: "Morning check",
          prompt: "Check the workspace",
          schedule: { kind: "manual", config: {} },
          targetKind: "decisions",
          timezone: "UTC",
        },
      })
    ).rejects.toMatchObject({
      code: "PERMISSION_REQUIRED",
      kind: "authz",
    });
  });

  it("maps missing automations to domain not found errors", async () => {
    getAutomationByPublicIdMock.mockResolvedValueOnce(undefined);
    updateAutomationMock.mockResolvedValueOnce(undefined);
    deleteAutomationMock.mockResolvedValueOnce(false);

    await expect(
      getAutomationCommand.run({
        ctx: ctx({ admin: false }),
        deps: deps(),
        input: { id: automation.publicId },
      })
    ).rejects.toMatchObject({
      code: "AUTOMATION_NOT_FOUND",
      kind: "not_found",
    });

    await expect(
      updateAutomationCommand.run({
        ctx: ctx(),
        deps: deps(),
        input: { id: automation.publicId, name: "Updated" },
      })
    ).rejects.toMatchObject({
      code: "AUTOMATION_NOT_FOUND",
      kind: "not_found",
    });

    await expect(
      deleteAutomationCommand.run({
        ctx: ctx(),
        deps: deps(),
        input: { id: automation.publicId },
      })
    ).rejects.toMatchObject({
      code: "AUTOMATION_NOT_FOUND",
      kind: "not_found",
    });
  });

  it("rejects pending users before org-scoped automation writes", async () => {
    const pendingCtx = ctx({ identity: pendingIdentity });

    await expect(
      createAutomationCommand.run({
        ctx: pendingCtx,
        deps: deps(),
        input: {
          connectorProvider: null,
          name: "Morning check",
          prompt: "Check the workspace",
          schedule: { kind: "manual", config: {} },
          targetKind: "decisions",
          timezone: "UTC",
        },
      })
    ).rejects.toMatchObject({
      code: "ORG_REQUIRED",
      kind: "authz",
    });
    await expect(
      updateAutomationCommand.run({
        ctx: pendingCtx,
        deps: deps(),
        input: { id: automation.publicId, name: "Updated" },
      })
    ).rejects.toMatchObject({
      code: "ORG_REQUIRED",
      kind: "authz",
    });
    await expect(
      deleteAutomationCommand.run({
        ctx: pendingCtx,
        deps: deps(),
        input: { id: automation.publicId },
      })
    ).rejects.toMatchObject({
      code: "ORG_REQUIRED",
      kind: "authz",
    });
    await expect(
      pauseAutomationCommand.run({
        ctx: pendingCtx,
        deps: deps(),
        input: { id: automation.publicId },
      })
    ).rejects.toMatchObject({
      code: "ORG_REQUIRED",
      kind: "authz",
    });
    await expect(
      resumeAutomationCommand.run({
        ctx: pendingCtx,
        deps: deps(),
        input: { id: automation.publicId },
      })
    ).rejects.toMatchObject({
      code: "ORG_REQUIRED",
      kind: "authz",
    });
    await expect(
      runAutomationNowCommand.run({
        ctx: pendingCtx,
        deps: deps(),
        input: { id: automation.publicId },
      })
    ).rejects.toMatchObject({
      code: "ORG_REQUIRED",
      kind: "authz",
    });

    expect(createAutomationMock).not.toHaveBeenCalled();
    expect(updateAutomationMock).not.toHaveBeenCalled();
    expect(deleteAutomationMock).not.toHaveBeenCalled();
    expect(setAutomationStatusMock).not.toHaveBeenCalled();
    expect(getAutomationByPublicIdMock).not.toHaveBeenCalled();
    expect(createAutomationRunMock).not.toHaveBeenCalled();
  });

  it("treats automation records from a different organization as not found", async () => {
    const otherOrgCtx = ctx({ identity: otherOrgIdentity });

    await expect(
      getAutomationCommand.run({
        ctx: otherOrgCtx,
        deps: deps(),
        input: { id: automation.publicId },
      })
    ).rejects.toMatchObject({
      code: "AUTOMATION_NOT_FOUND",
      kind: "not_found",
    });
    await expect(
      updateAutomationCommand.run({
        ctx: otherOrgCtx,
        deps: deps(),
        input: { id: automation.publicId, name: "Updated" },
      })
    ).rejects.toMatchObject({
      code: "AUTOMATION_NOT_FOUND",
      kind: "not_found",
    });
    await expect(
      pauseAutomationCommand.run({
        ctx: otherOrgCtx,
        deps: deps(),
        input: { id: automation.publicId },
      })
    ).rejects.toMatchObject({
      code: "AUTOMATION_NOT_FOUND",
      kind: "not_found",
    });
    await expect(
      resumeAutomationCommand.run({
        ctx: otherOrgCtx,
        deps: deps(),
        input: { id: automation.publicId },
      })
    ).rejects.toMatchObject({
      code: "AUTOMATION_NOT_FOUND",
      kind: "not_found",
    });
    await expect(
      runAutomationNowCommand.run({
        ctx: otherOrgCtx,
        deps: deps(),
        input: { id: automation.publicId },
      })
    ).rejects.toMatchObject({
      code: "AUTOMATION_NOT_FOUND",
      kind: "not_found",
    });

    expect(createAutomationRunMock).not.toHaveBeenCalled();
  });

  it("pauses and resumes automations through the status command", async () => {
    await pauseAutomationCommand.run({
      ctx: ctx(),
      deps: deps(),
      input: { id: automation.publicId },
    });
    await resumeAutomationCommand.run({
      ctx: ctx(),
      deps: deps(),
      input: { id: automation.publicId },
    });

    expect(setAutomationStatusMock).toHaveBeenNthCalledWith(1, {
      clerkOrgId: "org_acme",
      publicId: automation.publicId,
      status: "paused",
    });
    expect(setAutomationStatusMock).toHaveBeenNthCalledWith(2, {
      clerkOrgId: "org_acme",
      publicId: automation.publicId,
      status: "active",
    });
  });

  it("creates and enqueues a manual run for active automations", async () => {
    await expect(
      runAutomationNowCommand.run({
        ctx: ctx(),
        deps: deps(),
        input: { id: automation.publicId },
      })
    ).resolves.toEqual(run);

    expect(createAutomationRunMock).toHaveBeenCalledWith({
      automation,
      dueAt: runDate,
      trigger: "manual",
    });
    expect(sendAutomationRunRequestedMock).toHaveBeenCalledWith({
      automationId: automation.publicId,
      clerkOrgId: "org_acme",
      runId: run.publicId,
      scheduleVersion: 1,
    });
  });

  it("rejects manual runs for paused automations", async () => {
    getAutomationByPublicIdMock.mockResolvedValueOnce({
      ...automation,
      status: "paused",
    });

    await expect(
      runAutomationNowCommand.run({
        ctx: ctx(),
        deps: deps(),
        input: { id: automation.publicId },
      })
    ).rejects.toMatchObject({
      code: "AUTOMATION_PAUSED",
      kind: "validation",
      message: "Automation is paused.",
    });

    expect(createAutomationRunMock).not.toHaveBeenCalled();
    expect(sendAutomationRunRequestedMock).not.toHaveBeenCalled();
  });

  it("marks runs failed when manual enqueue fails", async () => {
    const enqueueError = new Error("queue unavailable");
    sendAutomationRunRequestedMock.mockRejectedValueOnce(enqueueError);

    await expect(
      runAutomationNowCommand.run({
        ctx: ctx(),
        deps: deps(),
        input: { id: automation.publicId },
      })
    ).rejects.toMatchObject({
      code: "AUTOMATION_RUN_ENQUEUE_FAILED",
      kind: "internal",
      message: "Failed to queue automation run.",
    });

    expect(markAutomationRunFailedMock).toHaveBeenCalledWith({
      clerkOrgId: automation.clerkOrgId,
      errorCode: "AUTOMATION_RUN_ENQUEUE_FAILED",
      errorMessage: "queue unavailable",
      publicId: run.publicId,
    });
    expect(warnMock).toHaveBeenCalledWith(
      "[automations] manual run enqueue failed",
      {
        automationId: automation.publicId,
        clerkOrgId: automation.clerkOrgId,
        error: enqueueError,
        runId: run.publicId,
      }
    );
  });

  it("preserves the enqueue error when marking the run failed also fails", async () => {
    const enqueueError = new Error("queue unavailable");
    sendAutomationRunRequestedMock.mockRejectedValueOnce(enqueueError);
    markAutomationRunFailedMock.mockRejectedValueOnce(
      new Error("database unavailable")
    );

    await expect(
      runAutomationNowCommand.run({
        ctx: ctx(),
        deps: deps(),
        input: { id: automation.publicId },
      })
    ).rejects.toMatchObject({
      code: "AUTOMATION_RUN_ENQUEUE_FAILED",
      kind: "internal",
      message: "Failed to queue automation run.",
    });

    expect(warnMock).toHaveBeenCalledWith(
      "[automations] manual run enqueue failed",
      {
        automationId: automation.publicId,
        clerkOrgId: automation.clerkOrgId,
        error: enqueueError,
        runId: run.publicId,
      }
    );
  });

  it("times out stalled manual enqueue attempts", async () => {
    sendAutomationRunRequestedMock.mockReturnValueOnce(
      new Promise(() => {
        // Intentionally never resolves to exercise the command timeout.
      })
    );

    await expect(
      Promise.race([
        runAutomationNowCommand.run({
          ctx: ctx(),
          deps: {
            ...deps(),
            sendAutomationRunRequestedTimeoutMs: 1,
          },
          input: { id: automation.publicId },
        }),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error("test timeout waiting for enqueue timeout")),
            50
          )
        ),
      ])
    ).rejects.toMatchObject({
      code: "AUTOMATION_RUN_ENQUEUE_FAILED",
      kind: "internal",
      message: "Failed to queue automation run.",
    });

    expect(markAutomationRunFailedMock).toHaveBeenCalledWith(
      expect.objectContaining({
        errorCode: "AUTOMATION_RUN_ENQUEUE_FAILED",
        publicId: run.publicId,
      })
    );
  });

  it("lists and gets automation runs scoped to the active organization", async () => {
    await expect(
      listAutomationRunsCommand.run({
        ctx: ctx({ admin: false }),
        deps: deps(),
        input: { id: automation.publicId, limit: 25 },
      })
    ).resolves.toEqual([run]);

    expect(listAutomationRunsMock).toHaveBeenCalledWith({
      automationPublicId: automation.publicId,
      clerkOrgId: "org_acme",
      limit: 25,
    });

    await expect(
      getAutomationRunCommand.run({
        ctx: ctx({ admin: false }),
        deps: deps(),
        input: { id: run.publicId },
      })
    ).resolves.toEqual(run);

    getAutomationRunByPublicIdMock.mockResolvedValueOnce(undefined);
    await expect(
      getAutomationRunCommand.run({
        ctx: ctx({ admin: false }),
        deps: deps(),
        input: { id: run.publicId },
      })
    ).rejects.toMatchObject({
      code: "AUTOMATION_RUN_NOT_FOUND",
      kind: "not_found",
    });
  });
});
