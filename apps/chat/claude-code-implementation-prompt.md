# Policy-First User Experience Architecture Implementation

## Project Context

I need you to implement a **comprehensive policy-first user experience architecture** for the chat application at `/apps/chat`. This architecture will replace scattered conditional logic with a unified policy system that defines complete user experience configurations.

## Current Architecture Analysis

### ✅ What's Already Implemented and Working:

#### Authentication System (`apps/chat/src/app/(chat)/(ai)/api/v/[...v]/route.ts`)
- Clerk `auth()` integration 
- Anonymous users: `anon_${sessionId}` userId format
- Authenticated users: real Clerk userId
- **Preserve exactly as-is**

#### Rate Limiting System (Arcjet Integration)
```typescript
// Current configuration in route.ts
const anonymousArcjet = arcjet({
  key: env.ARCJET_KEY,
  characteristics: ["ip.src"],
  rules: [
    shield({ mode: "LIVE" }),
    detectBot({ mode: env.NODE_ENV === "development" ? "DRY_RUN" : "LIVE", allow: [] }),
    slidingWindow({ mode: env.NODE_ENV === "development" ? "DRY_RUN" : "LIVE", max: 10, interval: 86400 }),
    tokenBucket({ mode: env.NODE_ENV === "development" ? "DRY_RUN" : "LIVE", refillRate: 1, interval: 8640, capacity: 10 }),
  ],
});
```
- **Preserve and extend**: Move this config into policy definitions

#### Tools System
- **Current tools**: `webSearchTool`, `createDocumentTool` from `~/ai/tools/`  
- **Current logic**: `getActiveToolsForUser()` function with auth-based activation
- **Preserve functionality**: Same tool availability, extend with policy-driven approach

#### Model System (`apps/chat/src/ai/providers/`)
- **Complete implementation**: `MODELS`, `ModelId`, `getModelConfig()`, `getModelStreamingDelay()`
- **Access control**: `getModelsForUser(isAuthenticated)`, model `accessLevel` validation
- **Default models**: `getDefaultModelForUser(isAuthenticated)`
- **Preserve exactly**: This system is well-designed

#### Memory System  
- **PlanetScaleMemory** for authenticated users
- **AnonymousRedisMemory** for anonymous users
- **Environment config**: `env.KV_REST_API_URL`, `env.KV_REST_API_TOKEN`
- **Preserve exactly**

#### Error System (`apps/chat/src/lib/errors/`)
- **Comprehensive**: `ChatErrorType`, `ApiErrorResponse`, `ApiErrors` utility
- **Status codes**: `ERROR_STATUS_CODES` mapping
- **Request tracking**: Request ID integration
- **Extend**: Add new error types for quotas, permissions, etc.

#### Agent System
- **createAgent** with full configuration
- **AppRuntimeContext** type
- **System prompt generation** based on capabilities
- **BraintrustMiddleware** integration
- **Preserve and enhance**

### 🔄 What Needs Policy-First Transformation:

#### Current Scattered Logic (Replace This):
```typescript
// Current imperative approach scattered across route.ts
const getActiveToolsForUser = (isAnonymous: boolean, webSearchEnabled: boolean) => {
  if (isAnonymous) {
    return webSearchEnabled ? ["webSearch"] : [];
  } else {
    const activeTools = ["createDocument"];
    if (webSearchEnabled) activeTools.push("webSearch");
    return activeTools;
  }
};

const createSystemPromptForUser = (isAnonymous: boolean) => {
  return isAnonymous 
    ? "You are a helpful AI assistant with web search capabilities..."
    : "You are a helpful AI assistant with document creation and web search capabilities...";
};

// Rate limiting only for anonymous
if (isAnonymous) {
  const decision = await anonymousArcjet.protect(req, { requested: 1 });
  // ... handle rate limiting
}

// Model validation  
if (isAnonymous && modelConfig.accessLevel === "authenticated") {
  return ApiErrors.modelAccessDenied(selectedModelId, { requestId, isAnonymous: true });
}
```

## Implementation Requirements

### 1. Core Policy System Architecture

Create the following files:

