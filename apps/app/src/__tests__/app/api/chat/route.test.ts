import { beforeEach, describe, expect, it, vi } from "vitest";

const appendWorkspaceAssistantMessageMock = vi.fn();
const callProviderRoutineMock = vi.fn();
const createNewResumableStreamMock = vi.fn();
const createWorkspaceAssistantGenerationMock = vi.fn();
const createWorkspaceAssistantConversationMock = vi.fn();
const convertToModelMessagesMock = vi.fn();
const ensureFreshSkillIndexForReadMock = vi.fn();
const findProviderRoutinesMock = vi.fn();
const gatewayMock = vi.fn();
const getWorkspaceAssistantConversationByPublicIdMock = vi.fn();
const getVerifiedLightfastSkillSourceRepositoryIdMock = vi.fn();
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
  ensureFreshSkillIndexForRead: ensureFreshSkillIndexForReadMock,
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
  stepCountIs: stepCountIsMock,
  streamText: streamTextMock,
  tool: toolMock,
}));

vi.mock("@repo/provider-routines", () => ({
  callProviderRoutine: callProviderRoutineMock,
  findProviderRoutines: findProviderRoutinesMock,
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
  callProviderRoutineMock.mockReset();
  createNewResumableStreamMock.mockReset();
  createWorkspaceAssistantGenerationMock.mockReset();
  createWorkspaceAssistantConversationMock.mockReset();
  convertToModelMessagesMock.mockReset();
  ensureFreshSkillIndexForReadMock.mockReset();
  findProviderRoutinesMock.mockReset();
  gatewayMock.mockReset();
  getWorkspaceAssistantConversationByPublicIdMock.mockReset();
  getVerifiedLightfastSkillSourceRepositoryIdMock.mockReset();
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
  ensureFreshSkillIndexForReadMock.mockResolvedValue({
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
  callProviderRoutineMock.mockResolvedValue({
    provider: "linear",
    providerRoutineCallId: "prc_123",
    providerToolName: "create_issue",
    result: { id: "issue_123" },
    routineId: "linear__create_issue",
    status: "succeeded",
  });
  findProviderRoutinesMock.mockResolvedValue({ routines: [] });
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
    expect(streamTextMock).toHaveBeenCalledWith(
      expect.objectContaining({
        experimental_telemetry: expect.objectContaining({
          functionId: "workspace-assistant.generate",
          isEnabled: true,
          recordInputs: false,
          recordOutputs: false,
        }),
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
              "Call one read-only connected"
            ),
            execute: expect.any(Function),
          }),
          findProviderRoutines: expect.objectContaining({
            description: expect.stringContaining("Find read-only connected"),
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
    expect(findProviderRoutinesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: { orgId: "org_123", userId: "user_123" },
        db: { kind: "mock-db" },
        scopes: {
          providerRoutineRead: true,
          providerRoutineWrite: false,
        },
        source: {
          clientId: null,
          ref: "conv_123",
          surface: "chat",
        },
      }),
      {
        includeSchema: true,
        query: "issue",
        readOnly: true,
      }
    );

    await streamOptions.tools.callProviderRoutine.execute({
      input: { id: "issue_123" },
      routineId: "linear__get_issue",
    });
    expect(callProviderRoutineMock).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: { orgId: "org_123", userId: "user_123" },
        log: expect.objectContaining({
          error: expect.any(Function),
          info: expect.any(Function),
          warn: expect.any(Function),
        }),
        now: expect.any(Function),
        scopes: {
          providerRoutineRead: true,
          providerRoutineWrite: false,
        },
        source: {
          clientId: null,
          ref: "conv_123",
          surface: "chat",
        },
      }),
      {
        input: { id: "issue_123" },
        routineId: "linear__get_issue",
      }
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
    getWorkspaceAssistantConversationByPublicIdMock.mockResolvedValueOnce(
      undefined
    );

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

function makeConversation() {
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
