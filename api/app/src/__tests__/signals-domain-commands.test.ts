import type { Database, Signal } from "@db/app";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthIdentity } from "../auth/identity";
import { actorFromAuthIdentity } from "../domain";
import {
  createDefaultSignalCommandDeps,
  createSignalCommand,
  getSignalCommand,
  listProcessingSignalsCommand,
  listWorkingSetSignalsCommand,
} from "../domain/signals";

const mocks = vi.hoisted(() => ({
  createSignalForActorMock: vi.fn(),
  getVisibleSignalByPublicIdMock: vi.fn(),
  listSignalEntityLinksForSignalMock: vi.fn(),
  listSignalsMock: vi.fn(),
  listWorkspaceSignalsMock: vi.fn(),
}));

const {
  createSignalForActorMock,
  getVisibleSignalByPublicIdMock,
  listSignalEntityLinksForSignalMock,
  listSignalsMock,
  listWorkspaceSignalsMock,
} = mocks;

vi.mock("@db/app", () => ({
  getVisibleSignalByPublicId: mocks.getVisibleSignalByPublicIdMock,
  listSignalEntityLinksForSignal: mocks.listSignalEntityLinksForSignalMock,
  listSignals: mocks.listSignalsMock,
  listWorkspaceSignals: mocks.listWorkspaceSignalsMock,
}));
vi.mock("../signals/service", () => ({
  createSignalForActor: mocks.createSignalForActorMock,
}));
vi.mock("../signals/create-signal", () => ({
  isSignalCreateQueueError: (error: unknown) =>
    error instanceof Error && error.name === "SignalCreateQueueError",
}));

const identity: Extract<AuthIdentity, { type: "active" }> = {
  type: "active",
  userId: "user_test",
  orgId: "org_test",
  orgGate: { bindingStatus: "bound", nextSetupRequirement: null },
};

const signalRow: Signal = {
  classification: null,
  classificationMetadata: null,
  clerkOrgId: "org_test",
  createdAt: new Date("2026-05-27T01:00:00.000Z"),
  createdByApiKeyId: null,
  createdByMcpClientId: null,
  createdByMcpGrantId: null,
  createdByUserId: "user_test",
  errorCode: null,
  errorMessage: null,
  id: 7,
  input: "Customer asked for migration help",
  publicId: "signal_123e4567-e89b-12d3-a456-426614174000",
  status: "queued",
  updatedAt: new Date("2026-05-27T01:01:00.000Z"),
  visibilityScope: "team",
};

function ctx(authIdentity: AuthIdentity = identity) {
  return {
    actor: actorFromAuthIdentity(authIdentity, "web"),
    request: { id: "req_test", source: "tanstack" as const },
  };
}

function deps() {
  return createDefaultSignalCommandDeps({ db: {} as Database });
}

beforeEach(() => {
  listSignalsMock.mockReset();
  listWorkspaceSignalsMock.mockReset();
  getVisibleSignalByPublicIdMock.mockReset();
  listSignalEntityLinksForSignalMock.mockReset();
  createSignalForActorMock.mockReset();
  listSignalsMock.mockResolvedValue({ items: [signalRow], nextCursor: null });
  listWorkspaceSignalsMock.mockResolvedValue({
    items: [],
    limit: 2000,
    totalCount: 0,
    truncated: false,
    windowDays: 30,
  });
  getVisibleSignalByPublicIdMock.mockResolvedValue(signalRow);
  listSignalEntityLinksForSignalMock.mockResolvedValue([]);
  createSignalForActorMock.mockResolvedValue({
    id: signalRow.publicId,
    status: "queued",
    visibilityScope: "user",
  });
});