#### `apps/chat/src/lib/policies/types.ts`
```typescript
// Comprehensive user profile types
type RateLimitConfig = {
  requests: number;
  window: "1m" | "1h" | "1d" | "1w";
  burst?: number;
  cooldown?: "5m" | "1h";
};

type QuotaConfig = {
  tokensPerDay: number;
  tokensPerMonth: number;
  maxContextLength: number;
  maxResponseLength: number;
  concurrentRequests: number;
};

type PermissionConfig = {
  canUploadFiles: boolean;
  canAccessPrivateModels: boolean;
  canCreateCustomTools: boolean;
  canShareConversations: boolean;
  canExportData: boolean;
  canUseApiKeys: boolean;
  maxFileSize: number; // MB
  allowedFileTypes: string[];
};

type ModelAccessConfig = {
  allowedModels: string[];
  defaultModel: string;
  canSwitchModels: boolean;
  premiumModels: boolean;
};

type FeatureFlags = {
  betaFeatures: boolean;
  experimentalTools: boolean;
  advancedSettings: boolean;
  customInstructions: boolean;
};

// Tool discriminated union (preserve existing tools)
type Tool = 
  | { type: "webSearch"; enabled: boolean }
  | { type: "createDocument"; enabled: boolean };

type ToolContext = Tool[];

// Core user profile (focused on essential functionality)
type UserProfile = {
  tools: ToolContext;
  modelAccess: ModelAccessConfig;
  rateLimit: RateLimitConfig;
  quotas: QuotaConfig;
  permissions: PermissionConfig;
  features: FeatureFlags;
};

type ToolPreferences = {
  webSearchEnabled: boolean;
  createDocumentEnabled?: boolean;
};
```

#### `apps/chat/src/lib/policies/definitions.ts`  
```typescript
/**
 * CRITICAL: Each policy defines the COMPLETE user experience
 * This replaces ALL scattered conditional logic throughout the codebase
 */
export const userProfilePolicies = {
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
      allowedModels: [], // Use getModelsForUser(false) logic
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
      allowedModels: [], // Use getModelsForUser(true) logic
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

// Derived types from policies (single source of truth)
export type UserTier = keyof typeof userProfilePolicies;
export type AuthContext = Parameters<typeof userProfilePolicies[UserTier]>[0];
```

#### `apps/chat/src/lib/policies/utils.ts`
```typescript
export const ProfileUtils = {
  /**
   * Create complete user profile from auth context
   * REPLACES: getActiveToolsForUser, createSystemPromptForUser, rate limit checks
   */
  fromAuthContext: (auth: AuthContext, prefs: ToolPreferences): UserProfile => {
    const policy = userProfilePolicies[auth.type];
    return policy(auth as any, prefs);
  },

  // Tool utilities (replace scattered tool logic)
  getEnabledTools: (tools: ToolContext): Tool["type"][] => {
    return tools.filter(tool => tool.enabled).map(tool => tool.type);
  },

  isToolEnabled: (tools: ToolContext, toolType: Tool["type"]): boolean => {
    const tool = tools.find(t => t.type === toolType);
    return tool?.enabled ?? false;
  },

  // Permission checking
  hasPermission: (profile: UserProfile, permission: keyof PermissionConfig): boolean => {
    return profile.permissions[permission] as boolean;
  },

  // Model access checking  
  canUseModel: (profile: UserProfile, modelId: string): boolean => {
    return profile.modelAccess.allowedModels.includes("*") || 
           profile.modelAccess.allowedModels.includes(modelId);
  },

  // Quota checking
  exceedsQuota: (profile: UserProfile, tokensUsed: number, period: "day" | "month"): boolean => {
    const limit = period === "day" ? profile.quotas.tokensPerDay : profile.quotas.tokensPerMonth;
    return tokensUsed >= limit;
  },

  // System prompt generation (REPLACES createSystemPromptForUser)
  createSystemPrompt: (profile: UserProfile): string => {
    const hasWebSearch = ProfileUtils.isToolEnabled(profile.tools, "webSearch");
    const hasCreateDocument = ProfileUtils.isToolEnabled(profile.tools, "createDocument");
    
    if (hasCreateDocument && hasWebSearch) {
      return `You are a helpful AI assistant with document creation and web search capabilities.
      
IMPORTANT: When users request code generation, examples, substantial code snippets, or diagrams, ALWAYS use the createDocument tool. Do NOT include the code or diagram syntax in your text response - they should ONLY exist in the document artifact.

