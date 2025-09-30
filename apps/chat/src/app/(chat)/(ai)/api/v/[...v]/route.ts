import { gateway } from "@ai-sdk/gateway";
import { auth } from "@clerk/nextjs/server";
import {
  addBreadcrumb,
  captureException,
  captureMessage,
  startSpan,
  withScope,
  wrapRouteHandlerWithSentry,
} from "@sentry/nextjs";
import { smoothStream, stepCountIs, wrapLanguageModel } from "ai";
import { BraintrustMiddleware, initLogger, traced } from "braintrust";
import { createAgent } from "lightfast/agent";
import { fetchRequestHandler } from "lightfast/server/adapters/fetch";
import { uuidv4 } from "lightfast/v2/utils";

import type { AppRuntimeContext } from "@repo/chat-ai-types";
import { getBraintrustConfig, isOtelEnabled } from "@repo/ai/braintrust-env";
import { saveDocument } from "@repo/chat-api-services/artifacts";

import {
  MAX_JSON_PARSE_BYTES,
  MAX_REQUEST_PAYLOAD_BYTES,
} from "@repo/chat-ai-types";
import type {
  ChatRouteRequestBody,
  ChatRouteResources,
} from "./_lib/route-policies";
import { createDocumentHandlersByArtifactKind } from "~/ai/artifacts/server";
import { getDefaultModelForUser } from "~/ai/providers";
import { env } from "~/env";
import { ApiErrors } from "~/lib/errors/api-error-builder";
import {
  confirmQuotaUsage,
  releaseQuotaReservation,
} from "~/services/quota-reservation.service";
import { runGuards } from "./_lib/policy-engine";
import { chatGuards } from "./_lib/route-policies";
import { c010Tools } from "./_lib/tools";
import {
  createSystemPromptForUser,
  getActiveToolsForUser,
} from "./_lib/user-utils";

// export const runtime = "edge";

// Initialize Braintrust logging
const braintrustConfig = getBraintrustConfig();
initLogger({
  apiKey: braintrustConfig.apiKey,
  projectName: braintrustConfig.projectName || "chat-app",
});

const createDocumentHandlers =
  createDocumentHandlersByArtifactKind(saveDocument);

const webSearchToolRuntime = {
  exaApiKey: env.EXA_API_KEY,
};

const applyTelemetryHeaders = (
  response: Response,
  telemetry: {
    requestId: string;
    sessionId?: string;
    agentId?: string;
    messageId?: string;
  },
): Response => {
  response.headers.set("x-request-id", telemetry.requestId);
  if (telemetry.sessionId) {
    response.headers.set("x-session-id", telemetry.sessionId);
  }
  if (telemetry.agentId) {
    response.headers.set("x-agent-id", telemetry.agentId);
  }
  if (telemetry.messageId) {
    response.headers.set("x-message-id", telemetry.messageId);
  }
  return response;
};

class RequestPayloadTooLargeError extends Error {
  constructor(
    public readonly limit: number,
    public readonly received: number,
  ) {
    super(`Request payload exceeded limit of ${limit} bytes`);
    this.name = "RequestPayloadTooLargeError";
  }
}

class RequestBodyParseError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "RequestBodyParseError";
  }
}

interface ParsedRequestPayload {
  text: string;
  size: number;
  body: ChatRouteRequestBody | null;
}

const decoder = new TextDecoder();

async function readRequestBodyWithLimit(
  request: Request,
  byteLimit: number,
): Promise<{ text: string; size: number }> {
  const contentLength = request.headers.get("content-length");
  if (contentLength) {
    const declaredSize = Number(contentLength);
    if (!Number.isNaN(declaredSize) && declaredSize > byteLimit) {
      throw new RequestPayloadTooLargeError(byteLimit, declaredSize);
    }
  }

  const stream = request.body;
  if (!stream) {
    return { text: "", size: 0 };
  }

  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    total += value.byteLength;
    if (total > byteLimit) {
      void reader.cancel("payload too large");
      throw new RequestPayloadTooLargeError(byteLimit, total);
    }

    chunks.push(value);
  }

  if (chunks.length === 0) {
    return { text: "", size: total };
  }

  if (chunks.length === 1) {
    return { text: decoder.decode(chunks[0]), size: total };
  }

  const buffer = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    buffer.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return { text: decoder.decode(buffer), size: total };
}

