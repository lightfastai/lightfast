import { beforeEach, describe, expect, it, vi } from "vitest";

const appendWorkspaceAssistantMessageMock = vi.fn();
const callChatProviderRoutineMock = vi.fn();
const createNewResumableStreamMock = vi.fn();
const createWorkspaceAssistantGenerationMock = vi.fn();
const createWorkspaceAssistantConversationMock = vi.fn();
const convertToModelMessagesMock = vi.fn();
const getSkillIndexSnapshotMock = vi.fn();
const findChatProviderRoutinesMock = vi.fn();
const gatewayMock = vi.fn();
const getWorkspaceAssistantConversationByPublicIdMock = vi.fn();
const getVerifiedLightfastSkillSourceRepositoryIdMock = vi.fn();
const isDuplicateKeyErrorMock = vi.fn();
const listWorkspaceAssistantMessagesMock = vi.fn();
const logErrorMock = vi.fn();
const logInfoMock = vi.fn();
const logWarnMock = vi.fn();
const markWorkspaceAssistantGenerationCompletedMock = vi.fn();
const markWorkspaceAssistantGenerationFailedMock = vi.fn();
const markWorkspaceAssistantMessageCompletedMock = vi.fn();
const markWorkspaceAssistantMessageFailedMock = vi.fn();
const setWorkspaceAssistantConversationActiveStreamMock = vi.fn();
const resolveAuthContextFromClerkMock = vi.fn();
const safeValidateUIMessagesMock = vi.fn();
const smoothStreamMock = vi.fn();
const stepCountIsMock = vi.fn();
const toUIMessageStreamResponseMock = vi.fn();
const toolMock = vi.fn();
const streamTextMock = vi.fn();
const workspaceAssistantToolsMock = {
  callProviderRoutine: { inputSchema: { kind: "call-input" } },
  findProviderRoutines: { inputSchema: { kind: "find-input" } },
};

vi.mock("@api/app/auth/identity", () => ({
  resolveAuthContextFromClerk: resolveAuthContextFromClerkMock,
}));

vi.mock("@api/app/services/skills", () => ({
  getSkillIndexSnapshot: getSkillIndexSnapshotMock,
  getVerifiedLightfastSkillSourceRepositoryId:
    getVerifiedLightfastSkillSourceRepositoryIdMock,
}));

