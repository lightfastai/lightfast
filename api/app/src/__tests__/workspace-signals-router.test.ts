import type { Database, Signal } from "@db/app";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthIdentity } from "../auth/identity";

const listSignalsMock = vi.fn();
const listWorkspaceSignalsMock = vi.fn();
const getVisibleSignalByPublicIdMock = vi.fn();
const createSignalForActorMock = vi.fn();

vi.mock("@db/app/client", () => ({ db: {} }));
vi.mock("@db/app", () => ({
  listSignals: listSignalsMock,
  listWorkspaceSignals: listWorkspaceSignalsMock,
  getVisibleSignalByPublicId: getVisibleSignalByPublicIdMock,
}));
vi.mock("../signals/service", () => ({
  createSignalForActor: createSignalForActorMock,
}));
vi.mock("../signals/create-signal", () => ({
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
  orgGate: { bindingStatus: "bound", nextSetupRequirement: null },
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
  createdByMcpClientId: null,
  createdByMcpGrantId: null,
  createdByUserId: "user_test",
  input: "Customer asked for migration help",
  status: "classified",
  visibilityScope: "team",
  classification: {
    schemaVersion: "signal.classification.v2",
    confidence: 0.91,
    disposition: "actionable",
    kind: "follow_up",
    nextAction: "Reply with migration plan",
    priority: "high",
    rationale: "The customer is asking for help.",
    summary: "Customer asked for migration help.",
    title: "Follow up on migration",
    routing: {
      visibility: {
        scope: "team",
        rationale: "Relevant to the team.",
      },
      review: {
        required: false,
        reason: null,
        rationale: null,
      },
      routes: {
        people: {
          shouldRun: false,
          confidence: 0.82,
          rationale: "No person routing is needed.",
        },
      },
    },
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
  listWorkspaceSignalsMock.mockReset();
  getVisibleSignalByPublicIdMock.mockReset();
  createSignalForActorMock.mockReset();
  listSignalsMock.mockResolvedValue({
    items: [signalRow],
    nextCursor: { createdAt: signalRow.createdAt, id: signalRow.id },
  });
  listWorkspaceSignalsMock.mockResolvedValue({
    items: [],
    limit: 2000,
    totalCount: 0,
    truncated: false,
    windowDays: 30,
  });
  getVisibleSignalByPublicIdMock.mockResolvedValue(signalRow);
  createSignalForActorMock.mockResolvedValue({
    id: "signal_123e4567-e89b-12d3-a456-426614174000",
    status: "queued",
    visibilityScope: "user",
  });
});

describe("workspaceSignalsRouter.list", () => {
  it("forwards only cursor, limit, and statuses to the DB list helper", async () => {
    const cursor = { createdAt: new Date("2026-05-27T01:00:00.000Z"), id: 7 };

    await expect(
      caller().signals.list({
        cursor,
        limit: 25,
        statuses: ["queued", "processing"],
      })
    ).resolves.toEqual({
      items: [signalRow],
      nextCursor: { createdAt: signalRow.createdAt, id: signalRow.id },
    });

    expect(listSignalsMock).toHaveBeenCalledWith(expect.anything(), {
      clerkOrgId: "org_test",
      createdByUserId: "user_test",
      cursor,
      limit: 25,
      statuses: ["queued", "processing"],
    });
  });

  it("rejects dormant classified filter inputs", async () => {
    await expect(
      caller().signals.list({
        kinds: ["fix"],
        search: "migration",
      } as never)
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    expect(listSignalsMock).not.toHaveBeenCalled();
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
      createdByUserId: "user_test",
      cursor: undefined,
      limit: 10,
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
        orgGate: {
          bindingStatus: "unbound",
          nextSetupRequirement: "github_org",
        },
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

  it("rejects unbound organizations", async () => {
    await expect(
      caller({
        ...activeIdentity,
        orgGate: {
          bindingStatus: "unbound",
          nextSetupRequirement: "github_org",
        },
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
      createdByUserId: "user_test",
      cursor: undefined,
      limit: undefined,
      statuses: undefined,
    });
  });
});

describe("workspaceSignalsRouter.workingSet", () => {
  it("returns the org-scoped working set with metadata", async () => {
    await expect(caller().signals.workingSet()).resolves.toEqual({
      items: [],
      limit: 2000,
      totalCount: 0,
      truncated: false,
      windowDays: 30,
    });

    expect(listWorkspaceSignalsMock).toHaveBeenCalledWith(expect.anything(), {
      clerkOrgId: "org_test",
      createdByUserId: "user_test",
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
      visibilityScope: "user",
    });

    expect(createSignalForActorMock).toHaveBeenCalledWith(expect.anything(), {
      actor: {
        kind: "web",
        orgId: "org_test",
        userId: "user_test",
      },
      input: "Reply to the migration thread",
    });
  });

  it("scopes creation to the authenticated organization", async () => {
    await caller(activeIdentityForOrg("org_other")).signals.create({
      input: "Track this from the active org",
    });

    expect(createSignalForActorMock).toHaveBeenCalledWith(expect.anything(), {
      actor: {
        kind: "web",
        orgId: "org_other",
        userId: "user_test",
      },
      input: "Track this from the active org",
    });
  });

  it("rejects invalid input before creating a signal", async () => {
    await expect(
      caller().signals.create({ input: "   " })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    expect(createSignalForActorMock).not.toHaveBeenCalled();
  });

  it("translates enqueue failures to an internal tRPC error", async () => {
    const enqueueError = Object.assign(
      new Error("Failed to queue signal for classification."),
      { name: "SignalCreateQueueError" }
    );
    createSignalForActorMock.mockRejectedValueOnce(enqueueError);

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
      {
        ...activeIdentity,
        orgGate: {
          bindingStatus: "unbound" as const,
          nextSetupRequirement: "github_org" as const,
        },
      },
      "FORBIDDEN",
    ],
    [
      "missing lightfast repo",
      {
        ...activeIdentity,
        orgGate: {
          bindingStatus: "unbound" as const,
          nextSetupRequirement: "github_lightfast_repo" as const,
        },
      },
      "FORBIDDEN",
    ],
  ])("rejects %s", async (_label, identity, code) => {
    await expect(
      caller(identity).signals.create({ input: "Create a signal" })
    ).rejects.toMatchObject({ code });

    expect(createSignalForActorMock).not.toHaveBeenCalled();
  });
});

describe("workspaceSignalsRouter.get", () => {
  it("returns the org-scoped signal for a matching publicId", async () => {
    await expect(
      caller().signals.get({ publicId: signalRow.publicId })
    ).resolves.toEqual(signalRow);

    expect(getVisibleSignalByPublicIdMock).toHaveBeenCalledWith(
      expect.anything(),
      {
        publicId: signalRow.publicId,
        clerkOrgId: "org_test",
        createdByUserId: "user_test",
      }
    );
  });

  it("scopes the lookup to the authenticated organization", async () => {
    await caller(activeIdentityForOrg("org_other")).signals.get({
      publicId: signalRow.publicId,
    });

    expect(getVisibleSignalByPublicIdMock).toHaveBeenCalledWith(
      expect.anything(),
      {
        publicId: signalRow.publicId,
        clerkOrgId: "org_other",
        createdByUserId: "user_test",
      }
    );
  });

  it("throws NOT_FOUND when the signal does not exist", async () => {
    getVisibleSignalByPublicIdMock.mockResolvedValueOnce(undefined);

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

    expect(getVisibleSignalByPublicIdMock).not.toHaveBeenCalled();
  });

  it.each([
    ["pending identity", pendingIdentity, "FORBIDDEN"],
    ["unauthenticated identity", unauthenticatedIdentity, "UNAUTHORIZED"],
    [
      "unbound org",
      {
        ...activeIdentity,
        orgGate: {
          bindingStatus: "unbound" as const,
          nextSetupRequirement: "github_org" as const,
        },
      },
      "FORBIDDEN",
    ],
    [
      "missing lightfast repo",
      {
        ...activeIdentity,
        orgGate: {
          bindingStatus: "unbound" as const,
          nextSetupRequirement: "github_lightfast_repo" as const,
        },
      },
      "FORBIDDEN",
    ],
  ])("rejects %s", async (_label, identity, code) => {
    await expect(
      caller(identity).signals.get({ publicId: signalRow.publicId })
    ).rejects.toMatchObject({ code });

    expect(getVisibleSignalByPublicIdMock).not.toHaveBeenCalled();
  });
});
