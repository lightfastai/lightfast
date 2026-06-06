import { createHash } from "node:crypto";
import { resolveAuthContextFromClerk } from "@api/app/auth/identity";
import {
  getSkillIndexSnapshot,
  getVerifiedLightfastSkillSourceRepositoryId,
} from "@api/app/services/skills";
import {
  appendWorkspaceAssistantMessage,
  createWorkspaceAssistantConversation,
  createWorkspaceAssistantGeneration,
  createWorkspaceAssistantMessageId,
  createWorkspaceAssistantStreamId,
  getWorkspaceAssistantConversationByPublicId,
  isDuplicateKeyError,
  listWorkspaceAssistantMessages,
  markWorkspaceAssistantGenerationCompleted,
  markWorkspaceAssistantGenerationFailed,
  markWorkspaceAssistantMessageCompleted,
  markWorkspaceAssistantMessageFailed,
  setWorkspaceAssistantConversationActiveStream,
  type WorkspaceAssistantConversation,
  type WorkspaceAssistantGenerationUsage,
  type WorkspaceAssistantMessage,
  type WorkspaceAssistantMessagePart,
  type WorkspaceAssistantRecordMetadata,
} from "@db/app";
import { db } from "@db/app/client";
import {
  type LightfastUIMessage,
  lightfastWorkspaceAssistantDataPartSchemas,
  lightfastWorkspaceAssistantMessageMetadataSchema,
  lightfastWorkspaceAssistantTools,
} from "@repo/ai/workspace-assistant";
import {
  providerRoutineCallInputSchema,
  providerRoutineCallSuccessSchema,
  providerRoutineFindInputSchema,
  providerRoutineFindOutputSchema,
} from "@repo/provider-routine-contract";
import {
  callProviderRoutine,
  findProviderRoutines,
  type ProviderRoutineServiceContext,
} from "@repo/provider-routines";
import {
  convertToModelMessages,
  gateway,
  safeValidateUIMessages,
  smoothStream,
  stepCountIs,
  streamText,
  tool,
} from "@vendor/ai";
import { log } from "@vendor/observability/log/next";
import { z } from "zod";
import { getLightfastResumableStreamContext } from "~/app/(chat)/api/chat/resumable-stream";
import { isResumableStreamEnabled } from "~/app/(chat)/api/chat/resumable-stream-config";

const WORKSPACE_ASSISTANT_MODEL = "anthropic/claude-sonnet-4.6";
const WORKSPACE_ASSISTANT_FALLBACK_MODELS = ["openai/gpt-5.4"] as const;
const WORKSPACE_ASSISTANT_MAX_TOOL_STEPS = 5;
const WORKSPACE_ASSISTANT_STREAM_SMOOTHING = {
  chunking: "word",
  delayInMs: 20,
} as const;

const chatRequestSchema = z
  .object({
    idempotencyKey: z
      .string()
      .trim()
      .min(1)
      .max(128)
      .regex(/^[A-Za-z0-9:_.-]+$/)
      .optional(),
    messages: z.array(z.unknown()),
    conversationId: z
      .string()
      .trim()
      .min(1)
      .max(80)
      .regex(/^conv_[A-Za-z0-9_-]+$/)
      .optional(),
  })
  .passthrough();

const baseSystemPrompt = [
  "You are Lightfield, the Lightfast workspace assistant.",
  "Help the user understand and operate their workspace with concise, direct answers.",
  "When asked about skills, explain what the listed skills can do and suggest the next concrete action.",
  "When connector tools are useful, first find connected provider routines, then call the selected routine by routineId.",
  "Only call provider routines for the active workspace.",
  "Connected provider routines in chat are read-only; do not use them to create, update, delete, post, assign, archive, or move external records.",
].join(" ");

export const maxDuration = 30;

