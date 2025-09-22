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

import type { ChatRouteResources } from "./_lib/route-policies";
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
      },
      model: {
        id: isResume
          ? getDefaultModelForUser(!isAnonymous)
          : "google/gemini-2.5-flash",
      },
    };

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
      () => runGuards(chatGuards, { request: req.clone(), resources }),
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
    const codeInterpreterEnabled =
      !authState.isAnonymous &&
      Boolean(activeToolsForUser?.includes("codeInterpreter"));
    const systemPrompt = createSystemPromptForUser(
      authState.isAnonymous,
      requestState.webSearchEnabled,
      codeInterpreterEnabled,
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
        codeInterpreterEnabled,
        isAnonymous: authState.isAnonymous,
        userPlan: billing.plan,
        isResume: requestState.isResume,
      },
    );

    const agentModel = wrapLanguageModel({
      model: gateway(gatewayModelName),
      middleware: BraintrustMiddleware({ debug: true }),
    });

    scope.setContext("chat.request", {
      agentId,
      sessionId,
      modelId: model.id,
      modelProvider: modelConfig.provider,
      isResume: requestState.isResume,
      webSearchEnabled: requestState.webSearchEnabled,
      streamingDelay,
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
                    codeInterpreter: {
                      model: agentModel,
                      defaultRuntime: "python3.13",
                      timeoutMs: 300000,
                    },
                  },
                }),
                model: agentModel,
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
              req,
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
