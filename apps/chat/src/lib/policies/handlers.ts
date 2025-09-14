import { Effect } from "effect";
import { traced } from "braintrust";
import { RequestService } from "./effect-core";
import { 
  RouteGuard,
  AuthGuard,
  ProfileGuard,
  PolicyRateLimitGuard,
  QuotaGuard,
  PolicyModelAccessGuard
} from "./guards";
import { 
  MemoryAllocator,
  ProfileAgentAllocator
} from "./allocators";
import { ChatExecutor } from "./executors";
import { ApiErrors } from "~/lib/errors/api-error-builder";
import { 
  isTestErrorCommand,
  handleTestErrorCommand 
} from "~/lib/errors/test-commands";
import type { UserProfile, ToolPreferences } from "./types";

export const createPolicyHandler = (policies: Record<string, (auth: any, prefs: ToolPreferences) => UserProfile>) => {
  const program = (params: { params: Promise<{ v2: string[] }> }, request: Request) =>
    Effect.gen(function* (_) {
      const requestService = RequestService.of({ request, method: request.method });
      
      // Core validation (preserve existing)
      const routeContext = yield* _(new RouteGuard().check({ params: params.params }));
      const authContext = yield* _(new AuthGuard().check(routeContext));
      
      // NEW: Policy-driven profile creation  
      const profileContext = yield* _(new ProfileGuard(requestService, policies).check(authContext));
      
      // Development-only: Check for test error commands
      if (request.method === "POST") {
        try {
          const body = yield* _(Effect.promise(() => request.clone().json()));
          const lastMessage = body.messages?.[body.messages.length - 1]?.parts?.[0]?.text ?? "";
          
          if (isTestErrorCommand(lastMessage)) {
            const testResponse = handleTestErrorCommand(lastMessage);
            if (testResponse) {
              // Return the test response directly, bypassing further processing
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

  return async (req: Request, routeParams: { params: Promise<{ v2: string[] }> }) => {
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
};