export async function POST(req: Request) {
  const authContext = await resolveAuthContextFromClerk({
    db,
    headers: req.headers,
  });
  const identity = authContext.identity;

  if (identity.type === "unauthenticated") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (identity.type !== "active") {
    return Response.json({ error: "Organization required" }, { status: 403 });
  }
  if (identity.orgGate.bindingStatus !== "bound") {
    return Response.json(
      { error: "Organization setup required" },
      { status: 403 }
    );
  }

  const rawBody = await readJson(req);
  const parsed = rawBody.success
    ? chatRequestSchema.safeParse(rawBody.data)
    : rawBody;

  if (!parsed.success) {
    return Response.json({ error: "Invalid chat request" }, { status: 400 });
  }

  const validatedMessages = await validateLightfastMessages(
    parsed.data.messages
  );
  if (!validatedMessages.success) {
    return Response.json({ error: "Invalid chat messages" }, { status: 400 });
  }

  const submittedMessage = getSubmittedUserMessage(validatedMessages.data);
  if (!submittedMessage) {
    return Response.json({ error: "User message required" }, { status: 400 });
  }
  if (hasUnsupportedUserPart(submittedMessage)) {
    return Response.json(
      { error: "Only text chat messages are supported right now" },
      { status: 400 }
    );
  }

  const conversation = await resolveConversation({
    createdByUserId: identity.userId,
    orgId: identity.orgId,
    submittedMessage,
    conversationId: parsed.data.conversationId,
  });
  if (!conversation) {
    return Response.json(
      { error: "Workspace assistant conversation not found" },
      { status: 404 }
    );
  }

  const existingMessages = await listWorkspaceAssistantMessages(db, {
    clerkOrgId: identity.orgId,
    createdByUserId: identity.userId,
    conversation,
  });
  const canonicalMessages = [
    // Skip degenerate persisted turns that have no parts (e.g. an assistant
    // message whose generation failed before producing content). They cannot
    // be rendered or converted to model messages, and including them fails UI
    // message validation.
    ...existingMessages
      .filter((message) => message.parts.length > 0)
      .map(toUIMessage),
    submittedMessage,
  ];
  const validatedCanonicalMessages =
    await validateLightfastMessages(canonicalMessages);
  if (!validatedCanonicalMessages.success) {
    log.error(
      "[workspace-assistant] persisted or incoming conversation history failed validation",
      {
        clerkOrgId: identity.orgId,
        conversationId: conversation.publicId,
        userId: identity.userId,
      }
    );
    return Response.json(
      { error: "Persisted workspace assistant messages failed validation" },
      { status: 500 }
    );
  }
  const userIdempotencyKey =
    parsed.data.idempotencyKey ??
    createFallbackIdempotencyKey(submittedMessage.id);
  const assistantIdempotencyKey =
    createAssistantIdempotencyKey(userIdempotencyKey);
  const userMessage = await appendWorkspaceAssistantMessage(db, {
    createdByUserId: identity.userId,
    idempotencyKey: userIdempotencyKey,
    parts: submittedMessage.parts as WorkspaceAssistantMessagePart[],
    publicId: normalizeClientMessageId(submittedMessage.id),
    role: "user",
    status: "completed",
    conversation,
  });
  const assistantMessageId = createWorkspaceAssistantMessageId();
  const assistantMessage = await appendWorkspaceAssistantMessage(db, {
    createdByUserId: identity.userId,
    idempotencyKey: assistantIdempotencyKey,
    parts: [],
    publicId: assistantMessageId,
    role: "assistant",
    status: "streaming",
    conversation,
  });
  const generation = await createWorkspaceAssistantGeneration(db, {
    assistantMessage,
    model: WORKSPACE_ASSISTANT_MODEL,
    requestedByUserId: identity.userId,
    requestMetadata: {
      source: "workspace-assistant",
      conversationId: conversation.publicId,
    },
    status: "streaming",
    conversation,
  });

  const canonicalMessagesForModel = [
    ...validatedCanonicalMessages.data.slice(0, -1),
    toUIMessage(userMessage),
  ];
  const originalMessages = [
    ...canonicalMessagesForModel,
    toUIMessage(assistantMessage),
  ];
  const modelMessages = await convertToModelMessages(canonicalMessagesForModel);
  const system = await buildSystemPrompt(identity.orgId);
  let completionUsage: WorkspaceAssistantGenerationUsage | null = null;
  let providerMetadata: WorkspaceAssistantRecordMetadata = {};
  let streamErrored = false;
  const streamId = createWorkspaceAssistantStreamId();
  const generationLogMetadata = {
    clerkOrgId: identity.orgId,
    generationId: generation.publicId,
    model: WORKSPACE_ASSISTANT_MODEL,
    streamId,
    conversationId: conversation.publicId,
    userId: identity.userId,
  };

  const activeConversation =
    await setWorkspaceAssistantConversationActiveStream(db, {
      clerkOrgId: identity.orgId,
      createdByUserId: identity.userId,
      publicId: conversation.publicId,
      streamId,
    });
  if (!activeConversation) {
    return Response.json(
      { error: "Failed to update active stream for conversation." },
      { status: 409 }
    );
  }
  log.info("[workspace-assistant] generation started", generationLogMetadata);

  const result = streamText({
    experimental_telemetry: {
      functionId: "workspace-assistant.generate",
      isEnabled: true,
      metadata: generationLogMetadata,
      recordInputs: false,
      recordOutputs: false,
    },
    experimental_transform: smoothStream(WORKSPACE_ASSISTANT_STREAM_SMOOTHING),
    messages: modelMessages,
    model: gateway(WORKSPACE_ASSISTANT_MODEL),
    onError: async ({ error }) => {
      streamErrored = true;
      const message = getErrorMessage(error);
      log.error("[workspace-assistant] generation error", {
        ...generationLogMetadata,
        errorMessage: message,
      });
      await Promise.all([
        markWorkspaceAssistantMessageFailed(db, {
          clerkOrgId: identity.orgId,
          createdByUserId: identity.userId,
          errorCode: "CHAT_STREAM_FAILED",
          errorMessage: message,
          publicId: assistantMessage.publicId,
        }),
        markWorkspaceAssistantGenerationFailed(db, {
          clerkOrgId: identity.orgId,
          errorCode: "CHAT_STREAM_FAILED",
          errorMessage: message,
          publicId: generation.publicId,
          requestedByUserId: identity.userId,
        }),
        clearActiveStream(db, {
          clerkOrgId: identity.orgId,
          createdByUserId: identity.userId,
          expectedStreamId: streamId,
          publicId: conversation.publicId,
          streamId: null,
          failureMessage: generationLogMetadata,
          type: "error",
          warning:
            "[workspace-assistant] failed to clear active stream after generation error",
        }),
      ]);
    },
    onFinish: ({ providerMetadata: nextProviderMetadata, totalUsage }) => {
      completionUsage = toJsonRecord(totalUsage);
      providerMetadata = toJsonRecord(nextProviderMetadata);
    },
    providerOptions: {
      gateway: {
        cacheControl: "max-age=0",
        models: [...WORKSPACE_ASSISTANT_FALLBACK_MODELS],
        tags: [
          "feature:workspace-assistant",
          `org:${identity.orgId}`,
          `conversation:${conversation.publicId}`,
          `env:${process.env.VERCEL_ENV ?? "development"}`,
        ],
        user: identity.userId,
      },
    },
    stopWhen: stepCountIs(WORKSPACE_ASSISTANT_MAX_TOOL_STEPS),
    system,
    tools: createWorkspaceAssistantProviderRoutineTools({
      conversation,
      orgId: identity.orgId,
      userId: identity.userId,
    }),
  });

  // Resumable replay is disabled in local dev; leaving `consumeSseStream`
  // undefined means the AI SDK skips teeing the SSE stream into Redis and the
  // live stream flows straight to the client.
  const consumeSseStream = isResumableStreamEnabled
    ? async ({ stream }: { stream: ReadableStream<string> }) => {
        try {
          await getLightfastResumableStreamContext().createNewResumableStream(
            streamId,
            () => stream
          );
        } catch (error) {
          log.error(
            "[workspace-assistant] failed to register resumable stream",
            {
              ...generationLogMetadata,
              errorMessage: getErrorMessage(error),
            }
          );
          await clearActiveStream(db, {
            clerkOrgId: identity.orgId,
            createdByUserId: identity.userId,
            expectedStreamId: streamId,
            publicId: conversation.publicId,
            streamId: null,
            failureMessage: generationLogMetadata,
            type: "error",
            warning:
              "[workspace-assistant] failed to clear active stream after resume failure",
          });
          throw error;
        }
      }
    : undefined;

  return result.toUIMessageStreamResponse({
    consumeSseStream,
    generateMessageId: () => assistantMessage.publicId,
    headers: {
      "x-lightfast-workspace-assistant-conversation-id": conversation.publicId,
    },
    messageMetadata: () => ({
      generationId: generation.publicId,
      model: WORKSPACE_ASSISTANT_MODEL,
      source: "workspace-assistant" as const,
      streamId,
    }),
    onError: (error) => getErrorMessage(error),
    onFinish: async ({ finishReason, isAborted, responseMessage }) => {
      if (isAborted) {
        log.warn(
          "[workspace-assistant] generation aborted",
          generationLogMetadata
        );
        await Promise.all([
          markWorkspaceAssistantMessageFailed(db, {
            clerkOrgId: identity.orgId,
            createdByUserId: identity.userId,
            errorCode: "CHAT_STREAM_ABORTED",
            errorMessage: "Workspace assistant stream aborted.",
            publicId: assistantMessage.publicId,
          }),
          markWorkspaceAssistantGenerationFailed(db, {
            clerkOrgId: identity.orgId,
            errorCode: "CHAT_STREAM_ABORTED",
            errorMessage: "Workspace assistant stream aborted.",
            publicId: generation.publicId,
            requestedByUserId: identity.userId,
          }),
          clearActiveStream(db, {
            clerkOrgId: identity.orgId,
            createdByUserId: identity.userId,
            expectedStreamId: streamId,
            publicId: conversation.publicId,
            streamId: null,
            failureMessage: generationLogMetadata,
            type: "warn",
            warning:
              "[workspace-assistant] failed to clear active stream after generation abort",
          }),
        ]);
        return;
      }

      if (streamErrored) {
        // The streamText onError handler already marked this turn failed and
        // cleared the active stream. Never overwrite it with a "completed"
        // status — doing so previously persisted an assistant message with no
        // parts, which fails UI message validation on read and bricks the
        // whole conversation page.
        return;
      }

      if (responseMessage.parts.length === 0) {
        log.warn(
          "[workspace-assistant] generation produced no content",
          generationLogMetadata
        );
        await Promise.all([
          markWorkspaceAssistantMessageFailed(db, {
            clerkOrgId: identity.orgId,
            createdByUserId: identity.userId,
            errorCode: "CHAT_STREAM_EMPTY",
            errorMessage: "Workspace assistant generation produced no content.",
            publicId: assistantMessage.publicId,
          }),
          markWorkspaceAssistantGenerationFailed(db, {
            clerkOrgId: identity.orgId,
            errorCode: "CHAT_STREAM_EMPTY",
            errorMessage: "Workspace assistant generation produced no content.",
            publicId: generation.publicId,
            requestedByUserId: identity.userId,
          }),
          clearActiveStream(db, {
            clerkOrgId: identity.orgId,
            createdByUserId: identity.userId,
            expectedStreamId: streamId,
            publicId: conversation.publicId,
            streamId: null,
            failureMessage: generationLogMetadata,
            type: "warn",
            warning:
              "[workspace-assistant] failed to clear active stream after empty generation",
          }),
        ]);
        return;
      }

      log.info("[workspace-assistant] generation finished", {
        ...generationLogMetadata,
        finishReason,
      });
      await Promise.all([
        markWorkspaceAssistantMessageCompleted(db, {
          clerkOrgId: identity.orgId,
          createdByUserId: identity.userId,
          parts: responseMessage.parts as WorkspaceAssistantMessagePart[],
          publicId: assistantMessage.publicId,
        }),
        markWorkspaceAssistantGenerationCompleted(db, {
          clerkOrgId: identity.orgId,
          finishReason,
          providerMetadata,
          publicId: generation.publicId,
          requestedByUserId: identity.userId,
          usage: completionUsage,
        }),
        clearActiveStream(db, {
          clerkOrgId: identity.orgId,
          createdByUserId: identity.userId,
          expectedStreamId: streamId,
          publicId: conversation.publicId,
          streamId: null,
          failureMessage: generationLogMetadata,
          type: "warn",
          warning:
            "[workspace-assistant] failed to clear active stream after generation finish",
        }),
      ]);
    },
    originalMessages,
  });
}

