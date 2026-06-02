import { beforeEach, describe, expect, it, vi } from "vitest";

const getWorkspaceAssistantConversationByPublicIdMock = vi.fn();
const resolveAuthContextFromClerkMock = vi.fn();
const resumeExistingStreamMock = vi.fn();
const setWorkspaceAssistantConversationActiveStreamMock = vi.fn();

vi.mock("@api/app/auth/identity", () => ({
  resolveAuthContextFromClerk: resolveAuthContextFromClerkMock,
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

vi.mock("~/app/(chat)/api/chat/resumable-stream", () => ({
  getLightfastResumableStreamContext: () => ({
    resumeExistingStream: resumeExistingStreamMock,
  }),
}));

const { GET } = await import("~/app/(chat)/api/chat/[id]/stream/route");

beforeEach(() => {
  getWorkspaceAssistantConversationByPublicIdMock.mockReset();
  resolveAuthContextFromClerkMock.mockReset();
  resumeExistingStreamMock.mockReset();
  setWorkspaceAssistantConversationActiveStreamMock.mockReset();

  resolveAuthContextFromClerkMock.mockResolvedValue({
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

describe("chat stream resume route", () => {
  it("returns no content when the conversation has no active stream", async () => {
    getWorkspaceAssistantConversationByPublicIdMock.mockResolvedValueOnce(
      makeConversation({ activeStreamId: null })
    );

    const response = await GET(createRequest(), {
      params: Promise.resolve({ id: "conv_123" }),
    });

    expect(response.status).toBe(204);
    expect(resumeExistingStreamMock).not.toHaveBeenCalled();
  });

  it("resumes the active stream for the authenticated org user", async () => {
    const stream = new ReadableStream<string>();
    resumeExistingStreamMock.mockResolvedValue(stream);

    const response = await GET(createRequest(), {
      params: Promise.resolve({ id: "conv_123" }),
    });

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
  });

  it("clears stale active stream ids when resume storage is already gone", async () => {
    resumeExistingStreamMock.mockResolvedValue(null);

    const response = await GET(createRequest(), {
      params: Promise.resolve({ id: "conv_123" }),
    });

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
  });

  it("does not resume a same-org conversation owned by a different user", async () => {
    getWorkspaceAssistantConversationByPublicIdMock.mockResolvedValueOnce(
      undefined
    );

    const response = await GET(createRequest(), {
      params: Promise.resolve({ id: "conv_other_user" }),
    });

    expect(response.status).toBe(404);
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
