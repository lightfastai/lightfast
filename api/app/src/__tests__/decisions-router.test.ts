import type { Database, ProviderRoutineCall } from "@db/app";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthIdentity } from "../auth/identity";

const listProviderRoutineCallsMock = vi.fn();

vi.mock("@db/app/client", () => ({ db: {} }));
vi.mock("@db/app", () => ({
  listProviderRoutineCalls: listProviderRoutineCallsMock,
}));
vi.mock("@vendor/clerk/env", () => ({
  clerkEnvBase: { CLERK_SECRET_KEY: "sk_test_fake-secret-key-for-tests" },
}));
vi.mock("@vendor/observability/trpc", () => ({
  createObservabilityMiddleware:
    () =>
    ({ next }: { next: () => unknown }) =>
      next(),
}));

const { createCallerFactory, createTRPCRouter } = await import("../trpc");
const { decisionsRouter } = await import(
  "../router/(pending-not-allowed)/decisions"
);

const testRouter = createTRPCRouter({ decisions: decisionsRouter });
const createCaller = createCallerFactory(testRouter);

const activeIdentity = {
  orgGate: { bindingStatus: "bound", nextSetupRequirement: null },
  orgId: "org_acme",
  type: "active",
  userId: "user_current",
} satisfies AuthIdentity;

function caller(identity: AuthIdentity = activeIdentity) {
  return createCaller({
    auth: { identity },
    db: {} as Database,
    headers: new Headers(),
  });
}

const decision = {
  id: 1,
  publicId: "provider_routine_call_123",
  clerkOrgId: "org_acme",
  calledByKind: "automation",
  calledById: "run_123",
  calledByUserId: null,
  provider: "linear",
  routineId: "linear__create_issue",
  providerToolName: "create_issue",
  providerConnectionId: 42,
  providerWorkspaceId: "workspace_123",
  providerActorId: "actor_123",
  providerAttempted: true,
  sourceClientId: null,
  sourceRef: "run_123",
  sourceSurface: "automation",
  status: "succeeded",
  inputRedacted: { present: true },
  outputRedacted: { present: true },
  errorCode: null,
  errorMessage: null,
  startedAt: new Date("2026-06-02T03:20:11.419Z"),
  finishedAt: new Date("2026-06-02T03:20:11.966Z"),
  createdAt: new Date("2026-06-02T03:20:11.419Z"),
  updatedAt: new Date("2026-06-02T03:20:11.966Z"),
} satisfies ProviderRoutineCall;

describe("decisionsRouter", () => {
  beforeEach(() => {
    listProviderRoutineCallsMock.mockReset();
    listProviderRoutineCallsMock.mockResolvedValue([decision]);
  });

  it("lists recent decisions for the active organization", async () => {
    await expect(caller().decisions.list({ limit: 10 })).resolves.toEqual([
      decision,
    ]);

    expect(listProviderRoutineCallsMock).toHaveBeenCalledWith(
      expect.anything(),
      {
        clerkOrgId: "org_acme",
        limit: 10,
      }
    );
  });

  it("uses the default limit when no input is provided", async () => {
    await expect(caller().decisions.list()).resolves.toEqual([decision]);

    expect(listProviderRoutineCallsMock).toHaveBeenCalledWith(
      expect.anything(),
      {
        clerkOrgId: "org_acme",
        limit: 50,
      }
    );
  });

  it("rejects pending users", async () => {
    await expect(
      caller({ type: "pending", userId: "user_current" }).decisions.list()
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    expect(listProviderRoutineCallsMock).not.toHaveBeenCalled();
  });
});
