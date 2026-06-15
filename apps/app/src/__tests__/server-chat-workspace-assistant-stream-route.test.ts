import { beforeEach, describe, expect, it, vi } from "vitest";

const getWorkspaceAssistantConversationByPublicIdMock = vi.fn();
const resolveWorkspaceAssistantAuthContextMock = vi.fn();
const resumeExistingStreamMock = vi.fn();
const setWorkspaceAssistantConversationActiveStreamMock = vi.fn();

vi.mock("~/server/chat/auth", () => ({
  resolveWorkspaceAssistantAuthContext:
    resolveWorkspaceAssistantAuthContextMock,
}));

vi.mock("@db/app", () => ({
  getWorkspaceAssistantConversationByPublicId:
    getWorkspaceAssistantConversationByPublicIdMock,
  setWorkspaceAssistantConversationActiveStream:
    setWorkspaceAssistantConversationActiveStreamMock,
}));

vi.mock("@db/app/client", () => ({
  db: { kind: "mock-db" },
}));

vi.mock("@vendor/ai", () => ({
  UI_MESSAGE_STREAM_HEADERS: {
    "content-type": "text/event-stream",
  },
}));

vi.mock("~/server/chat/resumable-stream", () => ({
  getLightfastResumableStreamContext: () => ({
    resumeExistingStream: resumeExistingStreamMock,
  }),
}));

vi.mock("~/server/log", () => ({
  log: {
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

const { handleWorkspaceAssistantStreamRequest } = await import(
  "~/server/chat/workspace-assistant-stream-route"
);

beforeEach(() => {
  getWorkspaceAssistantConversationByPublicIdMock.mockReset();
  resolveWorkspaceAssistantAuthContextMock.mockReset();
  resumeExistingStreamMock.mockReset();
  setWorkspaceAssistantConversationActiveStreamMock.mockReset();

  resolveWorkspaceAssistantAuthContextMock.mockResolvedValue({
    identity: {
      orgGate: { bindingStatus: "bound", nextSetupRequirement: null },
      orgId: "org_123",
      type: "active",
      userId: "user_123",
    },
  });
  getWorkspaceAssistantConversationByPublicIdMock.mockResolvedValue(
    makeConversation()
  );
});

describe("workspace assistant stream resume route", () => {
  it("returns no content without touching storage when resumable streaming is disabled locally", async () => {
    vi.resetModules();
    vi.doMock("~/chat/resumable-stream-config", () => ({
      isResumableStreamEnabled: false,
    }));
    const { handleWorkspaceAssistantStreamRequest: disabledHandler } =
      await import("~/server/chat/workspace-assistant-stream-route");

    const response = await disabledHandler(createRequest(), "conv_123");

    expect(response.status).toBe(204);
    expect(
      getWorkspaceAssistantConversationByPublicIdMock
    ).not.toHaveBeenCalled();
    expect(resumeExistingStreamMock).not.toHaveBeenCalled();

    vi.doUnmock("~/chat/resumable-stream-config");
  });

  it("resumes the active stream for the authenticated org user", async () => {
    vi.resetModules();
    vi.doMock("~/chat/resumable-stream-config", () => ({
      isResumableStreamEnabled: true,
    }));
    const { handleWorkspaceAssistantStreamRequest: enabledHandler } =
      await import("~/server/chat/workspace-assistant-stream-route");
    const stream = new ReadableStream<string>();
    resumeExistingStreamMock.mockResolvedValue(stream);

    const response = await enabledHandler(createRequest(), "conv_123");

    expect(
      getWorkspaceAssistantConversationByPublicIdMock
    ).toHaveBeenCalledWith(expect.anything(), {
      clerkOrgId: "org_123",
      createdByUserId: "user_123",
      publicId: "conv_123",
    });
    expect(resumeExistingStreamMock).toHaveBeenCalledWith("stream_123");
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/event-stream");
    expect(
      response.headers.get("x-lightfast-workspace-assistant-conversation-id")
    ).toBe("conv_123");

    vi.doUnmock("~/chat/resumable-stream-config");
  });

  it("clears stale active stream ids when resume storage is gone", async () => {
    vi.resetModules();
    vi.doMock("~/chat/resumable-stream-config", () => ({
      isResumableStreamEnabled: true,
    }));
    const { handleWorkspaceAssistantStreamRequest: enabledHandler } =
      await import("~/server/chat/workspace-assistant-stream-route");
    resumeExistingStreamMock.mockResolvedValue(null);

    const response = await enabledHandler(createRequest(), "conv_123");

    expect(response.status).toBe(204);
    expect(
      setWorkspaceAssistantConversationActiveStreamMock
    ).toHaveBeenCalledWith(expect.anything(), {
      clerkOrgId: "org_123",
      createdByUserId: "user_123",
      expectedStreamId: "stream_123",
      publicId: "conv_123",
      streamId: null,
    });

    vi.doUnmock("~/chat/resumable-stream-config");
  });

  it("rejects unauthenticated stream requests", async () => {
    resolveWorkspaceAssistantAuthContextMock.mockResolvedValueOnce({
      identity: { type: "unauthenticated" },
    });

    const response = await handleWorkspaceAssistantStreamRequest(
      createRequest(),
      "conv_123"
    );

    expect(response.status).toBe(401);
    expect(resumeExistingStreamMock).not.toHaveBeenCalled();
  });
});

function createRequest() {
  return new Request(
    "https://app.lightfast.localhost/api/chat/conv_123/stream"
  );
}

function makeConversation(overrides: Record<string, unknown> = {}) {
  return {
    activeStreamId: "stream_123",
    clerkOrgId: "org_123",
    createdAt: new Date("2026-06-02T00:00:00.000Z"),
    createdByUserId: "user_123",
    id: 1,
    lastMessageAt: null,
    lastMessageId: null,
    metadata: {},
    publicId: "conv_123",
    status: "active",
    title: "Summarize my active opportunities",
    updatedAt: new Date("2026-06-02T00:00:00.000Z"),
    ...overrides,
  };
}