describe("signal domain commands", () => {
  it("lists processing signals scoped to the bound actor", async () => {
    await expect(
      listProcessingSignalsCommand.run({
        ctx: ctx(),
        deps: deps(),
        input: { limit: 10, statuses: ["queued", "processing"] },
      })
    ).resolves.toEqual({ items: [signalRow], nextCursor: null });

    expect(listSignalsMock).toHaveBeenCalledWith(expect.anything(), {
      clerkOrgId: "org_test",
      createdByUserId: "user_test",
      cursor: undefined,
      limit: 10,
      statuses: ["queued", "processing"],
    });
  });

  it("loads the classified working set scoped to the bound actor", async () => {
    await listWorkingSetSignalsCommand.run({
      ctx: ctx(),
      deps: deps(),
      input: {},
    });

    expect(listWorkspaceSignalsMock).toHaveBeenCalledWith(expect.anything(), {
      clerkOrgId: "org_test",
      createdByUserId: "user_test",
    });
  });

  it("returns signal detail with entity links", async () => {
    await expect(
      getSignalCommand.run({
        ctx: ctx(),
        deps: deps(),
        input: { publicId: signalRow.publicId },
      })
    ).resolves.toEqual({ ...signalRow, entityLinks: [] });

    expect(getVisibleSignalByPublicIdMock).toHaveBeenCalledWith(
      expect.anything(),
      {
        clerkOrgId: "org_test",
        createdByUserId: "user_test",
        publicId: signalRow.publicId,
      }
    );
  });

  it("throws a domain not found error when detail is invisible", async () => {
    getVisibleSignalByPublicIdMock.mockResolvedValueOnce(null);

    await expect(
      getSignalCommand.run({
        ctx: ctx(),
        deps: deps(),
        input: { publicId: signalRow.publicId },
      })
    ).rejects.toThrowError(
      expect.objectContaining({
        code: "SIGNAL_NOT_FOUND",
        kind: "not_found",
      })
    );
  });

  it("creates a signal as a web actor", async () => {
    await expect(
      createSignalCommand.run({
        ctx: ctx(),
        deps: deps(),
        input: { input: "new signal" },
      })
    ).resolves.toEqual({
      id: signalRow.publicId,
      status: "queued",
      visibilityScope: "user",
    });

    expect(createSignalForActorMock).toHaveBeenCalledWith(expect.anything(), {
      actor: { kind: "web", orgId: "org_test", userId: "user_test" },
      input: "new signal",
    });
  });

  it("creates a signal as an API-key actor with key attribution", async () => {
    await expect(
      createSignalCommand.run({
        ctx: {
          actor: {
            createdByUserId: "user_test",
            keyId: "key_test",
            kind: "apiKey",
            orgGate: { bindingStatus: "bound", nextSetupRequirement: null },
            orgId: "org_test",
            scopes: ["api.signals.write"],
          },
        },
        deps: deps(),
        input: { input: "new signal" },
      })
    ).resolves.toEqual({
      id: signalRow.publicId,
      status: "queued",
      visibilityScope: "user",
    });

    expect(createSignalForActorMock).toHaveBeenCalledWith(expect.anything(), {
      actor: {
        apiKeyId: "key_test",
        kind: "api_key",
        orgId: "org_test",
        userId: "user_test",
      },
      input: "new signal",
    });
  });

  it("rejects API-key signal creation without the write scope", async () => {
    await expect(
      createSignalCommand.run({
        ctx: {
          actor: {
            createdByUserId: "user_test",
            keyId: "key_test",
            kind: "apiKey",
            orgGate: { bindingStatus: "bound", nextSetupRequirement: null },
            orgId: "org_test",
            scopes: ["api.signals.read"],
          },
        },
        deps: deps(),
        input: { input: "new signal" },
      })
    ).rejects.toThrowError(
      expect.objectContaining({
        code: "API_KEY_SCOPE_REQUIRED",
        kind: "authz",
      })
    );

    expect(createSignalForActorMock).not.toHaveBeenCalled();
  });

  it("creates a signal as an MCP client actor with grant attribution", async () => {
    await expect(
      createSignalCommand.run({
        ctx: {
          actor: {
            clientId: "client_test",
            grantId: "grant_test",
            kind: "mcpClient",
            orgId: "org_test",
            scopes: [],
            userId: "user_test",
          },
          caller: { kind: "service", service: "apps-mcp" },
          request: { id: "req_mcp_test", source: "mcp" },
        },
        deps: deps(),
        input: { input: "new signal" },
      })
    ).resolves.toEqual({
      id: signalRow.publicId,
      status: "queued",
      visibilityScope: "user",
    });

    expect(createSignalForActorMock).toHaveBeenCalledWith(expect.anything(), {
      actor: {
        clientId: "client_test",
        grantId: "grant_test",
        kind: "mcp",
        orgId: "org_test",
        userId: "user_test",
      },
      input: "new signal",
    });
  });

  it("loads signal detail as an API-key actor using creator visibility", async () => {
    await getSignalCommand.run({
      ctx: {
        actor: {
          createdByUserId: "user_test",
          keyId: "key_test",
          kind: "apiKey",
          orgGate: { bindingStatus: "bound", nextSetupRequirement: null },
          orgId: "org_test",
          scopes: ["api.signals.read"],
        },
      },
      deps: deps(),
      input: { publicId: signalRow.publicId },
    });

    expect(getVisibleSignalByPublicIdMock).toHaveBeenCalledWith(
      expect.anything(),
      {
        clerkOrgId: "org_test",
        createdByUserId: "user_test",
        publicId: signalRow.publicId,
      }
    );
  });

  it("rejects API-key signal reads without the read scope", async () => {
    await expect(
      getSignalCommand.run({
        ctx: {
          actor: {
            createdByUserId: "user_test",
            keyId: "key_test",
            kind: "apiKey",
            orgGate: { bindingStatus: "bound", nextSetupRequirement: null },
            orgId: "org_test",
            scopes: ["api.signals.write"],
          },
        },
        deps: deps(),
        input: { publicId: signalRow.publicId },
      })
    ).rejects.toThrowError(
      expect.objectContaining({
        code: "API_KEY_SCOPE_REQUIRED",
        kind: "authz",
      })
    );

    expect(getVisibleSignalByPublicIdMock).not.toHaveBeenCalled();
  });

  it("loads signal detail as an MCP client actor using creator visibility", async () => {
    await getSignalCommand.run({
      ctx: {
        actor: {
          clientId: "client_test",
          grantId: "grant_test",
          kind: "mcpClient",
          orgId: "org_test",
          scopes: [],
          userId: "user_test",
        },
        caller: { kind: "service", service: "apps-mcp" },
        request: { id: "req_mcp_test", source: "mcp" },
      },
      deps: deps(),
      input: { publicId: signalRow.publicId },
    });

    expect(getVisibleSignalByPublicIdMock).toHaveBeenCalledWith(
      expect.anything(),
      {
        clerkOrgId: "org_test",
        createdByUserId: "user_test",
        publicId: signalRow.publicId,
      }
    );
  });

  it("maps queue failures to an internal domain error", async () => {
    const error = new Error("queue failed");
    error.name = "SignalCreateQueueError";
    createSignalForActorMock.mockRejectedValueOnce(error);

    await expect(
      createSignalCommand.run({
        ctx: ctx(),
        deps: deps(),
        input: { input: "new signal" },
      })
    ).rejects.toThrowError(
      expect.objectContaining({
        code: "SIGNAL_QUEUE_FAILED",
        kind: "internal",
      })
    );
  });
});