Use createDocument for:
- Code examples, functions, components  
- Working implementations and prototypes
- Scripts, configuration files
- Flowcharts and diagrams
- Any visual representation

CITATION USAGE:
When referencing external information, use numbered citations in your response and provide structured citation data.
Format: Use [1], [2], [3] etc. in your text, then end your complete response with citation data.`;
    } else if (hasWebSearch) {
      return `You are a helpful AI assistant with web search capabilities.

IMPORTANT: You do not have the ability to create code artifacts, diagrams, or documents. Focus on providing helpful text-based responses and using web search when additional information is needed.

CODE FORMATTING:
When providing code snippets in your responses, always use proper markdown code blocks with language specification.

CITATION USAGE:
When referencing external information, use numbered citations in your response and provide structured citation data.`;
    } else if (hasCreateDocument) {
      return `You are a helpful AI assistant with document creation capabilities.
      
IMPORTANT: When users request code generation, examples, substantial code snippets, or diagrams, ALWAYS use the createDocument tool.`;
    } else {
      return "You are a helpful AI assistant.";
    }
  },

  // Create Arcjet configuration from policy (simple, tightly-coupled)
  createArcjetConfig: (profile: UserProfile): any => {
    const { requests, window, burst } = profile.rateLimit;
    
    const windowMap = { "1m": 60, "1h": 3600, "1d": 86400, "1w": 604800 };
    const intervalSeconds = windowMap[window];
    
    const rules = [];
    
    // Add sliding window rule
    rules.push({
      type: "slidingWindow",
      mode: process.env.NODE_ENV === "development" ? "DRY_RUN" : "LIVE",
      max: requests,
      interval: intervalSeconds,
    });
    
    // Add token bucket if burst specified
    if (burst) {
      rules.push({
        type: "tokenBucket", 
        mode: process.env.NODE_ENV === "development" ? "DRY_RUN" : "LIVE",
        refillRate: Math.floor(requests / (intervalSeconds / 60)), // per minute
        interval: 60,
        capacity: burst,
      });
    }
    
    return {
      characteristics: ["ip.src"],
      rules,
    };
  },
};
```


### 2. Effect-Based Route Handler Implementation

#### `apps/chat/src/lib/policies/guards.ts`
```typescript
import { Effect, pipe } from "effect";
import { arcjet, shield, detectBot, slidingWindow, tokenBucket, checkDecision } from "@vendor/security";
import { env } from "~/env";
import { Guard, ResourceAllocator, ResourceExecutor, Resource } from "./effect-core";

// Enhanced context types
interface UserProfileContext extends RouteContext {
  type: UserTier;
  userId: string;
  profile: UserProfile;
  requestPrefs: ToolPreferences;
}

/**
 * ProfileGuard - Creates complete user profile (REPLACES scattered logic)
 */
export class ProfileGuard extends Guard<AuthContext, UserProfileContext, ProfileError> {
  check(resource: AuthContext) {
    return Effect.gen(function* (_) {
      const requestService = yield* _(RequestService);
      
      // Extract preferences from request (preserve current logic)
      const requestPrefs: ToolPreferences = requestService.method === "POST" 
        ? yield* _(extractPreferencesFromRequest(requestService.request))
        : { webSearchEnabled: false, createDocumentEnabled: false };
      
      // Create complete user profile using policies
      const profile = ProfileUtils.fromAuthContext(resource, requestPrefs);
      
      return {
        ...resource,
        profile,
        requestPrefs,
      };
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

  check(resource: UserProfileContext) {
    return Effect.gen(function* (_) {
      // Only apply Arcjet rate limiting for anonymous users (matches current behavior)
      if (resource.type !== "anonymous") {
        return resource;
      }
      
      const requestService = yield* _(RequestService);
      
      // Use internal Arcjet instance (preserve current behavior exactly)
      const decision = yield* _(
        Effect.tryPromise(() => 
          this.arcjetInstance.protect(requestService.request, { requested: 1 })
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

/**
 * ModelAccessGuard - Enhanced with policy-based validation
 */
export class PolicyModelAccessGuard extends Guard<UserProfileContext, UserProfileContext, ModelAccessError> {
  check(resource: UserProfileContext) {
    return Effect.gen(function* (_) {
      const requestService = yield* _(RequestService);
      const requestBody = yield* _(parseRequestBody(requestService.request));
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
```

