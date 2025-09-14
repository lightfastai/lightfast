import { Effect, pipe } from "effect";
import { arcjet, shield, detectBot, slidingWindow, tokenBucket, checkDecision } from "@vendor/security";
import { env } from "~/env";
import { 
  Guard, 
  RequestService, 
  ValidationError,
  AuthError,
  RateLimitError, 
  QuotaError, 
  ModelAccessError,
  ProfileError
} from "./effect-core";
import type { UserTier, AuthContext } from "./definitions";
import type { UserProfile, ToolPreferences, RouteContext } from "./types";
import { ProfileUtils } from "./utils";
import { auth } from "@clerk/nextjs/server";
import { uuidv4 } from "lightfast/v2/utils";

// Enhanced context types
export interface UserProfileContext extends RouteContext {
  type: UserTier;
  userId: string;
  profile: UserProfile;
  requestPrefs: ToolPreferences;
  authenticatedUserId?: string;
}

// Route parameter validation guard
export class RouteGuard extends Guard<{ params: Promise<{ v2: string[] }> }, RouteContext, ValidationError> {
  check(resource: { params: Promise<{ v2: string[] }> }) {
    return Effect.gen(function* (_) {
      const { v2 } = yield* _(Effect.promise(() => resource.params));
      const [agentId, sessionId] = v2;
      
      if (!agentId || !sessionId) {
        return yield* _(Effect.fail(new ValidationError("Missing agentId or sessionId in route parameters")));
      }
      
      if (agentId !== "c010") {
        return yield* _(Effect.fail(new ValidationError(`Invalid agentId: ${agentId}`)));
      }
      
      return {
        agentId,
        sessionId,
        messageId: uuidv4(),
        requestId: uuidv4(),
      };
    });
  }
}

// Authentication guard
export class AuthGuard extends Guard<RouteContext, AuthContext, AuthError> {
  check(resource: RouteContext) {
    return Effect.gen(function* (_) {
      let authenticatedUserId: string | null;
      
      try {
        const authResult = yield* _(Effect.promise(() => auth()));
        authenticatedUserId = authResult.userId;
      } catch (error) {
        console.error(`[API] Authentication check failed:`, error);
        return yield* _(Effect.fail(new AuthError("Authentication unavailable")));
      }
      
      const isAnonymous = !authenticatedUserId;
      
      if (isAnonymous) {
        return {
          ...resource,
          type: "anonymous" as const,
          userId: `anon_${resource.sessionId}`,
        };
      } else {
        return {
          ...resource,
          type: "auth_user" as const,
          authenticatedUserId: authenticatedUserId!,
          userId: authenticatedUserId!,
        };
      }
    });
  }
}

// Helper function to extract preferences from request
const extractPreferencesFromRequest = (request: Request): Effect.Effect<ToolPreferences, never> => {
  return Effect.gen(function* (_) {
    try {
      const body = yield* _(Effect.promise(() => request.clone().json()));
      return {
        webSearchEnabled: body.webSearchEnabled ?? false,
        createDocumentEnabled: body.createDocumentEnabled,
      };
    } catch {
      // If parsing fails, return defaults
      return {
        webSearchEnabled: false,
        createDocumentEnabled: false,
      };
    }
  });
};

/**
 * ProfileGuard - Creates complete user profile (REPLACES scattered logic)
 */
export class ProfileGuard extends Guard<AuthContext, UserProfileContext, ProfileError> {
  constructor(private requestService: RequestService) {
    super();
  }

  check(resource: AuthContext): Effect.Effect<UserProfileContext, ProfileError> {
    const self = this;
    return Effect.gen(function* (_) {
      // Extract preferences from request (preserve current logic)
      const requestPrefs: ToolPreferences = self.requestService.method === "POST" 
        ? yield* _(extractPreferencesFromRequest(self.requestService.request))
        : { webSearchEnabled: false, createDocumentEnabled: false };
      
      // Create complete user profile using policies
      const profile = ProfileUtils.fromAuthContext(resource, requestPrefs);
      
      return {
        ...resource,
        profile,
        requestPrefs,
      } as UserProfileContext;
    });
  }
}

/**
 * PolicyRateLimitGuard - Owns all rate limiting infrastructure (tightly-coupled)
 */
export class PolicyRateLimitGuard extends Guard<UserProfileContext, UserProfileContext, RateLimitError> {
  // Guard owns its infrastructure completely
  private arcjetInstance = arcjet({
    key: env.ARCJET_KEY,
    characteristics: ["ip.src"],
    rules: [
      shield({ mode: "LIVE" }),
      detectBot({ 
        mode: env.NODE_ENV === "development" ? "DRY_RUN" : "LIVE", 
        allow: [] 
      }),
      slidingWindow({
        mode: env.NODE_ENV === "development" ? "DRY_RUN" : "LIVE",
        max: 10,
        interval: 86400, // 24 hours - matches current config exactly
      }),
      tokenBucket({
        mode: env.NODE_ENV === "development" ? "DRY_RUN" : "LIVE",
        refillRate: 1,
        interval: 8640, // matches current config exactly
        capacity: 10,
      }),
    ],
  });

