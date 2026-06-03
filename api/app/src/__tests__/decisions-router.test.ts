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

const page = { items: [decision], nextCursor: null };

describe("decisionsRouter", () => {
  beforeEach(() => {
    listProviderRoutineCallsMock.mockReset();
    listProviderRoutineCallsMock.mockResolvedValue(page);
  });

  it("forwards cursor, limit, and search and returns the page unchanged", async () => {
    await expect(
      caller().decisions.list({
        cursor: { createdAt: new Date("2026-06-02T03:20:11.419Z"), id: 1 },
        limit: 25,
        search: "create_issue",
      })
    ).resolves.toEqual(page);

    expect(listProviderRoutineCallsMock).toHaveBeenCalledWith(
      expect.anything(),
      {
        clerkOrgId: "org_acme",
        cursor: { createdAt: new Date("2026-06-02T03:20:11.419Z"), id: 1 },
        limit: 25,
        providers: undefined,
        search: "create_issue",
        statuses: undefined,
      }
    );
  });

  it("forwards provider and status filters", async () => {
    await caller().decisions.list({
      providers: ["linear"],
      statuses: ["failed", "succeeded"],
    });

    expect(listProviderRoutineCallsMock).toHaveBeenCalledWith(
      expect.anything(),
      {
        clerkOrgId: "org_acme",
        cursor: undefined,
        limit: undefined,
        providers: ["linear"],
        search: undefined,
        statuses: ["failed", "succeeded"],
      }
    );
  });

  it("coerces empty filter arrays and blank search to undefined", async () => {
    await caller().decisions.list({
      providers: [],
      statuses: [],
      search: "   ",
    });

    expect(listProviderRoutineCallsMock).toHaveBeenCalledWith(
      expect.anything(),
      {
        clerkOrgId: "org_acme",
        cursor: undefined,
        limit: undefined,
        providers: undefined,
        search: undefined,
        statuses: undefined,
      }
    );
  });

  it("rejects unknown provider values", async () => {
    await expect(
      caller().decisions.list({
        providers: ["github" as unknown as "linear"],
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(listProviderRoutineCallsMock).not.toHaveBeenCalled();
  });

  it("rejects unknown status values", async () => {
    await expect(
      caller().decisions.list({
        statuses: ["pending" as unknown as "failed"],
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(listProviderRoutineCallsMock).not.toHaveBeenCalled();
  });

  it("rejects non-date cursor values before querying", async () => {
    await expect(
      caller().decisions.list({
        cursor: { createdAt: 123 as unknown as Date, id: 1 },
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(listProviderRoutineCallsMock).not.toHaveBeenCalled();
  });

  it("rejects pending users", async () => {
    await expect(
      caller({ type: "pending", userId: "user_current" }).decisions.list({})
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(listProviderRoutineCallsMock).not.toHaveBeenCalled();
  });
});