#### `apps/chat/src/lib/policies/allocators.ts`  
```typescript
/**
 * ProfileAgentAllocator - Uses complete profile (REPLACES manual config)
 */
export class ProfileAgentAllocator extends ResourceAllocator<
  UserProfileContext & { memory: any },
  ResourceContext,
  ExecutionError
> {
  allocate(resource: UserProfileContext & { memory: any }) {
    return Effect.try({
      try: () => {
        // Tools come directly from profile (REPLACES getActiveToolsForUser)
        const enabledTools = ProfileUtils.getEnabledTools(resource.profile.tools);
        
        // System prompt from profile (REPLACES createSystemPromptForUser)  
        const systemPrompt = ProfileUtils.createSystemPrompt(resource.profile);
        
        // Model configuration from profile
        const modelId = resource.selectedModel || resource.profile.modelAccess.defaultModel;
        
        // Import existing tools (preserve current functionality)
        const c010Tools = {
          webSearch: webSearchTool,
          createDocument: createDocumentTool,
        };

        const agent = createAgent<AppRuntimeContext, typeof c010Tools>({
          name: "c010",
          system: systemPrompt,
          tools: c010Tools,
          activeTools: enabledTools as (keyof typeof c010Tools)[],
          createRuntimeContext: ({ sessionId, resourceId }): AppRuntimeContext => ({
            userId: resource.userId,
            agentId: resource.agentId,
            messageId: resource.messageId,
          }),
          model: wrapLanguageModel({
            model: gateway(getActualModelName(modelId as ModelId)),
            middleware: BraintrustMiddleware({ debug: true }),
          }),
          experimental_transform: smoothStream({
            delayInMs: getModelStreamingDelay(modelId as ModelId),
            chunking: "word",
          }),
          stopWhen: stepCountIs(10),
          experimental_telemetry: {
            isEnabled: isOtelEnabled(),
            metadata: {
              agentId: resource.agentId,
              agentName: "c010",
              sessionId: resource.sessionId,
              userId: resource.userId,
              modelId,
            },
          },
        });

        return {
          ...resource,
          agent,
          systemPrompt,
          messageId: resource.messageId || uuidv4(),
        };
      },
      catch: (error) => new ExecutionError(`Failed to create agent: ${error}`, error),
    });
  }
}
```

### 3. Migration Strategy

#### Phase 1: Side-by-Side Implementation (Preserve current route)
1. Keep current `route.ts` exactly as-is (working system)
2. Create new `route-policy.ts` with policy-first implementation
3. Add feature flag to switch between implementations
4. Run both in parallel for testing

#### Phase 2: Error Handling Extensions  
Add new error types to existing system:

```typescript
// Add to apps/chat/src/lib/errors/types.ts
export enum ChatErrorType {
  // ... existing errors
  QUOTA_EXCEEDED = "QUOTA_EXCEEDED",
  PERMISSION_DENIED = "PERMISSION_DENIED", 
  PROFILE_ERROR = "PROFILE_ERROR",
}

// Add to apps/chat/src/lib/errors/api-error-builder.ts
export const ApiErrors = {
  // ... existing errors
  quotaExceeded: (options?: ErrorBuilderOptions) =>
    createErrorResponse(ChatErrorType.QUOTA_EXCEEDED, "Quota exceeded", "..."),
  permissionDenied: (options?: ErrorBuilderOptions) =>
    createErrorResponse(ChatErrorType.PERMISSION_DENIED, "Permission denied", "..."),
};
```

#### Phase 3: Enhanced Route Handler
Create `apps/chat/src/app/(chat)/(ai)/api/v/[...v]/route-policy.ts`:

```typescript
import { createPolicyHandler } from "~/lib/policies/handlers";
import { userProfilePolicies } from "~/lib/policies/definitions";

const handler = createPolicyHandler(userProfilePolicies);

export { handler as GET, handler as POST };
```

