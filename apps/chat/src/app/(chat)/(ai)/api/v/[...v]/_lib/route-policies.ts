import { allow, deny } from "./policy-engine";
import type { Guard } from "./policy-engine";
import { ApiErrors } from "~/lib/errors/api-error-builder";
import {
  MODELS,
  getModelConfig,
  getModelStreamingDelay,
} from "~/ai/providers";
import type { ModelId } from "~/ai/providers";
import {
  MAX_CONVERSATION_HISTORY_CHARS,
  MAX_USER_MESSAGE_CHARS,
} from "@repo/chat-ai-types";
import {
  arcjet,
  shield,
  detectBot,
  slidingWindow,
  tokenBucket,
  checkDecision,
} from "@vendor/security";
import { env } from "~/env";
import { createPlanetScaleMemory, AnonymousRedisMemory } from "~/ai/runtime/memory";
import { isTestErrorCommand, handleTestErrorCommand } from "~/lib/errors/test-commands";
import {
  reserveQuota,
  QuotaReservationError,
} from "~/services/quota-reservation.service";
import { UsageLimitExceededError } from "~/services/usage.service";
import {
  ClerkPlanKey,
  BILLING_LIMITS,
} from "~/lib/billing/types";
import { getUserPlan } from "./user-utils";

type PlanLimits = (typeof BILLING_LIMITS)[keyof typeof BILLING_LIMITS];

export interface ChatRouteMessagePart {
  text?: string;
  [key: string]: unknown;
}

export interface ChatRouteMessage {
  role: string;
  parts?: ChatRouteMessagePart[];
  [key: string]: unknown;
}

export interface ChatRouteRequestBody {
  modelId?: string;
  webSearchEnabled?: boolean;
  messages?: ChatRouteMessage[];
  attachments?: Array<{
    id: string;
    storagePath: string;
    size: number;
    contentType?: string | null;
    filename?: string | null;
    url?: string;
    metadata?: Record<string, unknown> | null;
  }>;
  [key: string]: unknown;
}

export interface ChatRouteResources extends Record<string, unknown> {
  requestId: string;
  agentId: string;
  sessionId: string;
  runtime: {
    messageId: string;
  };
  auth: {
    clerkUserId: string | null;
    userId: string;
    isAnonymous: boolean;
  };
  request: {
    method: string;
    isResume: boolean;
    webSearchEnabled: boolean;
    lastUserMessage: string;
    conversationCharCount: number;
    payloadBytes: number;
    body: ChatRouteRequestBody | null;
  };
  model: {
    id: ModelId;
    config?: ReturnType<typeof getModelConfig>;
    streamingDelay?: number;
    gatewayModelName?: string;
  };
  memory?: ReturnType<typeof createPlanetScaleMemory> | AnonymousRedisMemory;
  billing?: {
    plan: ClerkPlanKey;
    limits: PlanLimits;
    quotaReservation?: { reservationId: string } | null;
  };
}

export type ChatGuard = Guard<ChatRouteResources>;

// Create Arcjet instance for anonymous users only (shared)
const anonymousArcjet = arcjet({
  key: env.ARCJET_KEY,
  characteristics: ["ip.src"],
  rules: [
    shield({ mode: "LIVE" }),
    detectBot({
      mode: env.NODE_ENV === "development" ? "DRY_RUN" : "LIVE",
      allow: [],
    }),
    slidingWindow({
      mode: env.NODE_ENV === "development" ? "DRY_RUN" : "LIVE",
      max: 10,
      interval: 86400,
    }),
    tokenBucket({
      mode: env.NODE_ENV === "development" ? "DRY_RUN" : "LIVE",
      refillRate: 1,
      interval: 8640,
      capacity: 10,
    }),
  ],
});

export const ensureAgentGuard: ChatGuard = ({ resources }) => {
  if (resources.agentId !== "c010") {
    return deny(ApiErrors.agentNotFound(resources.agentId, { requestId: resources.requestId }));
  }

  return allow();
};

