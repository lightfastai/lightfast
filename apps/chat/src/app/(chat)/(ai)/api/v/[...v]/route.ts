import { gateway } from "@ai-sdk/gateway";
import { createAgent } from "lightfast/agent";
import { fetchRequestHandler } from "lightfast/server/adapters/fetch";
import { smoothStream, stepCountIs, wrapLanguageModel } from "ai";
import { BraintrustMiddleware, initLogger, traced } from "braintrust";
import {
  getBraintrustConfig,
  isOtelEnabled,
} from "lightfast/v2/braintrust-env";
import { uuidv4 } from "lightfast/v2/utils";
import type { AppRuntimeContext } from "~/ai/lightfast-app-chat-ui-messages";
import { auth } from "@clerk/nextjs/server";
import { ApiErrors } from "~/lib/errors/api-error-builder";
import { releaseQuotaReservation } from "~/services/quota-reservation.service";
import { getDefaultModelForUser } from "~/ai/providers";
import { c010Tools } from "./_lib/tools";
import {
  getActiveToolsForUser,
  createSystemPromptForUser,
} from "./_lib/user-utils";
import { runGuards } from "./_lib/policy-engine";
import { chatGuards } from "./_lib/route-policies";
import type { ChatRouteResources } from "./_lib/route-policies";

// Initialize Braintrust logging
const braintrustConfig = getBraintrustConfig();
initLogger({
  apiKey: braintrustConfig.apiKey,
  projectName: braintrustConfig.projectName || "chat-app",
});

const handler = async (
  req: Request,
  { params }: { params: Promise<{ v?: string[] }> },
) => {
  const requestId = uuidv4();
  const { v } = await params;
  const [agentId, sessionId] = v ?? [];

  if (!agentId || !sessionId) {
    return ApiErrors.invalidPath({ requestId });
  }

  let authenticatedUserId: string | null = null;
  try {
    const authResult = await auth();
    authenticatedUserId = authResult.userId;
  } catch (error) {
    console.error(`[API] Authentication check failed:`, error);
    return ApiErrors.authenticationUnavailable({ requestId });
  }

  const isAnonymous = !authenticatedUserId;
  let userId: string;
  if (isAnonymous) {
    userId = `anon_${sessionId}`;
  } else {
    if (!authenticatedUserId) {
      return ApiErrors.authenticationUnavailable({ requestId });
    }
    userId = authenticatedUserId;
  }
  const messageId = uuidv4();
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

  const guardResponse = await runGuards(chatGuards, {
    request: req,
    resources,
  });

  if (guardResponse) {
    return guardResponse;
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
    console.error(`[API Route] Missing resources after policy evaluation`, {
      hasMemory: Boolean(memory),
      hasModelConfig: Boolean(model.config),
      hasStreamingDelay: model.streamingDelay,
      hasGatewayName: model.gatewayModelName,
      hasBilling: Boolean(billing),
      requestId,
      agentId,
      sessionId,
      userId,
    });

    return ApiErrors.internalError(
      new Error("Missing runtime dependencies"),
      { requestId, agentId, sessionId, userId, isAnonymous },
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
  const systemPrompt = createSystemPromptForUser(authState.isAnonymous);

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

  const executeHandler = async (): Promise<Response> => {
    try {
      const response = await fetchRequestHandler({
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
                  chunking: "word",
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

          console.error(
            `${logPrefix} Session: ${systemContext.sessionId}, User: ${systemContext.resourceId}, Code: ${error.statusCode}`,
            {
              error: error.message || JSON.stringify(error),
              statusCode: error.statusCode,
              errorCode: error.statusCode,
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

          if (
            !requestState.isResume &&
            !authState.isAnonymous &&
            billing.quotaReservation
          ) {
            const reservationId = billing.quotaReservation.reservationId;
            releaseQuotaReservation(reservationId)
              .then(() => {
                console.log(
                  `[Billing] Quota reservation released due to error for user ${authState.clerkUserId}:`,
                  {
                    reservationId,
                    errorCode: error.statusCode,
                  },
                );
              })
              .catch((releaseError) => {
                console.error(
                  `[Billing] Failed to release quota reservation for user ${authState.clerkUserId}:`,
                  releaseError,
                );
              });
          }

          if (error.statusCode === 500) {
            console.error(
              `[Memory Error] Failed for user ${systemContext.resourceId}`,
              {
                sessionId: systemContext.sessionId,
                agentId,
                errorType: error.statusCode,
                errorMessage: error.message || JSON.stringify(error),
                isResume: requestState.isResume,
              },
            );
          }
        },
      });

      return response;
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

      return ApiErrors.internalError(
        error instanceof Error ? error : new Error(String(error)),
        { requestId, agentId, sessionId, userId: authState.userId, isAnonymous },
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
      return executeHandler();
    }
  }

  return executeHandler();
};

export { handler as GET, handler as POST };