function createWorkspaceAssistantProviderRoutineTools(input: {
  conversation: WorkspaceAssistantConversation;
  orgId: string;
  userId: string;
}) {
  return {
    callProviderRoutine: tool({
      description:
        "Call one read-only connected provider routine by routineId using this workspace's enabled connector. Use routineIds returned by findProviderRoutines.",
      inputSchema: providerRoutineCallInputSchema,
      outputSchema: providerRoutineCallSuccessSchema,
      execute: async (toolInput) =>
        callProviderRoutine(providerRoutineContext(input), toolInput),
    }),
    findProviderRoutines: tool({
      description:
        "Find read-only connected provider routines available to this workspace through enabled connectors. Use this before calling callProviderRoutine.",
      inputSchema: providerRoutineFindInputSchema,
      outputSchema: providerRoutineFindOutputSchema,
      execute: async (toolInput) =>
        findProviderRoutines(providerRoutineContext(input), {
          ...toolInput,
          readOnly: true,
        }),
    }),
  };
}

function providerRoutineContext(input: {
  conversation: WorkspaceAssistantConversation;
  orgId: string;
  userId: string;
}): ProviderRoutineServiceContext {
  return {
    actor: {
      orgId: input.orgId,
      userId: input.userId,
    },
    db,
    log,
    now: () => new Date(),
    scopes: {
      providerRoutineRead: true,
      providerRoutineWrite: false,
    },
    source: {
      clientId: null,
      ref: input.conversation.publicId,
      surface: "chat",
    },
  };
}

