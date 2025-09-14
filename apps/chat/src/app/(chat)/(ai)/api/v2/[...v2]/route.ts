import { Effect } from "effect";
import { traced } from "braintrust";
import { 
  RouteGuard,
  AuthGuard,
  ProfileGuard,
  PolicyRateLimitGuard,
  QuotaGuard,
  PolicyModelAccessGuard
} from "~/lib/policies/guards";
import { 
  MemoryAllocator,
  ProfileAgentAllocator
} from "~/lib/policies/allocators";
import { ChatExecutor } from "~/lib/policies/executors";
import { ApiErrors } from "~/lib/errors/api-error-builder";
import { 
  isTestErrorCommand,
  handleTestErrorCommand 
} from "~/lib/errors/test-commands";
import type { UserProfile, ToolPreferences, RouteContext } from "~/lib/policies/types";

/**
 * User Profile Policies - Define complete user experience configurations
 * CRITICAL: Each policy defines the COMPLETE user experience
 * This replaces ALL scattered conditional logic throughout the codebase
 */
const userProfilePolicies = {
  /**
   * Anonymous users - Preserve current behavior exactly
   */
  anonymous: (
    auth: RouteContext & { type: "anonymous"; userId: string },
    prefs: ToolPreferences
  ): UserProfile => ({
    // Tools - exactly match current getActiveToolsForUser() logic
    tools: [
      { type: "webSearch", enabled: prefs.webSearchEnabled },
      { type: "createDocument", enabled: false }, // Current behavior: always disabled
    ],
    
    // Model access - exactly match current logic
    modelAccess: {
      allowedModels: ["*"], // Use getModelsForUser(false) logic
      defaultModel: "openai/gpt-5-nano", // Current default from getDefaultModelForUser(false)
      canSwitchModels: true, // Current behavior allows switching
      premiumModels: false,
    },
    
    // Rate limiting - exactly match current Arcjet config
    rateLimit: {
      requests: 10,      // Current: max: 10
      window: "1d",      // Current: interval: 86400 (24 hours)  
      burst: 10,         // Current: capacity: 10
      cooldown: "1h",    // New: reasonable cooldown
    },
    
    // Quotas - new functionality, start conservative
    quotas: {
      tokensPerDay: 10000,
      tokensPerMonth: 100000,
      maxContextLength: 16384,  // Conservative limit
      maxResponseLength: 4096,  // Conservative limit
      concurrentRequests: 1,    // Conservative limit
    },
    
    // Permissions - new functionality, minimal permissions
    permissions: {
      canUploadFiles: false,
      canAccessPrivateModels: false,
      canCreateCustomTools: false,
      canShareConversations: false,
      canExportData: false,
      canUseApiKeys: false,
      maxFileSize: 0,
      allowedFileTypes: [],
    },
    
    // Features - start minimal
    features: {
      betaFeatures: false,
      experimentalTools: false,
      advancedSettings: false,
      customInstructions: false,
    },
  }),

  /**
   * Authenticated users - Preserve current behavior + enhancements
   */
  auth_user: (
    auth: RouteContext & { 
      type: "auth_user"; 
      authenticatedUserId: string; 
      userId: string;
    },
    prefs: ToolPreferences
  ): UserProfile => ({
    // Tools - exactly match current getActiveToolsForUser() logic
    tools: [
      { type: "webSearch", enabled: prefs.webSearchEnabled },
      { type: "createDocument", enabled: prefs.createDocumentEnabled ?? true }, // Current: always enabled
    ],
    
    // Model access - match current authenticated user behavior
    modelAccess: {
      allowedModels: ["*"], // Use getModelsForUser(true) logic
      defaultModel: "openai/gpt-5-nano", // Current default
      canSwitchModels: true,
      premiumModels: false,
    },
    
    // Rate limiting - generous limits for auth users (no Arcjet needed)
    rateLimit: {
      requests: 1000,
      window: "1h",
      burst: 50,
    },
    
    // Better quotas for auth users
    quotas: {
      tokensPerDay: 100000,
      tokensPerMonth: 2000000,
      maxContextLength: 128000,
      maxResponseLength: 32768,
      concurrentRequests: 5,
    },
    
    // Standard permissions for auth users
    permissions: {
      canUploadFiles: true,
      canAccessPrivateModels: false,
      canCreateCustomTools: false,
      canShareConversations: true,
      canExportData: true,
      canUseApiKeys: false,
      maxFileSize: 50, // 50MB
      allowedFileTypes: ["pdf", "txt", "md", "docx", "csv"],
    },
    
    // More features for auth users
    features: {
      betaFeatures: false,
      experimentalTools: false,
      advancedSettings: true,
      customInstructions: true,
    },
  }),
} as const;