  constructor(private requestService: RequestService) {
    super();
  }

  check(resource: UserProfileContext): Effect.Effect<UserProfileContext, RateLimitError> {
    const self = this;
    return Effect.gen(function* (_) {
      // Only apply Arcjet rate limiting for anonymous users (matches current behavior)
      if (resource.type !== "anonymous") {
        return resource;
      }
      
      // Use internal Arcjet instance (preserve current behavior exactly)
      const decision = yield* _(
        Effect.promise(() => 
          self.arcjetInstance.protect(self.requestService.request, { requested: 1 })
        )
      );
      
      if (decision.isDenied()) {
        const check = checkDecision(decision);
        let errorMessage = `Rate limit exceeded: ${resource.profile.rateLimit.requests}/${resource.profile.rateLimit.window}`;
        
        if (check.isRateLimit) errorMessage = "Rate limit exceeded";
        else if (check.isBot) errorMessage = "Bot detected";  
        else if (check.isShield) errorMessage = "Request blocked for security reasons";
        
        return yield* _(Effect.fail(new RateLimitError(errorMessage)));
      }
      
      return resource;
    });
  }
}

// Mock functions for quota checking (would be implemented with real data stores)
const getDailyTokenUsage = (userId: string): Effect.Effect<number, never> => {
  return Effect.succeed(0); // Mock implementation
};

const getActiveRequests = (userId: string): Effect.Effect<number, never> => {
  return Effect.succeed(0); // Mock implementation
};

/**
 * QuotaGuard - NEW: Enforces policy-defined quotas
 */
export class QuotaGuard extends Guard<UserProfileContext, UserProfileContext, QuotaError> {
  check(resource: UserProfileContext) {
    return Effect.gen(function* (_) {
      // Check daily quota (NEW functionality)
      const dailyUsage = yield* _(getDailyTokenUsage(resource.userId));
      if (ProfileUtils.exceedsQuota(resource.profile, dailyUsage, "day")) {
        return yield* _(Effect.fail(
          new QuotaError(`Daily quota exceeded: ${dailyUsage}/${resource.profile.quotas.tokensPerDay}`)
        ));
      }
      
      // Check concurrent requests (NEW functionality)
      const activeRequests = yield* _(getActiveRequests(resource.userId));
      if (activeRequests >= resource.profile.quotas.concurrentRequests) {
        return yield* _(Effect.fail(
          new QuotaError(`Too many concurrent requests: ${activeRequests}/${resource.profile.quotas.concurrentRequests}`)
        ));
      }
      
      return resource;
    });
  }
}

// Helper functions for model access
const parseRequestBody = (request: Request): Effect.Effect<{ modelId?: string; messages?: any[] }, never> => {
  return Effect.gen(function* (_) {
    try {
      const body = yield* _(Effect.promise(() => request.clone().json()));
      return body;
    } catch {
      return {};
    }
  });
};

const estimateContextLength = (messages?: any[]): number => {
  if (!messages) return 0;
  return messages.reduce((total, msg) => {
    const text = msg.parts?.[0]?.text || msg.content || "";
    return total + text.length;
  }, 0);
};

/**
 * ModelAccessGuard - Enhanced with policy-based validation
 */
export class PolicyModelAccessGuard extends Guard<UserProfileContext, UserProfileContext & { selectedModel: string }, ModelAccessError> {
  constructor(private requestService: RequestService) {
    super();
  }

  check(resource: UserProfileContext): Effect.Effect<UserProfileContext & { selectedModel: string }, ModelAccessError> {
    const self = this;
    return Effect.gen(function* (_) {
      const requestBody = yield* _(parseRequestBody(self.requestService.request));
      const requestedModel = requestBody.modelId || resource.profile.modelAccess.defaultModel;
      
      // Use policy-based model access checking
      if (!ProfileUtils.canUseModel(resource.profile, requestedModel)) {
        return yield* _(Effect.fail(
          new ModelAccessError(`Model ${requestedModel} not available for this user type`)
        ));
      }
      
      // Validate context length against policy
      const contextLength = estimateContextLength(requestBody.messages);
      if (contextLength > resource.profile.quotas.maxContextLength) {
        return yield* _(Effect.fail(
          new ModelAccessError(`Context too long: ${contextLength}/${resource.profile.quotas.maxContextLength}`)
        ));
      }
      
      return { ...resource, selectedModel: requestedModel };
    });
  }
}