async function readJson(req: Request) {
  try {
    return { data: await req.json(), success: true } as const;
  } catch {
    return { error: new Error("Invalid JSON"), success: false } as const;
  }
}

type ClearActiveStreamFailureLevel = "error" | "warn";

async function clearActiveStream(
  db: Parameters<typeof setWorkspaceAssistantConversationActiveStream>[0],
  input: {
    clerkOrgId: string;
    createdByUserId: string;
    expectedStreamId: string;
    publicId: string;
    streamId: null;
    failureMessage: Record<string, unknown>;
    type: ClearActiveStreamFailureLevel;
    warning: string;
  }
) {
  const updatedConversation =
    await setWorkspaceAssistantConversationActiveStream(db, {
      clerkOrgId: input.clerkOrgId,
      createdByUserId: input.createdByUserId,
      expectedStreamId: input.expectedStreamId,
      publicId: input.publicId,
      streamId: input.streamId,
    });
  if (!updatedConversation) {
    const logger = input.type === "warn" ? log.warn : log.error;
    logger(input.warning, input.failureMessage);
  }
}

function getSubmittedUserMessage(messages: LightfastUIMessage[]) {
  for (let index = messages.length - 1; index >= 0; index--) {
    const message = messages[index];
    if (message?.role === "user") {
      return message;
    }
  }
  return;
}