// Policy-driven route handler
const program = (params: { params: Promise<{ v2: string[] }> }, request: Request) =>
  Effect.gen(function* (_) {
    const requestService = { request, method: request.method };
    
    // Core validation (preserve existing)
    const routeContext = yield* _(new RouteGuard().check({ params: params.params }));
    const authContext = yield* _(new AuthGuard().check(routeContext));
    
    // Policy-driven profile creation  
    const profileContext = yield* _(new ProfileGuard(requestService, userProfilePolicies).check(authContext));
    
    // Development-only: Check for test error commands
    if (request.method === "POST") {
      try {
        const body = yield* _(Effect.promise(() => request.clone().json()));
        const lastMessage = body.messages?.[body.messages.length - 1]?.parts?.[0]?.text ?? "";
        
        if (isTestErrorCommand(lastMessage)) {
          const testResponse = handleTestErrorCommand(lastMessage);
          if (testResponse) {
            return testResponse;
          }
        }
      } catch {
        // Ignore parsing errors for test command detection
      }
    }
    
    // Policy-enforced guards (replace scattered logic)  
    const rateLimitedContext = yield* _(new PolicyRateLimitGuard(requestService).check(profileContext));
    const quotaCheckedContext = yield* _(new QuotaGuard().check(rateLimitedContext));
    const modelAccessContext = yield* _(new PolicyModelAccessGuard(requestService).check(quotaCheckedContext));

    // Resource allocation (enhanced with profiles)
    const memoryContext = yield* _(new MemoryAllocator().allocate(modelAccessContext));
    const agentContext = yield* _(new ProfileAgentAllocator().allocate(memoryContext));

    // Add request to context for execution
    const executionContext = {
      ...agentContext,
      request,
    };

    // Execution (preserve existing)
    const response = yield* _(new ChatExecutor().execute(executionContext));
    
    return response;
  }).pipe(
    // Enhanced error handling
    Effect.catchTags({
      ValidationError: (error) => Effect.succeed(ApiErrors.invalidPath({ error: error.message })),
      AuthError: (error) => Effect.succeed(ApiErrors.authenticationUnavailable({ error: error.message })),
      RateLimitError: (error) => Effect.succeed(ApiErrors.rateLimitExceeded({ error: error.message })),
      QuotaError: (error) => Effect.succeed(ApiErrors.quotaExceeded({ error: error.message })),
      ModelAccessError: (error) => Effect.succeed(ApiErrors.modelAccessDenied(
        error.message.split(" ")[1] ?? "unknown", 
        { error: error.message }
      )),
      ProfileError: (error) => Effect.succeed(ApiErrors.internalError(error)),
      MemoryError: (error) => Effect.succeed(ApiErrors.memoryInitFailed({ error: error.message })),
      ExecutionError: (error) => Effect.succeed(ApiErrors.internalError(error)),
    })
  );

const handler = async (req: Request, routeParams: { params: Promise<{ v2: string[] }> }) => {
  const executeHandler = async (): Promise<Response> => {
    const result = await Effect.runPromise(program(routeParams, req));
    
    // Handle case where result might be a test response
    if (result instanceof Response) {
      return result;
    }
    
    // This shouldn't happen with proper typing, but just in case
    return new Response("Internal Error", { status: 500 });
  };

  // Extract route params for logging
  try {
    const { v2 } = await routeParams.params;
    const [agentId, sessionId] = v2;

    // Only wrap with traced for POST requests
    if (req.method === "POST") {
      try {
        return traced(executeHandler, {
          type: "function",
          name: `POST /api/v2/${agentId}/${sessionId}`,
        });
      } catch (error) {
        // If traced wrapper fails, fall back to direct execution
        console.warn(
          `[API Route] Traced wrapper failed, falling back to direct execution:`,
          error,
        );
        return executeHandler();
      }
    }

    // GET requests run without traced wrapper
    return executeHandler();
  } catch (error) {
    console.error("Failed to extract route parameters:", error);
    return ApiErrors.invalidPath({ error: "Invalid route parameters" });
  }
};

// Export for both GET and POST methods
export { handler as GET, handler as POST };