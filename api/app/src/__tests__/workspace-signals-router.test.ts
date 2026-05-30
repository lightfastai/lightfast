import type { Database, Signal } from "@db/app";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthIdentity } from "../auth/identity";

const listSignalsMock = vi.fn();
const getSignalByPublicIdMock = vi.fn();
const createAndQueueSignalMock = vi.fn();

vi.mock("@db/app/client", () => ({ db: {} }));
vi.mock("@db/app", () => ({
  listSignals: listSignalsMock,
  getSignalByPublicId: getSignalByPublicIdMock,
}));
vi.mock("../signals/create-signal", () => ({
  createAndQueueSignal: createAndQueueSignalMock,
  isSignalCreateQueueError: (error: unknown) =>
    error instanceof Error && error.name === "SignalCreateQueueError",
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

type ActiveAuthIdentity = Extract<AuthIdentity, { type: "active" }>;

const activeIdentity: ActiveAuthIdentity = {
  type: "active",
  userId: "user_test",
  orgId: "org_test",
  orgGate: { bindingStatus: "bound" },
};

const pendingIdentity: AuthIdentity = {
  type: "pending",
  userId: "user_test",
};

const unauthenticatedIdentity: AuthIdentity = {
  type: "unauthenticated",
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

function activeIdentityForOrg(orgId: string): ActiveAuthIdentity {
  return {
    ...activeIdentity,
    orgId,
  };
}

beforeEach(() => {
  listSignalsMock.mockReset();
  getSignalByPublicIdMock.mockReset();
  createAndQueueSignalMock.mockReset();
  listSignalsMock.mockResolvedValue({
    items: [signalRow],
    nextCursor: { createdAt: signalRow.createdAt, id: signalRow.id },
  });
  getSignalByPublicIdMock.mockResolvedValue(signalRow);
  createAndQueueSignalMock.mockResolvedValue({
    id: "signal_123e4567-e89b-12d3-a456-426614174000",
    status: "queued",
  });
});

describe("workspaceSignalsRouter.list", () => {
  it("forwards filters and returns native DB rows unchanged", async () => {
    await expect(
      caller().signals.list({
        cursor: { createdAt: new Date("2026-05-27T01:00:00.000Z"), id: 7 },
        dispositions: ["actionable"],
        kinds: ["follow_up", "fix"],
        limit: 25,
        peopleRouted: true,
        priorities: ["high", "urgent"],
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
      dispositions: ["actionable"],
      kinds: ["follow_up", "fix"],
      limit: 25,
      peopleRouted: true,
      priorities: ["high", "urgent"],
      search: "migration",
      status: "classified",
    });
  });

  it("normalizes blank search to an unfiltered list request", async () => {
    await expect(
      caller().signals.list({ search: "   " })
    ).resolves.toMatchObject({
      items: [signalRow],
    });

    expect(listSignalsMock).toHaveBeenCalledWith(expect.anything(), {
      clerkOrgId: "org_test",
      cursor: undefined,
      dispositions: undefined,
      kinds: undefined,
      limit: undefined,
      peopleRouted: undefined,
      priorities: undefined,
      search: undefined,
      status: undefined,
    });
  });

  it("forwards multi-status processing list filters", async () => {
    await expect(
      caller().signals.list({
        limit: 10,
        statuses: ["queued", "processing"],
      })
    ).resolves.toMatchObject({
      items: [signalRow],
    });

    expect(listSignalsMock).toHaveBeenCalledWith(expect.anything(), {
      clerkOrgId: "org_test",
      cursor: undefined,
      dispositions: undefined,
      kinds: undefined,
      limit: 10,
      peopleRouted: undefined,
      priorities: undefined,
      search: undefined,
      status: undefined,
      statuses: ["queued", "processing"],
    });
  });

  it("rejects non-date cursor values before querying", async () => {
    await expect(
      caller().signals.list({
        cursor: { createdAt: null as unknown as Date, id: 7 },
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    expect(listSignalsMock).not.toHaveBeenCalled();
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

  it("rejects when no active org is selected", async () => {
    await expect(
      caller(pendingIdentity).signals.list({})
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(listSignalsMock).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated callers", async () => {
    await expect(
      caller(unauthenticatedIdentity).signals.list({})
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(listSignalsMock).not.toHaveBeenCalled();
  });

  it("rejects revoked organizations", async () => {
    await expect(
      caller({
        ...activeIdentity,
        orgGate: { bindingStatus: "revoked" },
      }).signals.list({})
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(listSignalsMock).not.toHaveBeenCalled();
  });

  it("scopes list queries to the authenticated organization", async () => {
    await expect(
      caller(activeIdentityForOrg("org_other")).signals.list({})
    ).resolves.toMatchObject({ items: [signalRow] });

    expect(listSignalsMock).toHaveBeenCalledWith(expect.anything(), {
      clerkOrgId: "org_other",
      cursor: undefined,
      dispositions: undefined,
      kinds: undefined,
      limit: undefined,
      peopleRouted: undefined,
      priorities: undefined,
      search: undefined,
      status: undefined,
    });
  });
});

describe("workspaceSignalsRouter.create", () => {
  it("trims input and creates a queued signal for the bound org", async () => {
    await expect(
      caller().signals.create({ input: "  Reply to the migration thread  " })
    ).resolves.toEqual({
      id: "signal_123e4567-e89b-12d3-a456-426614174000",
      status: "queued",
    });

    expect(createAndQueueSignalMock).toHaveBeenCalledWith(expect.anything(), {
      clerkOrgId: "org_test",
      createdByApiKeyId: null,
      createdByUserId: "user_test",
      input: "Reply to the migration thread",
    });
  });

  it("scopes creation to the authenticated organization", async () => {
    await caller(activeIdentityForOrg("org_other")).signals.create({
      input: "Track this from the active org",
    });

    expect(createAndQueueSignalMock).toHaveBeenCalledWith(expect.anything(), {
      clerkOrgId: "org_other",
      createdByApiKeyId: null,
      createdByUserId: "user_test",
      input: "Track this from the active org",
    });
  });

  it("rejects invalid input before creating a signal", async () => {
    await expect(
      caller().signals.create({ input: "   " })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    expect(createAndQueueSignalMock).not.toHaveBeenCalled();
  });

  it("translates enqueue failures to an internal tRPC error", async () => {
    const enqueueError = Object.assign(
      new Error("Failed to queue signal for classification."),
      { name: "SignalCreateQueueError" }
    );
    createAndQueueSignalMock.mockRejectedValueOnce(enqueueError);

    await expect(
      caller().signals.create({ input: "Queue this signal" })
    ).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to queue signal for classification.",
    });
  });

  it.each([
    ["pending identity", pendingIdentity, "FORBIDDEN"],
    ["unauthenticated identity", unauthenticatedIdentity, "UNAUTHORIZED"],
    [
      "unbound org",
      { ...activeIdentity, orgGate: { bindingStatus: "unbound" as const } },
      "FORBIDDEN",
    ],
    [
      "revoked org",
      { ...activeIdentity, orgGate: { bindingStatus: "revoked" as const } },
      "FORBIDDEN",
    ],
  ])("rejects %s", async (_label, identity, code) => {
    await expect(
      caller(identity).signals.create({ input: "Create a signal" })
    ).rejects.toMatchObject({ code });

    expect(createAndQueueSignalMock).not.toHaveBeenCalled();
  });
});

describe("workspaceSignalsRouter.get", () => {
  it("returns the org-scoped signal for a matching publicId", async () => {
    await expect(
      caller().signals.get({ publicId: signalRow.publicId })
    ).resolves.toEqual(signalRow);

    expect(getSignalByPublicIdMock).toHaveBeenCalledWith(expect.anything(), {
      publicId: signalRow.publicId,
      clerkOrgId: "org_test",
    });
  });

  it("scopes the lookup to the authenticated organization", async () => {
    await caller(activeIdentityForOrg("org_other")).signals.get({
      publicId: signalRow.publicId,
    });

    expect(getSignalByPublicIdMock).toHaveBeenCalledWith(expect.anything(), {
      publicId: signalRow.publicId,
      clerkOrgId: "org_other",
    });
  });

  it("throws NOT_FOUND when the signal does not exist", async () => {
    getSignalByPublicIdMock.mockResolvedValueOnce(undefined);

    await expect(
      caller().signals.get({
        publicId: "signal_00000000-0000-4000-8000-000000000000",
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("rejects invalid signal ids before querying", async () => {
    await expect(
      caller().signals.get({ publicId: "not-a-signal-id" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    expect(getSignalByPublicIdMock).not.toHaveBeenCalled();
  });

  it.each([
    ["pending identity", pendingIdentity, "FORBIDDEN"],
    ["unauthenticated identity", unauthenticatedIdentity, "UNAUTHORIZED"],
    [
      "unbound org",
      { ...activeIdentity, orgGate: { bindingStatus: "unbound" as const } },
      "FORBIDDEN",
    ],
    [
      "revoked org",
      { ...activeIdentity, orgGate: { bindingStatus: "revoked" as const } },
      "FORBIDDEN",
    ],
  ])("rejects %s", async (_label, identity, code) => {
    await expect(
      caller(identity).signals.get({ publicId: signalRow.publicId })
    ).rejects.toMatchObject({ code });

    expect(getSignalByPublicIdMock).not.toHaveBeenCalled();
  });
});