function hasUnsupportedUserPart(message: LightfastUIMessage) {
  return message.parts.some((part) => part.type !== "text");
}

async function resolveConversation(input: {
  createdByUserId: string;
  orgId: string;
  submittedMessage: LightfastUIMessage;
  conversationId?: string;
}): Promise<WorkspaceAssistantConversation | undefined> {
  if (input.conversationId) {
    const existing = await getWorkspaceAssistantConversationByPublicId(db, {
      clerkOrgId: input.orgId,
      createdByUserId: input.createdByUserId,
      publicId: input.conversationId,
    });
    if (existing) {
      return existing;
    }

    try {
      return await createWorkspaceAssistantConversation(db, {
        clerkOrgId: input.orgId,
        createdByUserId: input.createdByUserId,
        publicId: input.conversationId,
        title: firstTextPart(input.submittedMessage),
      });
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        return;
      }
      throw error;
    }
  }

  return createWorkspaceAssistantConversation(db, {
    clerkOrgId: input.orgId,
    createdByUserId: input.createdByUserId,
    title: firstTextPart(input.submittedMessage),
  });
}

function normalizeClientMessageId(value: string | undefined) {
  return value?.startsWith("msg_") ? value : undefined;
}

function createFallbackIdempotencyKey(value: string | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return `client:${createHash("sha256").update("missing").digest("hex")}`;
  }
  if (/^[A-Za-z0-9:_.-]{1,128}$/.test(trimmed)) {
    return trimmed;
  }
  return `client:${createHash("sha256").update(trimmed).digest("hex")}`;
}

