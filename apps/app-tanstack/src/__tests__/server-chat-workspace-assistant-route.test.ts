import { beforeEach, describe, expect, it, vi } from "vitest";

const appendWorkspaceAssistantMessageMock = vi.fn();
const createWorkspaceAssistantGenerationMock = vi.fn();
const createWorkspaceAssistantConversationMock = vi.fn();
const convertToModelMessagesMock = vi.fn();
const getSkillIndexSnapshotMock = vi.fn();
const getVerifiedLightfastSkillSourceRepositoryIdMock = vi.fn();
const gatewayMock = vi.fn();
const getWorkspaceAssistantConversationByPublicIdMock = vi.fn();
const callUserConnectorToolMock = vi.fn();
const findUserConnectorToolsMock = vi.fn();
const isDuplicateKeyErrorMock = vi.fn();
const listWorkspaceAssistantMessagesMock = vi.fn();
const markWorkspaceAssistantGenerationCompletedMock = vi.fn();
const markWorkspaceAssistantGenerationFailedMock = vi.fn();
const markWorkspaceAssistantMessageCompletedMock = vi.fn();
const markWorkspaceAssistantMessageFailedMock = vi.fn();
const callProviderRoutineMock = vi.fn();
const findProviderRoutinesMock = vi.fn();
const resolveWorkspaceAssistantAuthContextMock = vi.fn();
const safeValidateUIMessagesMock = vi.fn();
const setWorkspaceAssistantConversationActiveStreamMock = vi.fn();
const smoothStreamMock = vi.fn();
const stepCountIsMock = vi.fn();
const streamTextMock = vi.fn();
const toUIMessageStreamResponseMock = vi.fn();
const toolMock = vi.fn();

vi.mock("~/server/chat/auth", () => ({
  resolveWorkspaceAssistantAuthContext:
    resolveWorkspaceAssistantAuthContextMock,
}));

vi.mock("@api/app/services/skills", () => ({
  getSkillIndexSnapshot: getSkillIndexSnapshotMock,
  getVerifiedLightfastSkillSourceRepositoryId:
    getVerifiedLightfastSkillSourceRepositoryIdMock,
}));

vi.mock("@db/app", () => ({
  appendWorkspaceAssistantMessage: appendWorkspaceAssistantMessageMock,
  createWorkspaceAssistantConversation:
    createWorkspaceAssistantConversationMock,
  createWorkspaceAssistantGeneration: createWorkspaceAssistantGenerationMock,
  createWorkspaceAssistantMessageId: () => "msg_assistant",
  createWorkspaceAssistantStreamId: () => "stream_123",
  getWorkspaceAssistantConversationByPublicId:
    getWorkspaceAssistantConversationByPublicIdMock,
  isDuplicateKeyError: isDuplicateKeyErrorMock,
  listWorkspaceAssistantMessages: listWorkspaceAssistantMessagesMock,
  markWorkspaceAssistantGenerationCompleted:
    markWorkspaceAssistantGenerationCompletedMock,
  markWorkspaceAssistantGenerationFailed:
    markWorkspaceAssistantGenerationFailedMock,
  markWorkspaceAssistantMessageCompleted:
    markWorkspaceAssistantMessageCompletedMock,
  markWorkspaceAssistantMessageFailed: markWorkspaceAssistantMessageFailedMock,
  setWorkspaceAssistantConversationActiveStream:
    setWorkspaceAssistantConversationActiveStreamMock,
}));

vi.mock("@db/app/client", () => ({
  db: { kind: "mock-db" },
}));

vi.mock("@repo/ai/workspace-assistant", () => ({
  lightfastWorkspaceAssistantDataPartSchemas: {
    opportunities: { kind: "schema" },
  },
  lightfastWorkspaceAssistantMessageMetadataSchema: { kind: "metadata-schema" },
  lightfastWorkspaceAssistantTools: {
    callProviderRoutine: { inputSchema: { kind: "call-input" } },
    findProviderRoutines: { inputSchema: { kind: "find-input" } },
  },
}));

vi.mock("@repo/provider-routine-contract", () => ({
  providerRoutineCallInputSchema: { kind: "provider-call-input" },
  providerRoutineCallSuccessSchema: { kind: "provider-call-success" },
  providerRoutineFindInputSchema: { kind: "provider-find-input" },
  providerRoutineFindOutputSchema: { kind: "provider-find-output" },
}));

vi.mock("@api/app/services/connectors/chat-routines", () => ({
  callChatProviderRoutine: callProviderRoutineMock,
  findChatProviderRoutines: findProviderRoutinesMock,
}));

vi.mock("@repo/user-connector-contract", () => ({
  userConnectorCallInputSchema: { kind: "user-connector-call-input" },
  userConnectorCallSuccessSchema: { kind: "user-connector-call-success" },
  userConnectorFindInputSchema: { kind: "user-connector-find-input" },
  userConnectorFindOutputSchema: { kind: "user-connector-find-output" },
}));

