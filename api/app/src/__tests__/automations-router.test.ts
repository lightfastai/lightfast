import type { Database } from "@db/app";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthIdentity } from "../auth/identity";

const createAutomationMock = vi.fn();
const createAutomationRunMock = vi.fn();
const getAutomationByPublicIdMock = vi.fn();
const listAutomationRunsMock = vi.fn();
const listAutomationsMock = vi.fn();
const setAutomationStatusMock = vi.fn();
const updateAutomationMock = vi.fn();
const sendMock = vi.fn();

vi.mock("@db/app/client", () => ({ db: {} }));
vi.mock("@db/app", () => ({
  createAutomation: createAutomationMock,
  createAutomationRun: createAutomationRunMock,
  getAutomationByPublicId: getAutomationByPublicIdMock,
  listAutomationRuns: listAutomationRunsMock,
  listAutomations: listAutomationsMock,
  setAutomationStatus: setAutomationStatusMock,
  updateAutomation: updateAutomationMock,
}));

vi.mock("@vendor/clerk/env", () => ({
  clerkEnvBase: { CLERK_SECRET_KEY: "sk_test_fake-secret-key-for-tests" },
}));

vi.mock("@vendor/observability/log/next", () => ({
  log: { debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

vi.mock("@vendor/observability/trpc", () => ({
  createObservabilityMiddleware:
    () =>
    ({ next }: { next: () => unknown }) =>
      next(),
}));

vi.mock("../inngest/client", () => ({
  inngest: { send: sendMock },
}));

const { createCallerFactory, createTRPCRouter } = await import("../trpc");
const { automationsRouter } = await import(
  "../router/(pending-not-allowed)/automations"
);

const testRouter = createTRPCRouter({
  automations: automationsRouter,
});
const createCaller = createCallerFactory(testRouter);

type ActiveAuthIdentity = Extract<AuthIdentity, { type: "active" }>;

const activeIdentity: ActiveAuthIdentity = {
  type: "active",
  userId: "user_current",
  orgId: "org_acme",
  orgGate: { bindingStatus: "bound" },
};

const pendingIdentity: AuthIdentity = {
  type: "pending",
  userId: "user_current",
};

const unauthenticatedIdentity: AuthIdentity = {
  type: "unauthenticated",
};

function adminAccess() {
  return {
    kind: "clerk-session" as const,
    userId: "user_current",
    orgId: "org_acme",
    has: ({ role }: { role?: string }) => role === "org:admin",
  };
}

function activeIdentityWithOrgGate(
  bindingStatus: "bound" | "unbound" | "revoked"
): ActiveAuthIdentity {
  return {
    ...activeIdentity,
    orgGate: { bindingStatus },
  };
}

function adminAccessForOrg(orgId: string) {
  return {
    ...adminAccess(),
    orgId,
  };
}

function nonAdminAccess() {
  return {
    kind: "clerk-session" as const,
    userId: "user_current",
    orgId: "org_acme",
    has: () => false,
  };
}

function caller(access = adminAccess()) {
  return callerWithIdentity(activeIdentity, access);
}

function callerWithIdentity(identity: AuthIdentity, access = adminAccess()) {
  return createCaller({
    auth: { identity, access },
    db: {} as Database,
    headers: new Headers(),
  });
}

const automation = {
  id: 1,
  publicId: "automation_123e4567-e89b-12d3-a456-426614174000",
  clerkOrgId: "org_acme",
  createdByUserId: "user_current",
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

const run = {
  id: 2,
  publicId: "automation_run_123e4567-e89b-12d3-a456-426614174000",
  automationId: 1,
  automationPublicId: automation.publicId,
  clerkOrgId: "org_acme",
  trigger: "manual",
  status: "pending",
  dueAt: new Date("2026-05-27T00:05:00.000Z"),
  startedAt: null,
  finishedAt: null,
  scheduleVersion: 1,
  idempotencyKey: "manual:test",
  output: null,
  errorCode: null,
  errorMessage: null,
  createdAt: new Date("2026-05-27T00:05:00.000Z"),
  updatedAt: new Date("2026-05-27T00:05:00.000Z"),
};

beforeEach(() => {
  createAutomationMock.mockReset();
  createAutomationRunMock.mockReset();
  getAutomationByPublicIdMock.mockReset();
  listAutomationRunsMock.mockReset();
  listAutomationsMock.mockReset();
  setAutomationStatusMock.mockReset();
  updateAutomationMock.mockReset();
  sendMock.mockReset();

  createAutomationMock.mockResolvedValue(automation);
  createAutomationRunMock.mockResolvedValue(run);
  getAutomationByPublicIdMock.mockResolvedValue(automation);
  listAutomationRunsMock.mockResolvedValue([run]);
  listAutomationsMock.mockResolvedValue([automation]);
  setAutomationStatusMock.mockResolvedValue({
    ...automation,
    status: "paused",
  });
  updateAutomationMock.mockResolvedValue({ ...automation, name: "Updated" });
  sendMock.mockResolvedValue(undefined);
});

describe("automationsRouter", () => {
  it("lists automations for the active organization", async () => {
    await expect(caller().automations.list()).resolves.toEqual([automation]);

    expect(listAutomationsMock).toHaveBeenCalledWith(expect.anything(), {
      clerkOrgId: "org_acme",
    });
  });

  it("rejects list when no active org is selected", async () => {
    await expect(
      callerWithIdentity(pendingIdentity).automations.list()
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    expect(listAutomationsMock).not.toHaveBeenCalled();
  });

  it("rejects list for unbound and revoked organizations", async () => {
    await expect(
      callerWithIdentity(
        activeIdentityWithOrgGate("unbound")
      ).automations.list()
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      callerWithIdentity(
        activeIdentityWithOrgGate("revoked")
      ).automations.list()
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    expect(listAutomationsMock).not.toHaveBeenCalled();
  });

  it("creates an automation for org admins", async () => {
    await expect(
      caller().automations.create({
        name: "Morning check",
        prompt: "Check the workspace",
        schedule: {
          kind: "daily",
          config: { time: "09:00" },
        },
        timezone: "UTC",
      })
    ).resolves.toEqual(automation);

    expect(createAutomationMock).toHaveBeenCalledWith(expect.anything(), {
      clerkOrgId: "org_acme",
      createdByUserId: "user_current",
      name: "Morning check",
      prompt: "Check the workspace",
      schedule: {
        kind: "daily",
        config: { time: "09:00" },
      },
      timezone: "UTC",
    });
  });

  it("rejects create for non-admin org members", async () => {
    await expect(
      caller(nonAdminAccess()).automations.create({
        name: "Morning check",
        prompt: "Check the workspace",
        schedule: {
          kind: "hourly",
          config: { intervalHours: 1 },
        },
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    expect(createAutomationMock).not.toHaveBeenCalled();
  });

  it("rejects create when the auth identity is unauthenticated", async () => {
    await expect(
      callerWithIdentity(unauthenticatedIdentity).automations.create({
        name: "Morning check",
        prompt: "Check the workspace",
        schedule: { kind: "hourly", config: { intervalHours: 1 } },
      })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });

    expect(createAutomationMock).not.toHaveBeenCalled();
  });

  it("rejects create when Clerk session access belongs to another org", async () => {
    await expect(
      caller(adminAccessForOrg("org_other")).automations.create({
        name: "Morning check",
        prompt: "Check the workspace",
        schedule: { kind: "hourly", config: { intervalHours: 1 } },
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    expect(createAutomationMock).not.toHaveBeenCalled();
  });

  it("creates and enqueues a manual run", async () => {
    await expect(
      caller().automations.runNow({ id: automation.publicId })
    ).resolves.toEqual(run);

    expect(createAutomationRunMock).toHaveBeenCalledWith(expect.anything(), {
      automation,
      dueAt: expect.any(Date),
      trigger: "manual",
    });
    expect(sendMock).toHaveBeenCalledWith({
      name: "app/automation.run.requested",
      data: {
        automationId: automation.publicId,
        clerkOrgId: "org_acme",
        runId: run.publicId,
        scheduleVersion: 1,
      },
    });
  });

  it("rejects manual runs for paused automations", async () => {
    getAutomationByPublicIdMock.mockResolvedValueOnce({
      ...automation,
      status: "paused",
    });

    await expect(
      caller().automations.runNow({ id: automation.publicId })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "Automation is paused.",
    });

    expect(createAutomationRunMock).not.toHaveBeenCalled();
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("rejects manual runs before hitting DB when no active org is selected", async () => {
    await expect(
      callerWithIdentity(pendingIdentity).automations.runNow({
        id: automation.publicId,
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    expect(getAutomationByPublicIdMock).not.toHaveBeenCalled();
    expect(createAutomationRunMock).not.toHaveBeenCalled();
    expect(sendMock).not.toHaveBeenCalled();
  });
});