function createAssistantIdempotencyKey(userKey: string) {
  const prefixed = `assistant:${userKey}`;
  if (prefixed.length <= 128) {
    return prefixed;
  }
  return `assistant:${createHash("sha256").update(userKey).digest("hex")}`;
}

function firstTextPart(message: LightfastUIMessage) {
  const text = message.parts.find((part) => part.type === "text")?.text;
  return typeof text === "string" ? text : undefined;
}

function toUIMessage(message: WorkspaceAssistantMessage): LightfastUIMessage {
  return {
    id: message.publicId,
    metadata: message.metadata as LightfastUIMessage["metadata"],
    parts: message.parts as LightfastUIMessage["parts"],
    role: message.role as LightfastUIMessage["role"],
  };
}

function validateLightfastMessages(messages: unknown) {
  return safeValidateUIMessages<LightfastUIMessage>({
    dataSchemas: lightfastWorkspaceAssistantDataPartSchemas,
    messages,
    metadataSchema: lightfastWorkspaceAssistantMessageMetadataSchema,
    tools: lightfastWorkspaceAssistantTools,
  });
}

async function buildSystemPrompt(clerkOrgId: string) {
  const skillContext = await getSkillContext(clerkOrgId);
  return skillContext
    ? `${baseSystemPrompt}\n\nWorkspace skills:\n${skillContext}`
    : baseSystemPrompt;
}

async function getSkillContext(clerkOrgId: string) {
  try {
    const sourceControlRepositoryId =
      await getVerifiedLightfastSkillSourceRepositoryId(db, { clerkOrgId });
    const result = await getSkillIndexSnapshot({
      clerkOrgId,
      sourceControlRepositoryId,
    });

    return result.skills
      .filter((skill) => skill.validationStatus === "valid")
      .slice(0, 12)
      .map((skill) => {
        const description = skill.description ? `: ${skill.description}` : "";
        return `- ${skill.name ?? skill.slug} (${skill.slug})${description}`;
      })
      .join("\n");
  } catch {
    return "";
  }
}

function toJsonRecord(value: unknown): WorkspaceAssistantRecordMetadata {
  if (!(value && typeof value === "object") || Array.isArray(value)) {
    return {};
  }
  return JSON.parse(JSON.stringify(value)) as WorkspaceAssistantRecordMetadata;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