function safeParseRequestBody(text: string): ChatRouteRequestBody | null {
  if (!text.trim()) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new RequestBodyParseError("Invalid JSON payload", error);
  }

  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new RequestBodyParseError(
      "Chat request payload must be a JSON object",
      parsed,
    );
  }

  return parsed as ChatRouteRequestBody;
}

async function extractRequestPayload(
  request: Request,
  byteLimit: number,
): Promise<ParsedRequestPayload> {
  const { text, size } = await readRequestBodyWithLimit(request, byteLimit);

  if (size > MAX_JSON_PARSE_BYTES) {
    throw new RequestPayloadTooLargeError(MAX_JSON_PARSE_BYTES, size);
  }

  const body = safeParseRequestBody(text);

  return { text, size, body };
}

function recreateRequestWithBody(
  original: Request,
  bodyText: string,
  payloadBytes: number,
): Request {
  const headers = new Headers(original.headers);
  headers.set("content-length", `${payloadBytes}`);

  const init: RequestInit = {
    method: original.method,
    headers,
  };

  if (original.method !== "GET" && original.method !== "HEAD") {
    init.body = bodyText;
  }

  return new Request(original.url, init);
}

const handler = async (
  req: Request,
  { params }: { params: Promise<{ v?: string[] }> },
) =>
  withScope(async (scope) => {
    scope.setTag("ai.route", "chat-ai-v");
    scope.setTag("http.method", req.method);
    scope.setContext("request", {
      method: req.method,
      url: req.url,
    });

    const requestId = uuidv4();
    scope.setTag("lightfast.request_id", requestId);

    const { v } = await params;
    const [agentId, sessionId] = v ?? [];
    const telemetry: {
      requestId: string;
      agentId?: string;
      sessionId?: string;
      messageId?: string;
    } = {
      requestId,
      agentId,
      sessionId,
    };

    if (agentId) {
      scope.setTag("ai.agent_id", agentId);
    }
    if (sessionId) {
      scope.setTag("ai.session_id", sessionId);
    }
    scope.setTransactionName(
      `[chat] ${req.method} /api/v/${agentId ?? ":agentId"}/${sessionId ?? ":sessionId"}`,
    );

    if (!agentId || !sessionId) {
      captureMessage("chat.api.invalid_path", {
        level: "warning",
        extra: { method: req.method },
      });
      return applyTelemetryHeaders(
        ApiErrors.invalidPath({ requestId }),
        telemetry,
      );
    }

    let authenticatedUserId: string | null = null;
    try {
      const authResult = await startSpan(
        {
          name: "clerk.auth",
          op: "auth",
          attributes: {
            agentId,
            sessionId,
          },
        },
        () => auth(),
      );
      authenticatedUserId = authResult.userId;
    } catch (error) {
      captureException(error, {
        contexts: {
          auth: { stage: "verify", agentId, sessionId },
        },
      });
      return applyTelemetryHeaders(
        ApiErrors.authenticationUnavailable({ requestId }),
        telemetry,
      );
    }

    const isAnonymous = !authenticatedUserId;
    let userId: string;
    if (authenticatedUserId) {
      userId = authenticatedUserId;
      scope.setUser({ id: userId });
    } else {
      userId = `anon_${sessionId}`;
      scope.setUser({ id: userId, segment: "anonymous" });
    }

    const messageId = uuidv4();
    telemetry.messageId = messageId;
    const isResume = req.method === "GET";

    const resources: ChatRouteResources = {
      requestId,
      agentId,
      sessionId,
      runtime: { messageId },
      auth: {
        clerkUserId: authenticatedUserId,
        userId,
        isAnonymous,
      },
      request: {
        method: req.method,
        isResume,
        webSearchEnabled: isResume ? true : false,
        lastUserMessage: "",
        conversationCharCount: 0,
        payloadBytes: 0,
        body: null,
      },
      model: {
        id: isResume
          ? getDefaultModelForUser(!isAnonymous)
          : "google/gemini-2.5-flash",
      },
    };

    let requestForHandlers = req;
    let parsedRequestBody: ChatRouteRequestBody | null = null;

    if (!isResume && req.method === "POST") {
      try {
        const parsedPayload = await extractRequestPayload(
          req,
          MAX_REQUEST_PAYLOAD_BYTES,
        );

        resources.request.payloadBytes = parsedPayload.size;
        resources.request.body = parsedPayload.body;
        parsedRequestBody = parsedPayload.body;

        requestForHandlers = recreateRequestWithBody(
          req,
          parsedPayload.text,
          parsedPayload.size,
        );
      } catch (error) {
        console.warn(
          "[Chat API] Failed to process request payload before guard evaluation",
          {
            error,
            requestId,
            agentId,
            sessionId,
            isAnonymous,
          },
        );

        if (error instanceof RequestPayloadTooLargeError) {
          return applyTelemetryHeaders(
            ApiErrors.payloadTooLarge({
              requestId,
              isAnonymous,
              reason: "request_payload_bytes_exceeded",
              limitBytes: error.limit,
              receivedBytes: error.received,
            }),
            telemetry,
          );
        }

        if (error instanceof RequestBodyParseError) {
          return applyTelemetryHeaders(
            ApiErrors.invalidRequestBody(error.message, {
              requestId,
              isAnonymous,
            }),
            telemetry,
          );
        }

        return applyTelemetryHeaders(
          ApiErrors.invalidRequestBody("Unable to read chat request payload", {
            requestId,
            isAnonymous,
          }),
          telemetry,
        );
      }
    }

    const guardResponse = await startSpan(
      {
        name: "chat.guards",
        op: "policy.evaluate",
        attributes: {
          requestId,
          agentId,
          sessionId,
        },
      },
      () => runGuards(chatGuards, { request: requestForHandlers, resources }),
    );

    if (guardResponse) {
      addBreadcrumb({
        category: "guard",
        level: "warning",
        message: "Chat guard denied request",
        data: {
          status: guardResponse.status,
          agentId,
          sessionId,
          requestId,
        },
      });
      captureMessage("chat.api.guard_denied", {
        level: "warning",
        extra: {
          agentId,
          sessionId,
          status: guardResponse.status,
          method: req.method,
        },
      });
      return applyTelemetryHeaders(guardResponse, telemetry);
    }

    // Release the parsed body from resources now that guards have completed.
    resources.request.body = null;

    const {
      memory,
      model,
      billing,
      request: requestState,
      auth: authState,
    } = resources;

    if (
      !memory ||
      !model.config ||
      model.streamingDelay === undefined ||
      !model.gatewayModelName ||
      !billing
    ) {
      const diagnostic = {
        hasMemory: Boolean(memory),
        hasModelConfig: Boolean(model.config),
        hasStreamingDelay: model.streamingDelay,
        hasGatewayName: model.gatewayModelName,
        hasBilling: Boolean(billing),
        requestId,
        agentId,
        sessionId,
        userId,
      };
      console.error(
        `[API Route] Missing resources after policy evaluation`,
        diagnostic,
      );
      captureMessage("Chat route missing resources after guard evaluation", {
        level: "error",
        contexts: { diagnostic },
      });
      return applyTelemetryHeaders(
        ApiErrors.internalError(new Error("Missing runtime dependencies"), {
          requestId,
          agentId,
          sessionId,
          userId,
          isAnonymous,
        }),
        telemetry,
      );
    }

    const gatewayModelName = model.gatewayModelName;
    const streamingDelay = model.streamingDelay;
    const modelConfig = model.config;

    const activeToolsForUser = getActiveToolsForUser(
      authState.isAnonymous,
      billing.plan,
      requestState.webSearchEnabled,
    );
    const systemPrompt = createSystemPromptForUser(
      authState.isAnonymous,
      requestState.webSearchEnabled,
    );

    console.log(
      `[Chat API] ${
        requestState.isResume
          ? "GET request for stream resume"
          : "POST request for new message"
      }`,
      {
        sessionId,
        agentId,
        userId,
        isAnonymous: authState.isAnonymous,
      },
    );

    console.log(
      `[Chat API] Using model: ${model.id} -> ${gatewayModelName} (delay: ${streamingDelay}ms, isResume: ${requestState.isResume})`,
    );

    console.log(
      `[Chat API] Active tools for ${
        authState.isAnonymous ? "anonymous" : "authenticated"
      } user:`,
      {
        activeTools: activeToolsForUser ?? "all tools",
        webSearchEnabled: requestState.webSearchEnabled,
        isAnonymous: authState.isAnonymous,
        userPlan: billing.plan,
        isResume: requestState.isResume,
      },
    );

    scope.setContext("chat.request", {
      agentId,
      sessionId,
      modelId: model.id,
      modelProvider: modelConfig.provider,
      isResume: requestState.isResume,
      webSearchEnabled: requestState.webSearchEnabled,
      streamingDelay,
      payloadBytes: resources.request.payloadBytes,
      conversationCharCount: resources.request.conversationCharCount,
    });

    const executeHandler = async (): Promise<Response> => {
      try {
        const response = await startSpan(
          {
            name: "chat.fetchRequestHandler",
            op: "ai.stream",
            attributes: {
              agentId,
              sessionId,
              modelId: model.id,
              isResume: requestState.isResume,
            },
          },
          () =>
            fetchRequestHandler({
              agent: createAgent<AppRuntimeContext, typeof c010Tools>({
                name: "c010",
                system: systemPrompt,
                tools: c010Tools,
                activeTools: activeToolsForUser,
                createRuntimeContext: ({
                  sessionId: _sessionId,
                  resourceId: _resourceId,
                }): AppRuntimeContext => ({
                  userId: authState.userId,
                  agentId,
                  messageId,
                  tools: {
                    createDocument: {
                      handlers: createDocumentHandlers,
                    },
                    webSearch: webSearchToolRuntime,
                  },
                }),
                model: wrapLanguageModel({
                  model: gateway(gatewayModelName),
                  middleware: BraintrustMiddleware({ debug: true }),
                }),
                experimental_telemetry: {
                  isEnabled: isOtelEnabled(),
                  functionId: requestState.isResume
                    ? "chat-resume"
                    : "chat-inference",
                  metadata: {
                    context: "production",
                    inferenceType: requestState.isResume
                      ? "chat-resume"
                      : "chat-conversation",
                    agentId,
                    agentName: "c010",
                    sessionId,
                    userId: authState.userId,
                    modelId: model.id,
                    modelProvider: modelConfig.provider,
                    isAnonymous: authState.isAnonymous,
                    webSearchEnabled: requestState.webSearchEnabled,
                    ...(requestState.isResume && { resumeOperation: true }),
                  },
                },
                ...(requestState.isResume
                  ? {}
                  : {
                      experimental_transform: smoothStream({
                        delayInMs: streamingDelay,
                        chunking: "line",
                      }),
                      stopWhen: stepCountIs(10),
                    }),
              }),
              sessionId,
              memory,
              req: requestForHandlers,
              body: parsedRequestBody,
              resourceId: authState.userId,
              context: {
                modelId: model.id,
                isAnonymous: authState.isAnonymous,
              },
              createRequestContext: (requestArg) => ({
                userAgent: requestArg.headers.get("user-agent") ?? undefined,
                ipAddress:
                  requestArg.headers.get("x-forwarded-for") ??
                  requestArg.headers.get("x-real-ip") ??
                  undefined,
              }),
              generateId: () => messageId,
              enableResume: true,
              onError(event) {
                const { error, systemContext, requestContext } = event;
                const logPrefix = requestState.isResume
                  ? "[API Error - Resume]"
                  : "[API Error]";

                const statusCode = (error as { statusCode?: number })
                  .statusCode;

                console.error(
                  `${logPrefix} Session: ${systemContext.sessionId}, User: ${systemContext.resourceId}, Code: ${statusCode}`,
                  {
                    error: error.message || JSON.stringify(error),
                    statusCode,
                    errorCode: statusCode,
                    stack: error.stack,
                    agentId,
                    sessionId: systemContext.sessionId,
                    userId: systemContext.resourceId,
                    method: req.method,
                    url: req.url,
                    requestContext,
                    isResume: requestState.isResume,
                  },
                );

                withScope((errorScope) => {
                  errorScope.setLevel("error");
                  errorScope.setTag("ai.agent_id", agentId);
                  errorScope.setTag("ai.session_id", systemContext.sessionId);
                  errorScope.setTag("ai.is_resume", `${requestState.isResume}`);
                  errorScope.setContext("request", {
                    method: req.method,
                    url: req.url,
                    requestContext,
                  });
                  captureException(error);
                });

                captureMessage("chat.api.handler_error", {
                  level: "error",
                  extra: {
                    agentId,
                    sessionId: systemContext.sessionId,
                    statusCode,
                    phase: requestState.isResume ? "resume" : "stream",
                  },
                });

                if (
                  !requestState.isResume &&
                  !authState.isAnonymous &&
                  billing.quotaReservation
                ) {
                  const reservationId = billing.quotaReservation.reservationId;
                  void startSpan(
                    {
                      name: "billing.releaseQuotaReservation",
                      op: "billing.release",
                      attributes: {
                        reservationId,
                        userId: authState.clerkUserId ?? "unknown",
                      },
                    },
                    async () => {
                      try {
                        await releaseQuotaReservation(reservationId);
                        addBreadcrumb({
                          category: "billing",
                          level: "info",
                          message: "quota_release_success",
                          data: {
                            reservationId,
                            userId: authState.clerkUserId,
                          },
                        });
                      } catch (releaseError) {
                        console.error(
                          `[Billing] Failed to release quota reservation for user ${authState.clerkUserId}:`,
                          releaseError,
                        );
                        captureException(releaseError, {
                          contexts: {
                            billing: {
                              reservationId,
                              stage: "release",
                              userId: authState.clerkUserId,
                            },
                          },
                        });
                        captureMessage("chat.billing.quota.release_failed", {
                          level: "error",
                          extra: {
                            reservationId,
                            userId: authState.clerkUserId,
                          },
                        });
                      }
                    },
                  );
                }

                if (statusCode === 500) {
                  console.error(
                    `[Memory Error] Failed for user ${systemContext.resourceId}`,
                    {
                      sessionId: systemContext.sessionId,
                      agentId,
                      errorType: statusCode,
                      errorMessage: error.message || JSON.stringify(error),
                      isResume: requestState.isResume,
                    },
                  );
                }
              },
            }),
        );

        addBreadcrumb({
          category: "chat",
          level: "info",
          message: "stream_success",
          data: {
            agentId,
            sessionId,
            modelId: model.id,
            isResume: requestState.isResume,
          },
        });

        if (
          !requestState.isResume &&
          !authState.isAnonymous &&
          billing.quotaReservation
        ) {
          const reservationId = billing.quotaReservation.reservationId;
          void startSpan(
            {
              name: "billing.confirmQuotaReservation",
              op: "billing.confirm",
              attributes: {
                reservationId,
                userId: authState.clerkUserId ?? "unknown",
              },
            },
            async () => {
              try {
                await confirmQuotaUsage(reservationId);
                addBreadcrumb({
                  category: "billing",
                  level: "info",
                  message: "quota_confirmed",
                  data: { reservationId, userId: authState.clerkUserId },
                });
              } catch (error) {
                console.error(
                  `[Billing] Failed to confirm quota reservation ${reservationId} for user ${authState.clerkUserId}:`,
                  error,
                );
                captureException(error, {
                  contexts: {
                    billing: {
                      reservationId,
                      stage: "confirm",
                      userId: authState.clerkUserId,
                    },
                  },
                });
                captureMessage("chat.billing.quota.confirm_failed", {
                  level: "error",
                  extra: { reservationId, userId: authState.clerkUserId },
                });
              }
            },
          );
        }

        return applyTelemetryHeaders(response, telemetry);
      } catch (error) {
        console.error(`[API Route Error] Unhandled error in route handler:`, {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          agentId,
          sessionId,
          userId: authState.userId,
          method: req.method,
          url: req.url,
        });

        captureException(error, {
          contexts: {
            route: {
              agentId,
              sessionId,
              requestId,
              isResume: requestState.isResume,
            },
          },
        });
        captureMessage("chat.api.stream.failure", {
          level: "error",
          extra: { agentId, sessionId, stage: "execute" },
        });

        return applyTelemetryHeaders(
          ApiErrors.internalError(
            error instanceof Error ? error : new Error(String(error)),
            {
              requestId,
              agentId,
              sessionId,
              userId: authState.userId,
              isAnonymous,
            },
          ),
          telemetry,
        );
      }
    };

    if (req.method === "POST") {
      try {
        return traced(executeHandler, {
          type: "function",
          name: `POST /api/v/${agentId}/${sessionId}`,
        });
      } catch (error) {
        console.warn(
          `[API Route] Traced wrapper failed, falling back to direct execution:`,
          error,
        );
        captureException(error, {
          contexts: {
            wrapper: { phase: "wrap", agentId, sessionId },
          },
        });
        return executeHandler();
      }
    }

    return executeHandler();
  });

const parameterizedRoute = "/api/v/[...v]";

const GET = wrapRouteHandlerWithSentry(handler, {
  method: "GET",
  parameterizedRoute,
});

const POST = wrapRouteHandlerWithSentry(handler, {
  method: "POST",
  parameterizedRoute,
});

export { GET, POST };