export const anonymousRateLimitGuard: ChatGuard = async ({ request, resources }) => {
  if (!resources.auth.isAnonymous) {
    return allow();
  }

  const decision = await anonymousArcjet.protect(request, { requested: 1 });

  if (!decision.isDenied()) {
    return allow();
  }

  const check = checkDecision(decision);
  console.warn(`[Security] Anonymous request denied:`, {
    sessionId: resources.sessionId,
    ip: decision.ip,
    reason: check,
  });

  if (check.isRateLimit) {
    return deny(ApiErrors.rateLimitExceeded({
      requestId: resources.requestId,
      isAnonymous: true,
    }));
  }

  if (check.isBot) {
    return deny(ApiErrors.botDetected({
      requestId: resources.requestId,
      isAnonymous: true,
    }));
  }

  return deny(ApiErrors.securityBlocked({
    requestId: resources.requestId,
    isAnonymous: true,
  }));
};

export const memoryGuard: ChatGuard = ({ resources }) => {
  try {
    const memory = resources.auth.isAnonymous
      ? new AnonymousRedisMemory({
          url: env.KV_REST_API_URL,
          token: env.KV_REST_API_TOKEN,
        })
      : createPlanetScaleMemory();

    resources.memory = memory;
    return allow();
  } catch (error) {
    console.error(`[API] Failed to create memory instance:`, error);
    return deny(
      ApiErrors.memoryInitFailed({
        requestId: resources.requestId,
        isAnonymous: resources.auth.isAnonymous,
      }),
    );
  }
};

export const parseRequestGuard: ChatGuard = ({ resources }) => {
  if (resources.request.isResume) {
    return allow();
  }

  const body = resources.request.body;
  if (!body) {
    return allow();
  }

  if (typeof body.modelId === "string") {
    resources.model.id = body.modelId as ModelId;
  }

  if (typeof body.webSearchEnabled === "boolean") {
    resources.request.webSearchEnabled = body.webSearchEnabled;
  }

  const messages = Array.isArray(body.messages) ? body.messages : [];
  if (messages.length === 0) {
    resources.request.conversationCharCount = 0;
    return allow();
  }

  let conversationCharCount = 0;
  let lastUserMessage: string | null = null;

  for (const message of messages) {
    if (!message || typeof message !== "object") {
      continue;
    }

    const parts = Array.isArray(message.parts) ? message.parts : [];

    for (const part of parts) {
      const text =
        part && typeof part === "object" && typeof part.text === "string"
          ? part.text
          : null;

      if (!text) {
        continue;
      }

      conversationCharCount += text.length;

      if (conversationCharCount > MAX_CONVERSATION_HISTORY_CHARS) {
        return deny(
          ApiErrors.payloadTooLarge({
            requestId: resources.requestId,
            isAnonymous: resources.auth.isAnonymous,
            category: "request",
            source: "guard",
            reason: "conversation_char_limit_exceeded",
            conversationCharCount,
            maxConversationChars: MAX_CONVERSATION_HISTORY_CHARS,
          }),
        );
      }
    }

    if (message.role === "user") {
      const candidate =
        parts.find(
          (part) =>
            part &&
            typeof part === "object" &&
            typeof part.text === "string" &&
            part.text.length > 0,
        )?.text ?? null;

      if (typeof candidate === "string") {
        lastUserMessage = candidate;
      }
    }
  }

  resources.request.conversationCharCount = conversationCharCount;

  if (typeof lastUserMessage === "string") {
    if (lastUserMessage.length > MAX_USER_MESSAGE_CHARS) {
      return deny(
        ApiErrors.payloadTooLarge({
          requestId: resources.requestId,
          isAnonymous: resources.auth.isAnonymous,
          category: "request",
          source: "guard",
          reason: "user_message_char_limit_exceeded",
          userMessageLength: lastUserMessage.length,
          maxUserMessageChars: MAX_USER_MESSAGE_CHARS,
        }),
      );
    }

    resources.request.lastUserMessage = lastUserMessage;
  }

  return allow();
};

export const testCommandGuard: ChatGuard = ({ resources }) => {
  if (resources.request.isResume) {
    return allow();
  }

  const lastMessage = resources.request.lastUserMessage;
  if (lastMessage && isTestErrorCommand(lastMessage)) {
    const response = handleTestErrorCommand(lastMessage);
    if (response) {
      return deny(response);
    }
  }

  return allow();
};

export const validateModelGuard: ChatGuard = ({ resources }) => {
  const selectedModelId = resources.model.id;
  if (!(selectedModelId in MODELS)) {
    console.warn(`[API] Invalid model requested: ${selectedModelId}`);
    return deny(
      ApiErrors.invalidModel(selectedModelId, {
        requestId: resources.requestId,
        isAnonymous: resources.auth.isAnonymous,
      }),
    );
  }

  const config = getModelConfig(selectedModelId);
  resources.model.config = config;
  resources.model.streamingDelay = getModelStreamingDelay(selectedModelId);
  resources.model.gatewayModelName = config.name;

  return allow();
};