vi.mock("@db/app", () => ({
  appendWorkspaceAssistantMessage: appendWorkspaceAssistantMessageMock,
  createWorkspaceAssistantGeneration: createWorkspaceAssistantGenerationMock,
  createWorkspaceAssistantMessageId: () => "msg_assistant",
  createWorkspaceAssistantStreamId: () => "stream_123",
  createWorkspaceAssistantConversation:
    createWorkspaceAssistantConversationMock,
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

vi.mock("@vendor/ai", () => ({
  convertToModelMessages: convertToModelMessagesMock,
  gateway: gatewayMock,
  safeValidateUIMessages: safeValidateUIMessagesMock,
  smoothStream: smoothStreamMock,
  stepCountIs: stepCountIsMock,
  streamText: streamTextMock,
  tool: toolMock,
}));

vi.mock("@api/app/services/connectors", () => ({
  callChatProviderRoutine: callChatProviderRoutineMock,
  findChatProviderRoutines: findChatProviderRoutinesMock,
}));

vi.mock("@repo/ai/workspace-assistant", () => ({
  lightfastWorkspaceAssistantDataPartSchemas: {
    opportunities: { kind: "schema" },
  },
  lightfastWorkspaceAssistantMessageMetadataSchema: { kind: "metadata-schema" },
  lightfastWorkspaceAssistantTools: workspaceAssistantToolsMock,
}));

vi.mock("@vendor/observability/log/next", () => ({
  log: {
    error: logErrorMock,
    info: logInfoMock,
    warn: logWarnMock,
  },
}));

vi.mock("~/app/(chat)/api/chat/resumable-stream", () => ({
  getLightfastResumableStreamContext: () => ({
    createNewResumableStream: createNewResumableStreamMock,
  }),
}));

const { POST } = await import("~/app/(chat)/api/chat/route");

beforeEach(() => {
  appendWorkspaceAssistantMessageMock.mockReset();
  callChatProviderRoutineMock.mockReset();
  createNewResumableStreamMock.mockReset();
  createWorkspaceAssistantGenerationMock.mockReset();
  createWorkspaceAssistantConversationMock.mockReset();
  convertToModelMessagesMock.mockReset();
  getSkillIndexSnapshotMock.mockReset();
  findChatProviderRoutinesMock.mockReset();
  gatewayMock.mockReset();
  getWorkspaceAssistantConversationByPublicIdMock.mockReset();
  getVerifiedLightfastSkillSourceRepositoryIdMock.mockReset();
  isDuplicateKeyErrorMock.mockReset();
  listWorkspaceAssistantMessagesMock.mockReset();
  logErrorMock.mockReset();
  logInfoMock.mockReset();
  logWarnMock.mockReset();
  markWorkspaceAssistantGenerationCompletedMock.mockReset();
  markWorkspaceAssistantGenerationFailedMock.mockReset();
  markWorkspaceAssistantMessageCompletedMock.mockReset();
  markWorkspaceAssistantMessageFailedMock.mockReset();
  setWorkspaceAssistantConversationActiveStreamMock.mockReset();
  resolveAuthContextFromClerkMock.mockReset();
  safeValidateUIMessagesMock.mockReset();
  smoothStreamMock.mockReset();
  stepCountIsMock.mockReset();
  toUIMessageStreamResponseMock.mockReset();
  toolMock.mockReset();
  streamTextMock.mockReset();

  resolveAuthContextFromClerkMock.mockResolvedValue({
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
  setWorkspaceAssistantConversationActiveStreamMock.mockResolvedValue(
    makeConversation()
  );
  createWorkspaceAssistantGenerationMock.mockResolvedValue({
    clerkOrgId: "org_123",
    publicId: "gen_123",
  });
  getVerifiedLightfastSkillSourceRepositoryIdMock.mockResolvedValue(42);
  getSkillIndexSnapshotMock.mockResolvedValue({
    freshness: {
      checkedAt: new Date("2026-06-01T00:00:00.000Z"),
      errorCode: null,
      errorMessage: null,
      githubCommitSha: "a".repeat(40),
      indexedAt: new Date("2026-06-01T00:00:00.000Z"),
      indexedCommitSha: "a".repeat(40),
      status: "fresh",
    },
    indexDiagnostics: [],
    repositoryUrl: "https://github.com/acme/.lightfast",
    snapshotVersion: "100:1780272000000:aaaaaaaa:fresh",
    skills: [
      {
        description: "Create new skills, modify existing skills.",
        name: "Create skill",
        slug: "create-skill",
        validationStatus: "valid",
      },
    ],
  });
  createNewResumableStreamMock.mockResolvedValue(new ReadableStream<string>());
  callChatProviderRoutineMock.mockResolvedValue({
    provider: "linear",
    providerRoutineCallId: "prc_123",
    providerToolName: "create_issue",
    result: { id: "issue_123" },
    routineId: "linear__create_issue",
    status: "succeeded",
  });
  findChatProviderRoutinesMock.mockResolvedValue({ routines: [] });
  smoothStreamMock.mockReturnValue("smooth-stream-transform");
  stepCountIsMock.mockImplementation((count) => ({
    count,
    kind: "step-count",
  }));
  toolMock.mockImplementation((definition) => definition);
});

describe("chat route", () => {
  it("rejects unauthenticated chat requests", async () => {
    resolveAuthContextFromClerkMock.mockResolvedValueOnce({
      identity: { type: "unauthenticated" },
    });

    const response = await POST(createJsonRequest({ messages: [] }));

    expect(response.status).toBe(401);
    expect(streamTextMock).not.toHaveBeenCalled();
  });

  it("rejects malformed chat request payload shape", async () => {
    const response = await POST(
      createJsonRequest({ messages: "not-an-array" })
    );

    expect(response.status).toBe(400);
    expect(streamTextMock).not.toHaveBeenCalled();
  });

  it("rejects malformed chat request JSON", async () => {
    const response = await POST(
      new Request("https://app.lightfast.localhost/api/chat", {
        body: "{not-json",
        headers: { "Content-Type": "application/json" },
        method: "POST",
      })
    );

    expect(response.status).toBe(400);
    expect(streamTextMock).not.toHaveBeenCalled();
  });

  it("rejects malformed supplied conversation ids", async () => {
    const response = await POST(
      createJsonRequest({
        messages: [
          {
            id: "client-message-1",
            parts: [{ text: "Start a new workspace plan", type: "text" }],
            role: "user",
          },
        ],
        conversationId: "not-a-conversation-id",
      })
    );

    expect(response.status).toBe(400);
    expect(createWorkspaceAssistantConversationMock).not.toHaveBeenCalled();
    expect(streamTextMock).not.toHaveBeenCalled();
  });

  it("rejects chat requests without an active bound organization", async () => {
    resolveAuthContextFromClerkMock.mockResolvedValueOnce({
      identity: { type: "pending", userId: "user_123" },
    });

    const response = await POST(createJsonRequest({ messages: [] }));

    expect(response.status).toBe(403);
    expect(streamTextMock).not.toHaveBeenCalled();
  });

  it("rejects chat requests with an unauthenticated identity (expired token)", async () => {
    resolveAuthContextFromClerkMock.mockResolvedValueOnce({
      identity: { type: "unauthenticated" },
    });

    const response = await POST(createJsonRequest({ messages: [] }));

    expect(response.status).toBe(401);
    expect(streamTextMock).not.toHaveBeenCalled();
  });

  it("rejects chat requests for active users missing a bound org", async () => {
    resolveAuthContextFromClerkMock.mockResolvedValueOnce({
      identity: {
        orgGate: { bindingStatus: "unbound", nextSetupRequirement: "bind" },
        orgId: "org_123",
        type: "active",
        userId: "user_123",
      },
    });

    const response = await POST(createJsonRequest({ messages: [] }));

    expect(response.status).toBe(403);
    expect(streamTextMock).not.toHaveBeenCalled();
  });

  it("persists an idempotent turn and streams canonical conversation history through the Vercel AI Gateway model", async () => {
    const uiMessages = [
      {
        id: "client-message-1",
        parts: [{ text: "Summarize my active opportunities", type: "text" }],
        role: "user",
      },
    ];
    const persistedMessages = [
      makeMessage({
        parts: [{ text: "Earlier prompt", type: "text" }],
        publicId: "msg_existing",
        role: "user",
      }),
    ];
    const modelMessages = [
      { content: "Earlier prompt", role: "user" },
      { content: "Summarize my active opportunities", role: "user" },
    ];
    const streamResponse = new Response("stream");

    listWorkspaceAssistantMessagesMock.mockResolvedValue(persistedMessages);
    convertToModelMessagesMock.mockResolvedValue(modelMessages);
    gatewayMock.mockReturnValue("gateway:anthropic/claude-sonnet-4.6");
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
      return streamResponse;
    });

    const response = await POST(
      createJsonRequest({
        idempotencyKey: "idem_user_1",
        messages: uiMessages,
        conversationId: "conv_123",
      })
    );

    expect(safeValidateUIMessagesMock).toHaveBeenCalledWith({
      dataSchemas: { opportunities: { kind: "schema" } },
      messages: uiMessages,
      metadataSchema: { kind: "metadata-schema" },
      tools: workspaceAssistantToolsMock,
    });

    expect(
      getWorkspaceAssistantConversationByPublicIdMock
    ).toHaveBeenCalledWith(expect.anything(), {
      clerkOrgId: "org_123",
      createdByUserId: "user_123",
      publicId: "conv_123",
    });
    expect(listWorkspaceAssistantMessagesMock).toHaveBeenCalledWith(
      expect.anything(),
      {
        clerkOrgId: "org_123",
        createdByUserId: "user_123",
        conversation: expect.objectContaining({ id: 1, publicId: "conv_123" }),
      }
    );
    expect(appendWorkspaceAssistantMessageMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        createdByUserId: "user_123",
        idempotencyKey: "idem_user_1",
        parts: uiMessages[0]!.parts,
        role: "user",
        status: "completed",
      })
    );
    expect(appendWorkspaceAssistantMessageMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        publicId: expect.stringMatching(/^msg_/),
        idempotencyKey: "assistant:idem_user_1",
        role: "assistant",
        status: "streaming",
      })
    );
    expect(createWorkspaceAssistantGenerationMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        model: "anthropic/claude-sonnet-4.6",
        requestedByUserId: "user_123",
      })
    );
    expect(convertToModelMessagesMock).toHaveBeenLastCalledWith([
      {
        id: "msg_existing",
        metadata: {},
        parts: persistedMessages[0]!.parts,
        role: "user",
      },
      {
        id: "msg_user",
        metadata: {},
        parts: uiMessages[0]!.parts,
        role: "user",
      },
    ]);
    expect(gatewayMock).toHaveBeenCalledWith("anthropic/claude-sonnet-4.6");
    expect(smoothStreamMock).toHaveBeenCalledWith({
      chunking: "word",
      delayInMs: 20,
    });
    expect(getSkillIndexSnapshotMock).toHaveBeenCalledWith({
      clerkOrgId: "org_123",
      sourceControlRepositoryId: 42,
    });
    expect(streamTextMock).toHaveBeenCalledWith(
      expect.objectContaining({
        experimental_telemetry: expect.objectContaining({
          functionId: "workspace-assistant.generate",
          isEnabled: true,
          recordInputs: false,
          recordOutputs: false,
        }),
        experimental_transform: "smooth-stream-transform",
        messages: modelMessages,
        model: "gateway:anthropic/claude-sonnet-4.6",
        providerOptions: {
          gateway: expect.objectContaining({
            cacheControl: "max-age=0",
            models: expect.any(Array),
            tags: expect.arrayContaining([
              "feature:workspace-assistant",
              "org:org_123",
            ]),
            user: "user_123",
          }),
        },
        system: expect.stringContaining("Create skill"),
      })
    );
    expect(streamTextMock.mock.calls[0]?.[0]).not.toHaveProperty("abortSignal");
    expect(logInfoMock).toHaveBeenCalledWith(
      "[workspace-assistant] generation started",
      expect.objectContaining({
        clerkOrgId: "org_123",
        conversationId: "conv_123",
        userId: "user_123",
      })
    );
    expect(toUIMessageStreamResponseMock).toHaveBeenCalledWith(
      expect.objectContaining({
        consumeSseStream: expect.any(Function),
        generateMessageId: expect.any(Function),
        originalMessages: expect.arrayContaining([
          expect.objectContaining({ id: "msg_assistant", role: "assistant" }),
        ]),
      })
    );
    const streamResponseOptions =
      toUIMessageStreamResponseMock.mock.calls[0]?.[0];
    await streamResponseOptions.consumeSseStream({
      stream: new ReadableStream<string>(),
    });
    expect(createNewResumableStreamMock).toHaveBeenCalledWith(
      "stream_123",
      expect.any(Function)
    );
    expect(
      setWorkspaceAssistantConversationActiveStreamMock
    ).toHaveBeenCalledWith(expect.anything(), {
      clerkOrgId: "org_123",
      createdByUserId: "user_123",
      publicId: "conv_123",
      streamId: "stream_123",
    });
    expect(
      setWorkspaceAssistantConversationActiveStreamMock
    ).toHaveBeenCalledWith(expect.anything(), {
      clerkOrgId: "org_123",
      createdByUserId: "user_123",
      expectedStreamId: "stream_123",
      publicId: "conv_123",
      streamId: null,
    });
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
    expect(response).toBe(streamResponse);
  });

  it("does not register a resumable stream when resumable streaming is disabled (local dev)", async () => {
    const uiMessages = [
      {
        id: "client-message-1",
        parts: [{ text: "Summarize my active opportunities", type: "text" }],
        role: "user",
      },
    ];
    const streamResponse = new Response("stream");

    convertToModelMessagesMock.mockResolvedValue([
      { content: "Summarize my active opportunities", role: "user" },
    ]);
    gatewayMock.mockReturnValue("gateway:anthropic/claude-sonnet-4.6");
    streamTextMock.mockReturnValue({
      toUIMessageStreamResponse: toUIMessageStreamResponseMock,
    });
    toUIMessageStreamResponseMock.mockReturnValue(streamResponse);

    vi.resetModules();
    vi.doMock("~/app/(chat)/api/chat/resumable-stream-config", () => ({
      isResumableStreamEnabled: false,
    }));
    const { POST: DevPOST } = await import("~/app/(chat)/api/chat/route");

    const response = await DevPOST(
      createJsonRequest({
        idempotencyKey: "idem_user_1",
        messages: uiMessages,
        conversationId: "conv_123",
      })
    );

    const streamResponseOptions =
      toUIMessageStreamResponseMock.mock.calls[0]?.[0];
    expect(streamResponseOptions.consumeSseStream).toBeUndefined();
    expect(createNewResumableStreamMock).not.toHaveBeenCalled();
    expect(response).toBe(streamResponse);

    vi.doUnmock("~/app/(chat)/api/chat/resumable-stream-config");
  });

  it("exposes read-only connector provider routines to the workspace assistant as server tools", async () => {
    const uiMessages = [
      {
        id: "client-message-1",
        parts: [{ text: "Summarize my Linear issues", type: "text" }],
        role: "user",
      },
    ];
    const streamResponse = new Response("stream");

    convertToModelMessagesMock.mockResolvedValue([
      { content: "Summarize my Linear issues", role: "user" },
    ]);
    gatewayMock.mockReturnValue("gateway:anthropic/claude-sonnet-4.6");
    streamTextMock.mockReturnValue({
      toUIMessageStreamResponse: toUIMessageStreamResponseMock,
    });
    toUIMessageStreamResponseMock.mockReturnValue(streamResponse);

    const response = await POST(
      createJsonRequest({
        idempotencyKey: "idem_user_1",
        messages: uiMessages,
        conversationId: "conv_123",
      })
    );

    const streamOptions = streamTextMock.mock.calls[0]?.[0];
    expect(streamOptions).toEqual(
      expect.objectContaining({
        stopWhen: { count: 5, kind: "step-count" },
        tools: {
          callProviderRoutine: expect.objectContaining({
            description: expect.stringContaining(
              "Call one connected provider routine"
            ),
            execute: expect.any(Function),
          }),
          findProviderRoutines: expect.objectContaining({
            description: expect.stringContaining(
              "Find connected provider routines"
            ),
            execute: expect.any(Function),
          }),
        },
      })
    );
    expect(stepCountIsMock).toHaveBeenCalledWith(5);

    await streamOptions.tools.findProviderRoutines.execute({
      includeSchema: true,
      query: "issue",
    });
    expect(findChatProviderRoutinesMock).toHaveBeenCalledWith(
      {
        clerkOrgId: "org_123",
        conversationId: "conv_123",
        userId: "user_123",
        writeMode: false,
      },
      {
        includeSchema: true,
        query: "issue",
      }
    );

    await streamOptions.tools.callProviderRoutine.execute({
      input: { id: "issue_123" },
      routineId: "linear__get_issue",
    });
    expect(callChatProviderRoutineMock).toHaveBeenCalledWith(
      {
        clerkOrgId: "org_123",
        conversationId: "conv_123",
        userId: "user_123",
        writeMode: false,
      },
      {
        input: { id: "issue_123" },
        routineId: "linear__get_issue",
      }
    );
    expect(response).toBe(streamResponse);
  });

  it("passes provider routine write mode into chat routine tools", async () => {
    const uiMessages = [
      {
        id: "client-message-1",
        parts: [{ text: "Create a Linear issue", type: "text" }],
        role: "user",
      },
    ];
    const streamResponse = new Response("stream");

    convertToModelMessagesMock.mockResolvedValue([
      { content: "Create a Linear issue", role: "user" },
    ]);
    gatewayMock.mockReturnValue("gateway:anthropic/claude-sonnet-4.6");
    streamTextMock.mockReturnValue({
      toUIMessageStreamResponse: toUIMessageStreamResponseMock,
    });
    toUIMessageStreamResponseMock.mockReturnValue(streamResponse);

    await POST(
      createJsonRequest({
        idempotencyKey: "idem_user_1",
        messages: uiMessages,
        conversationId: "conv_123",
        providerRoutineWriteMode: true,
      })
    );

    const streamOptions = streamTextMock.mock.calls[0]?.[0];
    await streamOptions.tools.findProviderRoutines.execute({
      query: "create",
    });
    expect(findChatProviderRoutinesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: "conv_123",
        writeMode: true,
      }),
      { query: "create" }
    );
  });

  it("marks the assistant turn failed when the model produces no content", async () => {
    const uiMessages = [
      {
        id: "client-message-1",
        parts: [{ text: "hey", type: "text" }],
        role: "user",
      },
    ];
    const streamResponse = new Response("stream");

    convertToModelMessagesMock.mockResolvedValue([
      { content: "hey", role: "user" },
    ]);
    gatewayMock.mockReturnValue("gateway:anthropic/claude-sonnet-4.6");
    streamTextMock.mockReturnValue({
      toUIMessageStreamResponse: toUIMessageStreamResponseMock,
    });
    toUIMessageStreamResponseMock.mockImplementation((options) => {
      void options.onFinish?.({
        finishReason: "stop",
        isAborted: false,
        isContinuation: true,
        messages: [],
        responseMessage: {
          id: "msg_assistant",
          parts: [],
          role: "assistant",
        },
      });
      return streamResponse;
    });

    const response = await POST(
      createJsonRequest({
        idempotencyKey: "idem_user_1",
        messages: uiMessages,
        conversationId: "conv_123",
      })
    );

    expect(markWorkspaceAssistantMessageCompletedMock).not.toHaveBeenCalled();
    expect(
      markWorkspaceAssistantGenerationCompletedMock
    ).not.toHaveBeenCalled();
    expect(markWorkspaceAssistantMessageFailedMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        errorCode: "CHAT_STREAM_EMPTY",
        publicId: "msg_assistant",
      })
    );
    expect(markWorkspaceAssistantGenerationFailedMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        errorCode: "CHAT_STREAM_EMPTY",
        publicId: "gen_123",
      })
    );
    expect(response).toBe(streamResponse);
  });

  it("uses the submitted UI message id as the retry key when no explicit idempotency key is provided", async () => {
    const uiMessages = [
      {
        id: "client-message-1",
        parts: [{ text: "Summarize my active opportunities", type: "text" }],
        role: "user",
      },
    ];
    const streamResponse = new Response("stream");

    convertToModelMessagesMock.mockResolvedValue([
      { content: "Summarize my active opportunities", role: "user" },
    ]);
    gatewayMock.mockReturnValue("gateway:anthropic/claude-sonnet-4.6");
    streamTextMock.mockReturnValue({
      toUIMessageStreamResponse: toUIMessageStreamResponseMock,
    });
    toUIMessageStreamResponseMock.mockReturnValue(streamResponse);

    const response = await POST(
      createJsonRequest({
        messages: uiMessages,
        conversationId: "conv_123",
      })
    );

    expect(appendWorkspaceAssistantMessageMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        idempotencyKey: "client-message-1",
        publicId: undefined,
        role: "user",
      })
    );
    expect(appendWorkspaceAssistantMessageMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        idempotencyKey: "assistant:client-message-1",
        role: "assistant",
      })
    );
    expect(response).toBe(streamResponse);
  });

  it("creates a missing supplied conversation id from the submitted prompt", async () => {
    const uiMessages = [
      {
        id: "client-message-1",
        parts: [{ text: "Start a new workspace plan", type: "text" }],
        role: "user",
      },
    ];
    const createdConversation = makeConversation({
      publicId: "conv_client_generated",
      title: "Start a new workspace plan",
    });
    const streamResponse = new Response("stream");

    getWorkspaceAssistantConversationByPublicIdMock
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined);
    createWorkspaceAssistantConversationMock.mockResolvedValueOnce(
      createdConversation
    );
    listWorkspaceAssistantMessagesMock.mockResolvedValue([]);
    convertToModelMessagesMock.mockResolvedValue([
      { content: "Start a new workspace plan", role: "user" },
    ]);
    gatewayMock.mockReturnValue("gateway:anthropic/claude-sonnet-4.6");
    streamTextMock.mockReturnValue({
      toUIMessageStreamResponse: toUIMessageStreamResponseMock,
    });
    toUIMessageStreamResponseMock.mockReturnValue(streamResponse);

    const response = await POST(
      createJsonRequest({
        idempotencyKey: "idem_user_1",
        messages: uiMessages,
        conversationId: "conv_client_generated",
      })
    );

    expect(createWorkspaceAssistantConversationMock).toHaveBeenCalledWith(
      expect.anything(),
      {
        clerkOrgId: "org_123",
        createdByUserId: "user_123",
        publicId: "conv_client_generated",
        title: "Start a new workspace plan",
      }
    );
    expect(listWorkspaceAssistantMessagesMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        conversation: expect.objectContaining({
          publicId: "conv_client_generated",
        }),
      })
    );
    expect(response).toBe(streamResponse);
  });

  it("recovers a same-scope duplicate supplied conversation id create race", async () => {
    const duplicatePublicIdError = Object.assign(
      new Error("Duplicate entry for key"),
      { code: "ER_DUP_ENTRY" }
    );
    const racedConversation = makeConversation({
      publicId: "conv_raced",
      title: "Start a raced workspace plan",
    });
    const streamResponse = new Response("stream");

    getWorkspaceAssistantConversationByPublicIdMock
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(racedConversation);
    createWorkspaceAssistantConversationMock.mockRejectedValueOnce(
      duplicatePublicIdError
    );
    isDuplicateKeyErrorMock.mockReturnValueOnce(true);
    listWorkspaceAssistantMessagesMock.mockResolvedValue([]);
    convertToModelMessagesMock.mockResolvedValue([
      { content: "Start a raced workspace plan", role: "user" },
    ]);
    gatewayMock.mockReturnValue("gateway:anthropic/claude-sonnet-4.6");
    streamTextMock.mockReturnValue({
      toUIMessageStreamResponse: toUIMessageStreamResponseMock,
    });
    toUIMessageStreamResponseMock.mockReturnValue(streamResponse);

    const response = await POST(
      createJsonRequest({
        idempotencyKey: "idem_user_1",
        messages: [
          {
            id: "client-message-1",
            parts: [{ text: "Start a raced workspace plan", type: "text" }],
            role: "user",
          },
        ],
        conversationId: "conv_raced",
      })
    );

    expect(
      getWorkspaceAssistantConversationByPublicIdMock
    ).toHaveBeenCalledTimes(2);
    expect(listWorkspaceAssistantMessagesMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ conversation: racedConversation })
    );
    expect(response).toBe(streamResponse);
  });

  it("does not persist messages when canonical message validation fails", async () => {
    listWorkspaceAssistantMessagesMock.mockResolvedValueOnce([
      makeMessage({
        id: "msg_existing_db",
        metadata: {},
        parts: [{ text: "Earlier prompt", type: "text" }],
        publicId: "msg_existing",
        role: "user",
      }),
    ]);
    safeValidateUIMessagesMock
      .mockResolvedValueOnce({
        data: [
          {
            id: "client-message-1",
            metadata: {},
            parts: [{ text: "Summarize", type: "text" }],
            role: "user",
          },
        ],
        success: true,
      })
      .mockResolvedValueOnce({
        error: new Error("Invalid tool data"),
        success: false,
      });

    const response = await POST(
      createJsonRequest({
        messages: [
          {
            id: "client-message-1",
            metadata: {},
            parts: [{ text: "Summarize", type: "text" }],
            role: "user",
          },
        ],
      })
    );

    expect(response.status).toBe(500);
    expect(appendWorkspaceAssistantMessageMock).not.toHaveBeenCalled();
    expect(createWorkspaceAssistantGenerationMock).not.toHaveBeenCalled();
  });

  it("does not continue a same-org workspace assistant conversation owned by a different user", async () => {
    const duplicatePublicIdError = Object.assign(
      new Error("Duplicate entry for key"),
      { code: "ER_DUP_ENTRY" }
    );
    getWorkspaceAssistantConversationByPublicIdMock
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined);
    createWorkspaceAssistantConversationMock.mockRejectedValueOnce(
      duplicatePublicIdError
    );
    isDuplicateKeyErrorMock.mockReturnValueOnce(true);

    const response = await POST(
      createJsonRequest({
        messages: [
          {
            id: "client-message-1",
            parts: [{ text: "Continue this", type: "text" }],
            role: "user",
          },
        ],
        idempotencyKey: "idem_other_user",
        conversationId: "conv_other_user",
      })
    );

    expect(response.status).toBe(404);
    expect(
      getWorkspaceAssistantConversationByPublicIdMock
    ).toHaveBeenCalledWith(expect.anything(), {
      clerkOrgId: "org_123",
      createdByUserId: "user_123",
      publicId: "conv_other_user",
    });
    expect(createWorkspaceAssistantConversationMock).toHaveBeenCalledWith(
      expect.anything(),
      {
        clerkOrgId: "org_123",
        createdByUserId: "user_123",
        publicId: "conv_other_user",
        title: "Continue this",
      }
    );
    expect(isDuplicateKeyErrorMock).toHaveBeenCalledWith(
      duplicatePublicIdError
    );
    expect(appendWorkspaceAssistantMessageMock).not.toHaveBeenCalled();
    expect(streamTextMock).not.toHaveBeenCalled();
  });
});

function createJsonRequest(body: unknown) {
  return new Request("https://app.lightfast.localhost/api/chat", {
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
}

function makeConversation(overrides: Record<string, unknown> = {}) {
  return {
    clerkOrgId: "org_123",
    createdAt: new Date("2026-06-02T00:00:00.000Z"),
    createdByUserId: "user_123",
    id: 1,
    lastMessageAt: null,
    lastMessageId: null,
    metadata: {},
    publicId: "conv_123",
    activeStreamId: null,
    status: "active",
    title: "Summarize my active opportunities",
    updatedAt: new Date("2026-06-02T00:00:00.000Z"),
    ...overrides,
  };
}

function makeMessage(overrides: Record<string, unknown> = {}) {
  return {
    conversationId: 1,
    conversationPublicId: "conv_123",
    clerkOrgId: "org_123",
    createdAt: new Date("2026-06-02T00:00:00.000Z"),
    createdByUserId: "user_123",
    errorCode: null,
    errorMessage: null,
    id: 1,
    metadata: {},
    parts: [],
    publicId: "msg_123",
    idempotencyKey: null,
    role: "user",
    sequence: 0,
    status: "completed",
    updatedAt: new Date("2026-06-02T00:00:00.000Z"),
    ...overrides,
  };
}