vi.mock("@api/app/services/user-connectors/runtime", () => ({
  callUserConnectorTool: callUserConnectorToolMock,
  findUserConnectorTools: findUserConnectorToolsMock,
}));

vi.mock("@vendor/ai", () => ({
  convertToModelMessages: convertToModelMessagesMock,
  gateway: gatewayMock,
  safeValidateUIMessages: safeValidateUIMessagesMock,
  smoothStream: smoothStreamMock,
  stepCountIs: stepCountIsMock,
  streamText: streamTextMock,
  tool: toolMock,
}));

vi.mock("~/chat/resumable-stream-config", () => ({
  isResumableStreamEnabled: false,
}));

vi.mock("~/server/chat/resumable-stream", () => ({
  getLightfastResumableStreamContext: () => ({
    createNewResumableStream: vi.fn(),
  }),
}));

vi.mock("~/server/log", () => ({
  log: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

const { handleWorkspaceAssistantChatRequest } = await import(
  "~/server/chat/workspace-assistant-route"
);

beforeEach(() => {
  appendWorkspaceAssistantMessageMock.mockReset();
  createWorkspaceAssistantGenerationMock.mockReset();
  createWorkspaceAssistantConversationMock.mockReset();
  convertToModelMessagesMock.mockReset();
  getSkillIndexSnapshotMock.mockReset();
  getVerifiedLightfastSkillSourceRepositoryIdMock.mockReset();
  gatewayMock.mockReset();
  getWorkspaceAssistantConversationByPublicIdMock.mockReset();
  callUserConnectorToolMock.mockReset();
  findUserConnectorToolsMock.mockReset();
  isDuplicateKeyErrorMock.mockReset();
  listWorkspaceAssistantMessagesMock.mockReset();
  markWorkspaceAssistantGenerationCompletedMock.mockReset();
  markWorkspaceAssistantGenerationFailedMock.mockReset();
  markWorkspaceAssistantMessageCompletedMock.mockReset();
  markWorkspaceAssistantMessageFailedMock.mockReset();
  callProviderRoutineMock.mockReset();
  findProviderRoutinesMock.mockReset();
  resolveWorkspaceAssistantAuthContextMock.mockReset();
  safeValidateUIMessagesMock.mockReset();
  setWorkspaceAssistantConversationActiveStreamMock.mockReset();
  smoothStreamMock.mockReset();
  stepCountIsMock.mockReset();
  streamTextMock.mockReset();
  toUIMessageStreamResponseMock.mockReset();
  toolMock.mockReset();

  resolveWorkspaceAssistantAuthContextMock.mockResolvedValue({
    identity: {
      orgGate: { bindingStatus: "bound", nextSetupRequirement: null },
      orgId: "org_123",
      type: "active",
      userId: "user_123",
    },
  });
  safeValidateUIMessagesMock.mockImplementation(async ({ messages }) => ({
    data: messages,
    success: true,
  }));
  createWorkspaceAssistantConversationMock.mockResolvedValue(
    makeConversation()
  );
  getWorkspaceAssistantConversationByPublicIdMock.mockResolvedValue(
    makeConversation()
  );
  isDuplicateKeyErrorMock.mockReturnValue(false);
  listWorkspaceAssistantMessagesMock.mockResolvedValue([]);
  appendWorkspaceAssistantMessageMock
    .mockResolvedValueOnce(
      makeMessage({
        parts: [{ text: "Summarize my active opportunities", type: "text" }],
        publicId: "msg_user",
        role: "user",
      })
    )
    .mockResolvedValueOnce(
      makeMessage({
        parts: [],
        publicId: "msg_assistant",
        role: "assistant",
        status: "streaming",
      })
    );
  createWorkspaceAssistantGenerationMock.mockResolvedValue({
    clerkOrgId: "org_123",
    publicId: "gen_123",
  });
  getVerifiedLightfastSkillSourceRepositoryIdMock.mockResolvedValue(42);
  getSkillIndexSnapshotMock.mockResolvedValue({
    skills: [
      {
        description: "Create new skills.",
        name: "Create skill",
        slug: "create-skill",
        validationStatus: "valid",
      },
    ],
  });
  gatewayMock.mockReturnValue("gateway:anthropic/claude-sonnet-4.6");
  convertToModelMessagesMock.mockResolvedValue([
    { content: "Summarize my active opportunities", role: "user" },
  ]);
  setWorkspaceAssistantConversationActiveStreamMock.mockResolvedValue(
    makeConversation()
  );
  smoothStreamMock.mockReturnValue("smooth-stream-transform");
  stepCountIsMock.mockImplementation((count) => ({
    count,
    kind: "step-count",
  }));
  streamTextMock.mockImplementation((options) => {
    options.onFinish?.({
      finishReason: "stop",
      providerMetadata: { gateway: { routed: true } },
      totalUsage: { inputTokens: 10, outputTokens: 12, totalTokens: 22 },
    });
    return {
      toUIMessageStreamResponse: toUIMessageStreamResponseMock,
    };
  });
  toUIMessageStreamResponseMock.mockImplementation((options) => {
    void options.onFinish?.({
      finishReason: "stop",
      isAborted: false,
      isContinuation: true,
      messages: [],
      responseMessage: {
        id: "msg_assistant",
        parts: [{ text: "No active opportunities yet.", type: "text" }],
        role: "assistant",
      },
    });
    return new Response("stream");
  });
  toolMock.mockImplementation((definition) => definition);
});

describe("workspace assistant chat server route", () => {
  it("rejects unauthenticated chat requests", async () => {
    resolveWorkspaceAssistantAuthContextMock.mockResolvedValueOnce({
      identity: { type: "unauthenticated" },
    });

    const response = await handleWorkspaceAssistantChatRequest(
      createJsonRequest({ messages: [] })
    );

    expect(response.status).toBe(401);
    expect(streamTextMock).not.toHaveBeenCalled();
  });

  it("rejects write-mode chat requests with an unauthenticated identity (expired token)", async () => {
    resolveWorkspaceAssistantAuthContextMock.mockResolvedValueOnce({
      identity: { type: "unauthenticated" },
    });

    const response = await handleWorkspaceAssistantChatRequest(
      createWriteModeRequest()
    );

    expect(response.status).toBe(401);
    expect(streamTextMock).not.toHaveBeenCalled();
    expect(findProviderRoutinesMock).not.toHaveBeenCalled();
    expect(findUserConnectorToolsMock).not.toHaveBeenCalled();
  });

  it("rejects write-mode chat requests without an active organization", async () => {
    resolveWorkspaceAssistantAuthContextMock.mockResolvedValueOnce({
      identity: { type: "pending", userId: "user_123" },
    });

    const response = await handleWorkspaceAssistantChatRequest(
      createWriteModeRequest()
    );

    expect(response.status).toBe(403);
    expect(streamTextMock).not.toHaveBeenCalled();
    expect(findProviderRoutinesMock).not.toHaveBeenCalled();
    expect(findUserConnectorToolsMock).not.toHaveBeenCalled();
  });

  it("rejects write-mode chat requests when the active organization is not bound", async () => {
    resolveWorkspaceAssistantAuthContextMock.mockResolvedValueOnce({
      identity: {
        orgGate: { bindingStatus: "unbound", nextSetupRequirement: "bind" },
        orgId: "org_123",
        type: "active",
        userId: "user_123",
      },
    });

    const response = await handleWorkspaceAssistantChatRequest(
      createWriteModeRequest()
    );

    expect(response.status).toBe(403);
    expect(streamTextMock).not.toHaveBeenCalled();
    expect(findProviderRoutinesMock).not.toHaveBeenCalled();
    expect(findUserConnectorToolsMock).not.toHaveBeenCalled();
  });

  it("rejects write-mode chat requests when the conversation belongs to another organization", async () => {
    const duplicatePublicId = new Error("duplicate public id");
    getWorkspaceAssistantConversationByPublicIdMock
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined);
    createWorkspaceAssistantConversationMock.mockRejectedValueOnce(
      duplicatePublicId
    );
    isDuplicateKeyErrorMock.mockReturnValueOnce(true);

    const response = await handleWorkspaceAssistantChatRequest(
      createWriteModeRequest()
    );

    expect(response.status).toBe(404);
    expect(streamTextMock).not.toHaveBeenCalled();
    expect(findProviderRoutinesMock).not.toHaveBeenCalled();
    expect(findUserConnectorToolsMock).not.toHaveBeenCalled();
  });

  it("persists an idempotent turn and streams through the AI Gateway model", async () => {
    const uiMessages = [
      {
        id: "client-message-1",
        parts: [{ text: "Summarize my active opportunities", type: "text" }],
        role: "user",
      },
    ];

    const response = await handleWorkspaceAssistantChatRequest(
      createJsonRequest({
        conversationId: "conv_123",
        idempotencyKey: "idem_user_1",
        messages: uiMessages,
      })
    );

    expect(response.status).toBe(200);
    expect(safeValidateUIMessagesMock).toHaveBeenCalledWith({
      dataSchemas: { opportunities: { kind: "schema" } },
      messages: uiMessages,
      metadataSchema: { kind: "metadata-schema" },
      tools: expect.any(Object),
    });
    expect(
      getWorkspaceAssistantConversationByPublicIdMock
    ).toHaveBeenCalledWith(expect.anything(), {
      clerkOrgId: "org_123",
      createdByUserId: "user_123",
      publicId: "conv_123",
    });
    expect(appendWorkspaceAssistantMessageMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        createdByUserId: "user_123",
        idempotencyKey: "idem_user_1",
        role: "user",
        status: "completed",
      })
    );
    expect(streamTextMock).toHaveBeenCalledWith(
      expect.objectContaining({
        experimental_transform: "smooth-stream-transform",
        model: "gateway:anthropic/claude-sonnet-4.6",
        providerOptions: {
          gateway: expect.objectContaining({
            cacheControl: "max-age=0",
            tags: expect.arrayContaining([
              "feature:workspace-assistant",
              "org:org_123",
              "conversation:conv_123",
            ]),
            user: "user_123",
          }),
        },
        stopWhen: { count: 5, kind: "step-count" },
        system: expect.stringContaining("Create skill"),
      })
    );
    expect(toUIMessageStreamResponseMock).toHaveBeenCalledWith(
      expect.objectContaining({
        consumeSseStream: undefined,
        generateMessageId: expect.any(Function),
        originalMessages: expect.arrayContaining([
          expect.objectContaining({ id: "msg_assistant", role: "assistant" }),
        ]),
      })
    );
    expect(markWorkspaceAssistantMessageCompletedMock).toHaveBeenCalledWith(
      expect.anything(),
      {
        clerkOrgId: "org_123",
        createdByUserId: "user_123",
        parts: [{ text: "No active opportunities yet.", type: "text" }],
        publicId: "msg_assistant",
      }
    );
    expect(markWorkspaceAssistantGenerationCompletedMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        clerkOrgId: "org_123",
        finishReason: "stop",
        publicId: "gen_123",
        requestedByUserId: "user_123",
        usage: { inputTokens: 10, outputTokens: 12, totalTokens: 22 },
      })
    );
  });

  it("passes write mode through provider routine tools and exposes user connector tools", async () => {
    const uiMessages = [
      {
        id: "client-message-1",
        parts: [
          { text: "Create a Linear issue from my meeting", type: "text" },
        ],
        role: "user",
      },
    ];

    const response = await handleWorkspaceAssistantChatRequest(
      createJsonRequest({
        conversationId: "conv_123",
        messages: uiMessages,
        providerRoutineWriteMode: true,
      })
    );

    expect(response.status).toBe(200);
    const streamOptions = streamTextMock.mock.calls.at(-1)?.[0] as
      | {
          tools?: Record<
            string,
            { execute?: (input: Record<string, unknown>) => Promise<unknown> }
          >;
        }
      | undefined;
    expect(streamOptions?.tools).toEqual(
      expect.objectContaining({
        callProviderRoutine: expect.any(Object),
        findProviderRoutines: expect.any(Object),
        callUserConnectorTool: expect.any(Object),
        findUserConnectorTools: expect.any(Object),
      })
    );

    await streamOptions?.tools?.findProviderRoutines?.execute?.({
      query: "linear",
    });
    expect(findProviderRoutinesMock).toHaveBeenCalledWith(
      {
        clerkOrgId: "org_123",
        conversationId: "conv_123",
        userId: "user_123",
        writeMode: true,
      },
      { query: "linear" }
    );

    await streamOptions?.tools?.findUserConnectorTools?.execute?.({
      query: "granola",
    });
    expect(findUserConnectorToolsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: { orgId: "org_123", userId: "user_123" },
        source: {
          conversationId: "conv_123",
          surface: "interactive_chat",
        },
      }),
      { query: "granola" }
    );
  });
});

function createJsonRequest(body: unknown) {
  return new Request("https://app-tanstack.lightfast.localhost/api/chat", {
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
}

function createWriteModeRequest() {
  return createJsonRequest({
    conversationId: "conv_123",
    messages: [
      {
        id: "client-message-1",
        parts: [{ text: "Create a Linear issue", type: "text" }],
        role: "user",
      },
    ],
    providerRoutineWriteMode: true,
  });
}

function makeConversation(overrides: Record<string, unknown> = {}) {
  return {
    activeStreamId: null,
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

function makeMessage(overrides: Record<string, unknown> = {}) {
  return {
    clerkOrgId: "org_123",
    conversationId: 1,
    conversationPublicId: "conv_123",
    createdAt: new Date("2026-06-02T00:00:00.000Z"),
    createdByUserId: "user_123",
    errorCode: null,
    errorMessage: null,
    id: 1,
    idempotencyKey: null,
    metadata: {},
    parts: [],
    publicId: "msg_123",
    role: "user",
    sequence: 0,
    status: "completed",
    updatedAt: new Date("2026-06-02T00:00:00.000Z"),
    ...overrides,
  };
}