export const enforceModelAccessGuard: ChatGuard = ({ resources }) => {
  if (
    resources.auth.isAnonymous &&
    resources.model.config?.accessLevel === "authenticated"
  ) {
    console.warn(
      `[Security] Anonymous user attempted to use authenticated model: ${resources.model.id}`,
    );
    return deny(
      ApiErrors.modelAccessDenied(resources.model.id, {
        requestId: resources.requestId,
        isAnonymous: true,
      }),
    );
  }

  return allow();
};

export const billingGuard: ChatGuard = async ({ resources }) => {
  if (resources.auth.isAnonymous) {
    resources.billing = {
      plan: ClerkPlanKey.FREE_TIER,
      limits: BILLING_LIMITS[ClerkPlanKey.FREE_TIER],
      quotaReservation: null,
    };
    return allow();
  }

  try {
    const userPlan = await getUserPlan();
    const limits = BILLING_LIMITS[userPlan];

    if (!resources.request.isResume) {
      if (!limits.allowedModels.includes(resources.model.id)) {
        console.warn(
          `[Billing] Model access denied for ${userPlan} user: ${resources.model.id}`,
          {
            allowedModels: limits.allowedModels,
          },
        );

        return deny(
          new Response(
            JSON.stringify({
              error: "Model not allowed",
              message: `Model ${resources.model.id} requires upgrade to Plus plan`,
              code: "MODEL_NOT_ALLOWED",
              details: {
                modelId: resources.model.id,
                userPlan,
                allowedModels: limits.allowedModels,
              },
            }),
            {
              status: 403,
              headers: {
                "Content-Type": "application/json",
              },
            },
          ),
        );
      }

      if (resources.request.webSearchEnabled && !limits.hasWebSearch) {
        console.warn(`[Billing] Web search access denied for ${userPlan} user`);
        return deny(
          new Response(
            JSON.stringify({
              error: "Feature not allowed",
              message: "Web search requires upgrade to Plus plan",
              code: "FEATURE_NOT_ALLOWED",
              details: { feature: "webSearch", userPlan },
            }),
            {
              status: 403,
              headers: {
                "Content-Type": "application/json",
              },
            },
          ),
        );
      }

      if (!resources.auth.clerkUserId) {
        throw new Error("User ID required for quota reservation");
      }

      const quotaReservation = await reserveQuota(
        resources.auth.clerkUserId,
        resources.model.id,
        resources.runtime.messageId,
      );

      resources.billing = {
        plan: userPlan,
        limits,
        quotaReservation,
      };
    } else {
      resources.billing = {
        plan: userPlan,
        limits,
        quotaReservation: null,
      };
    }

    console.log(
      `[Billing] User ${resources.auth.clerkUserId} (${resources.billing.plan}) passed billing checks for model: ${resources.model.id}`,
      {
        webSearchEnabled: resources.request.webSearchEnabled,
        modelId: resources.model.id,
        hasWebSearchAccess: limits.hasWebSearch,
        isResume: resources.request.isResume,
      },
    );

    return allow();
  } catch (error) {
    if (error instanceof UsageLimitExceededError || error instanceof QuotaReservationError) {
      console.warn(
        `[Billing] Usage limit exceeded for user ${resources.auth.clerkUserId}:`,
        error instanceof QuotaReservationError ? error.details : error.details,
      );

      return deny(
        new Response(
          JSON.stringify({
            error: "Usage limit exceeded",
            message: error.message,
            code: error.code,
            details: error.details,
          }),
          {
            status: 402,
            headers: {
              "Content-Type": "application/json",
            },
          },
        ),
      );
    }

    console.error(
      `[Billing] Unexpected error checking billing for user ${resources.auth.clerkUserId}:`,
      error,
    );

    return deny(
      new Response(
        JSON.stringify({
          error: "Internal server error",
          message: "Failed to check billing access",
          code: "INTERNAL_ERROR",
        }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
          },
        },
      ),
    );
  }
};

export const chatGuards: ChatGuard[] = [
  ensureAgentGuard,
  anonymousRateLimitGuard,
  memoryGuard,
  parseRequestGuard,
  testCommandGuard,
  validateModelGuard,
  enforceModelAccessGuard,
  billingGuard,
];