#### Phase 4: Handler Implementation  
```typescript
// apps/chat/src/lib/policies/handlers.ts
export const createPolicyHandler = (policies: typeof userProfilePolicies) => {
  const program = (params: { params: Promise<{ v: string[] }> }) =>
    pipe(
      Resource.create({ params: params.params }),

      // Core validation (preserve existing)
      resource => resource.guard(new RouteGuard()),
      Effect.flatMap(resource => resource.guard(new AuthGuard())),
      
      // NEW: Policy-driven profile creation
      Effect.flatMap(resource => resource.guard(new ProfileGuard())),
      
      // Policy-enforced guards (replace scattered logic)  
      Effect.flatMap(resource => resource.guard(new PolicyRateLimitGuard())),
      Effect.flatMap(resource => resource.guard(new QuotaGuard())),
      Effect.flatMap(resource => resource.guard(new PolicyModelAccessGuard())),

      // Resource allocation (enhanced with profiles)
      Effect.flatMap(resource => resource.allocate(new MemoryAllocator())), // Preserve existing
      Effect.flatMap(resource => resource.allocate(new ProfileAgentAllocator())), // Enhanced

      // Execution (preserve existing)
      Effect.flatMap(resource => resource.execute(new ChatExecutor())),

      // Enhanced error handling
      Effect.catchTags({
        ValidationError: error => Effect.succeed(ApiErrors.invalidPath({ error: error.message })),
        AuthError: error => Effect.succeed(ApiErrors.authenticationUnavailable({ error: error.message })),
        RateLimitError: error => Effect.succeed(ApiErrors.rateLimitExceeded({ error: error.message })),
        QuotaError: error => Effect.succeed(ApiErrors.quotaExceeded({ error: error.message })),
        PermissionError: error => Effect.succeed(ApiErrors.permissionDenied({ error: error.message })),
        ProfileError: error => Effect.succeed(ApiErrors.internalError(error)),
        // ... preserve all existing error handling
      })
    );

  return async (req: Request, routeParams: { params: Promise<{ v: string[] }> }) => {
    const requestService = RequestService.of({ request: req, method: req.method });
    const tracingService = req.method === "POST" ? BraintrustTracingService : NoTracingService;
    
    const layer = Layer.mergeAll(
      Layer.succeed(RequestService, requestService),
      tracingService
    );

    return Effect.runPromise(program(routeParams).pipe(Effect.provide(layer)));
  };
```

## Success Criteria

### ✅ Functional Requirements  
1. **100% Backward Compatibility**: All current functionality preserved exactly
2. **Same Tool Behavior**: webSearch/createDocument work identically  
3. **Same Rate Limiting**: Anonymous users get same 10/day limit
4. **Same Model Access**: Auth restrictions preserved exactly
5. **Same Error Responses**: All existing error handling preserved

### ✅ Architecture Requirements
1. **Single Source of Truth**: All user experience defined in policies
2. **Type Safety**: Derived types prevent configuration mismatches  
3. **Extensibility**: New tiers added just by updating policies
4. **Composability**: Effect-based pipeline for guard chaining
5. **Testability**: Each policy and guard testable in isolation

### ✅ Enhancement Requirements  
1. **Quota System**: NEW token usage and concurrency limits
2. **Permission System**: NEW granular capability control
3. **Feature Flags**: NEW UI/UX configuration
4. **Security Policies**: NEW enhanced security configuration
5. **Tier Management**: NEW explicit user tier system

## File Structure
```
apps/chat/src/lib/policies/
├── types.ts              # Core policy types
├── definitions.ts        # Policy implementations  
├── utils.ts              # Policy utilities
├── guards.ts             # Effect-based guards
├── allocators.ts         # Resource allocators  
├── handlers.ts           # Route handler composition
└── effect-core.ts        # Effect abstractions

apps/chat/src/app/(chat)/(ai)/api/v/[...v]/
├── route.ts              # Current implementation (preserve)
└── route-policy.ts       # New policy-first implementation
```

## Implementation Priority
1. **Phase 1**: Core policy types and definitions (preserve current behavior)
2. **Phase 2**: Effect-based guards and allocators  
3. **Phase 3**: Policy-driven route handler
4. **Phase 4**: Error handling extensions  
5. **Phase 5**: New functionality (quotas, permissions, features)

**CRITICAL**: Start with preserving 100% of current functionality, then enhance incrementally. Every current behavior must work identically in the new system.