import type { Database, Signal } from "@db/app";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthIdentity } from "../auth/identity";

const listSignalsMock = vi.fn();

vi.mock("@db/app/client", () => ({ db: {} }));
vi.mock("@db/app", () => ({
  listSignals: listSignalsMock,
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

const { createCallerFactory, createTRPCRouter } = await import("../trpc");
const { workspaceSignalsRouter } = await import(
  "../router/(pending-not-allowed)/workspace-signals"
);

const testRouter = createTRPCRouter({ signals: workspaceSignalsRouter });
const createCaller = createCallerFactory(testRouter);

const activeIdentity: AuthIdentity = {
  type: "active",
  userId: "user_test",
  orgId: "org_test",
  orgGate: { bindingStatus: "bound" },
};

const signalRow: Signal = {
  id: 7,
  publicId: "signal_123e4567-e89b-12d3-a456-426614174000",
  clerkOrgId: "org_test",
  createdByApiKeyId: "key_test",
  createdByUserId: "user_test",
  input: "Customer asked for migration help",
  status: "classified",
  classification: {
    schemaVersion: "signal.classification.v1",
    confidence: 0.91,
    disposition: "actionable",
    kind: "follow_up",
    nextAction: "Reply with migration plan",
    priority: "high",
    rationale: "The customer is asking for help.",
    summary: "Customer asked for migration help.",
    title: "Follow up on migration",
  },
  errorCode: null,
  errorMessage: null,
  createdAt: new Date("2026-05-27T01:00:00.000Z"),
  updatedAt: new Date("2026-05-27T01:01:00.000Z"),
};

function caller(identity: AuthIdentity = activeIdentity) {
  return createCaller({
    auth: { identity },
    db: {} as Database,
    headers: new Headers(),
  });
}

beforeEach(() => {
  listSignalsMock.mockReset();
  listSignalsMock.mockResolvedValue({
    items: [signalRow],
    nextCursor: { createdAt: signalRow.createdAt, id: signalRow.id },
  });
});

describe("workspaceSignalsRouter.list", () => {
  it("forwards filters and returns native DB rows unchanged", async () => {
    await expect(
      caller().signals.list({
        cursor: { createdAt: new Date("2026-05-27T01:00:00.000Z"), id: 7 },
        limit: 25,
        search: "migration",
        status: "classified",
      })
    ).resolves.toEqual({
      items: [signalRow],
      nextCursor: { createdAt: signalRow.createdAt, id: signalRow.id },
    });

    expect(listSignalsMock).toHaveBeenCalledWith(expect.anything(), {
      clerkOrgId: "org_test",
      cursor: { createdAt: new Date("2026-05-27T01:00:00.000Z"), id: 7 },
      limit: 25,
      search: "migration",
      status: "classified",
    });
  });

  it("rejects unbound organizations", async () => {
    await expect(
      caller({
        ...activeIdentity,
        orgGate: { bindingStatus: "unbound" },
      }).signals.list({})
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(listSignalsMock).not.toHaveBeenCalled();
  });
});
