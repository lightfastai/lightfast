import type {
  Database,
  WorkspaceAssistantConversation,
  WorkspaceAssistantMessage,
} from "@db/app";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthIdentity } from "../auth/identity";

const {
  createWorkspaceAssistantConversationMock,
  getWorkspaceAssistantConversationByPublicIdMock,
  listWorkspaceAssistantMessagesMock,
  listWorkspaceAssistantConversationsMock,
} = vi.hoisted(() => ({
  createWorkspaceAssistantConversationMock: vi.fn(),
  getWorkspaceAssistantConversationByPublicIdMock: vi.fn(),
  listWorkspaceAssistantMessagesMock: vi.fn(),
  listWorkspaceAssistantConversationsMock: vi.fn(),
}));

vi.mock("@db/app/client", () => ({ db: {} }));
vi.mock("@db/app", () => ({
  createWorkspaceAssistantConversation:
    createWorkspaceAssistantConversationMock,
  getWorkspaceAssistantConversationByPublicId:
    getWorkspaceAssistantConversationByPublicIdMock,
  listWorkspaceAssistantMessages: listWorkspaceAssistantMessagesMock,
  listWorkspaceAssistantConversations: listWorkspaceAssistantConversationsMock,
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
const { workspaceAssistantRouter } = await import(
  "../router/(pending-not-allowed)/workspace-assistant"
);

const testRouter = createTRPCRouter({ assistant: workspaceAssistantRouter });
const createCaller = createCallerFactory(testRouter);

type ActiveAuthIdentity = Extract<AuthIdentity, { type: "active" }>;
type PendingAuthIdentity = Extract<AuthIdentity, { type: "pending" }>;

const activeIdentity: ActiveAuthIdentity = {
  type: "active",
  userId: "user_test",
  orgId: "org_test",
  orgGate: { bindingStatus: "bound", nextSetupRequirement: null },
};
const pendingIdentity: PendingAuthIdentity = {
  type: "pending",
  userId: "user_test",
};

function caller(identity: AuthIdentity = activeIdentity) {
  return createCaller({
    auth: { identity },
    db: { kind: "mock-db" } as unknown as Database,
    headers: new Headers(),
  });
}

beforeEach(() => {
  createWorkspaceAssistantConversationMock.mockReset();
  getWorkspaceAssistantConversationByPublicIdMock.mockReset();
  listWorkspaceAssistantMessagesMock.mockReset();
  listWorkspaceAssistantConversationsMock.mockReset();

  createWorkspaceAssistantConversationMock.mockResolvedValue(
    makeConversation()
  );
  getWorkspaceAssistantConversationByPublicIdMock.mockResolvedValue(
    makeConversation()
  );
  listWorkspaceAssistantMessagesMock.mockResolvedValue([makeMessage()]);
  listWorkspaceAssistantConversationsMock.mockResolvedValue({
    items: [makeConversation()],
    nextCursor: null,
  });
});

describe("workspaceAssistantRouter", () => {
  it("creates a conversation scoped to the active organization and user", async () => {
    await expect(
      caller().assistant.createConversation({
        publicId: "conv_client",
        title: "  Summarize my active opportunities  ",
      })
    ).resolves.toEqual(makeConversation());

    expect(createWorkspaceAssistantConversationMock).toHaveBeenCalledWith(
      expect.anything(),
      {
        clerkOrgId: "org_test",
        createdByUserId: "user_test",
        metadata: {
          chatSettings: {
            capabilityMode: "read",
            modelProfile: "fast",
            version: "2.0.0",
          },
        },
        publicId: "conv_client",
        title: "Summarize my active opportunities",
      }
    );
  });

  it("creates a conversation with explicit v2 chat settings metadata", async () => {
    await caller().assistant.createConversation({
      chatSettings: {
        capabilityMode: "write",
        modelProfile: "thinking",
        version: "2.0.0",
      },
      publicId: "conv_client",
      title: "Update the Linear issue",
    });

    expect(createWorkspaceAssistantConversationMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        metadata: {
          chatSettings: {
            capabilityMode: "write",
            modelProfile: "thinking",
            version: "2.0.0",
          },
        },
      })
    );
  });

  it("lists conversations through the workspace assistant repository", async () => {
    const cursor = {
      id: 10,
      updatedAt: new Date("2026-06-02T01:00:00.000Z"),
    };

    await expect(
      caller().assistant.listConversations({ cursor, limit: 20 })
    ).resolves.toEqual({
      items: [makeConversation()],
      nextCursor: null,
    });

    expect(listWorkspaceAssistantConversationsMock).toHaveBeenCalledWith(
      expect.anything(),
      {
        clerkOrgId: "org_test",
        createdByUserId: "user_test",
        cursor,
        limit: 20,
      }
    );
  });

  it("returns one conversation with its persisted messages", async () => {
    await expect(
      caller().assistant.getConversation({ id: "conv_123" })
    ).resolves.toEqual({
      messages: [makeMessage()],
      conversation: makeConversation(),
    });

    expect(
      getWorkspaceAssistantConversationByPublicIdMock
    ).toHaveBeenCalledWith(expect.anything(), {
      clerkOrgId: "org_test",
      createdByUserId: "user_test",
      publicId: "conv_123",
    });
    expect(listWorkspaceAssistantMessagesMock).toHaveBeenCalledWith(
      expect.anything(),
      {
        clerkOrgId: "org_test",
        createdByUserId: "user_test",
        conversation: expect.objectContaining({ id: 1, publicId: "conv_123" }),
      }
    );
  });

  it("drops persisted messages without renderable parts instead of failing validation", async () => {
    listWorkspaceAssistantMessagesMock.mockResolvedValueOnce([
      makeMessage({
        id: 1,
        parts: [{ text: "hey", type: "text" }],
        publicId: "msg_user",
        role: "user",
        sequence: 0,
      }),
      makeMessage({
        id: 2,
        parts: [],
        publicId: "msg_assistant_empty",
        role: "assistant",
        sequence: 1,
        status: "completed",
      }),
    ]);

    const result = await caller().assistant.getConversation({ id: "conv_123" });

    expect(result.messages).toHaveLength(1);
    expect(result.messages).toEqual([
      expect.objectContaining({ publicId: "msg_user" }),
    ]);
  });

  it("returns newly created conversations before messages are appended", async () => {
    listWorkspaceAssistantMessagesMock.mockResolvedValueOnce([]);

    await expect(
      caller().assistant.getConversation({ id: "conv_123" })
    ).resolves.toEqual({
      messages: [],
      conversation: makeConversation(),
    });
  });

  it("throws NOT_FOUND when a conversation is not in the active organization", async () => {
    getWorkspaceAssistantConversationByPublicIdMock.mockResolvedValueOnce(
      undefined
    );

    await expect(
      caller().assistant.getConversation({ id: "conv_missing" })
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(listWorkspaceAssistantMessagesMock).not.toHaveBeenCalled();
  });

  it("rejects callers without a bound organization", async () => {
    await expect(
      caller({
        ...activeIdentity,
        orgGate: {
          bindingStatus: "unbound",
          nextSetupRequirement: "github_org",
        },
      }).assistant.listConversations(undefined)
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(listWorkspaceAssistantConversationsMock).not.toHaveBeenCalled();
  });

  it("does not expose a same-org conversation owned by a different user", async () => {
    getWorkspaceAssistantConversationByPublicIdMock.mockResolvedValueOnce(
      undefined
    );

    await expect(
      caller().assistant.getConversation({ id: "conv_other_user" })
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(
      getWorkspaceAssistantConversationByPublicIdMock
    ).toHaveBeenCalledWith(expect.anything(), {
      clerkOrgId: "org_test",
      createdByUserId: "user_test",
      publicId: "conv_other_user",
    });
    expect(listWorkspaceAssistantMessagesMock).not.toHaveBeenCalled();
  });

  it("rejects callers without an active org for conversation creation", async () => {
    await expect(
      caller(pendingIdentity).assistant.createConversation({
        publicId: "conv_456",
        title: "Summarize my opportunities",
      })
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(createWorkspaceAssistantConversationMock).not.toHaveBeenCalled();
  });

  it("rejects callers without an organization for conversation retrieval", async () => {
    await expect(
      caller(pendingIdentity).assistant.getConversation({ id: "conv_123" })
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(listWorkspaceAssistantMessagesMock).not.toHaveBeenCalled();
  });

  it("returns not found when a conversation is requested from a different org", async () => {
    getWorkspaceAssistantConversationByPublicIdMock.mockResolvedValueOnce(
      undefined
    );

    await expect(
      caller({
        ...activeIdentity,
        orgId: "org_other",
      }).assistant.getConversation({ id: "conv_123" })
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(
      getWorkspaceAssistantConversationByPublicIdMock
    ).toHaveBeenCalledWith(expect.anything(), {
      clerkOrgId: "org_other",
      createdByUserId: "user_test",
      publicId: "conv_123",
    });
    expect(listWorkspaceAssistantMessagesMock).not.toHaveBeenCalled();
  });

  it("rejects expired tokens with unauthorized", async () => {
    await expect(
      caller({
        type: "unauthenticated",
      } as AuthIdentity).assistant.listConversations(undefined)
    ).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    expect(listWorkspaceAssistantConversationsMock).not.toHaveBeenCalled();
  });
});

function makeConversation(
  overrides: Partial<WorkspaceAssistantConversation> = {}
): WorkspaceAssistantConversation {
  const now = new Date("2026-06-02T00:00:00.000Z");
  return {
    clerkOrgId: "org_test",
    createdAt: now,
    createdByUserId: "user_test",
    id: 1,
    lastMessageAt: null,
    lastMessageId: null,
    metadata: {},
    publicId: "conv_123",
    activeStreamId: null,
    status: "active",
    title: "Summarize my active opportunities",
    updatedAt: now,
    ...overrides,
  };
}

function makeMessage(
  overrides: Partial<WorkspaceAssistantMessage> = {}
): WorkspaceAssistantMessage {
  const now = new Date("2026-06-02T00:00:00.000Z");
  return {
    conversationId: 1,
    conversationPublicId: "conv_123",
    clerkOrgId: "org_test",
    createdAt: now,
    createdByUserId: "user_test",
    errorCode: null,
    errorMessage: null,
    id: 1,
    metadata: {},
    parts: [{ text: "Summarize my active opportunities", type: "text" }],
    publicId: "msg_123",
    idempotencyKey: null,
    role: "user",
    sequence: 0,
    status: "completed",
    updatedAt: now,
    ...overrides,
  };
}
