import { Effect } from "effect";
import { fetchRequestHandler } from "lightfast/server/adapters/fetch";
import { 
  ResourceExecutor,
  ExecutionError
} from "./effect-core";

interface ChatExecutionContext {
  agent: any;
  memory: any;
  sessionId: string;
  userId: string;
  messageId: string;
  agentId: string;
  selectedModel?: string;
  type: "anonymous" | "auth_user";
}

/**
 * ChatExecutor - Handles the actual chat execution using fetchRequestHandler
 */
export class ChatExecutor extends ResourceExecutor<ChatExecutionContext & { request: Request }, Response, ExecutionError> {
  execute(resource: ChatExecutionContext & { request: Request }) {
    return Effect.gen(function* (_) {
      try {
        const response = yield* _(Effect.promise(() => 
          fetchRequestHandler({
            agent: resource.agent,
            sessionId: resource.sessionId,
            memory: resource.memory,
            req: resource.request,
            resourceId: resource.userId,
            context: {
              modelId: resource.selectedModel || "unknown",
              isAnonymous: resource.type === "anonymous",
            },
            createRequestContext: (req) => ({
              userAgent: req.headers.get("user-agent") ?? undefined,
              ipAddress:
                req.headers.get("x-forwarded-for") ??
                req.headers.get("x-real-ip") ??
                undefined,
            }),
            generateId: () => resource.messageId,
            enableResume: true,
            onError(event) {
              const { error, systemContext, requestContext } = event;
              console.error(
                `[API Error] Agent: ${resource.agentId}, Session: ${systemContext.sessionId}, User: ${systemContext.resourceId}, Code: ${error.errorCode}`,
                {
                  error: error.message,
                  statusCode: error.statusCode,
                  errorCode: error.errorCode,
                  stack: error.stack,
                  agentId: resource.agentId,
                  sessionId: systemContext.sessionId,
                  userId: systemContext.resourceId,
                  method: resource.request.method,
                  url: resource.request.url,
                  requestContext,
                },
              );

              // Handle specific error types
              if (error.errorCode === "MEMORY_ERROR") {
                console.error(
                  `[Memory Error] Failed for user ${systemContext.resourceId}`,
                  {
                    sessionId: systemContext.sessionId,
                    agentId: resource.agentId,
                    errorType: error.errorCode,
                    errorMessage: error.message,
                  },
                );
              }
            },
            onStreamStart(event) {
              const { streamId, agentName, messageCount, systemContext } = event;
              console.log(`[Stream Started] ${agentName}`, {
                streamId,
                sessionId: systemContext.sessionId,
                agentName,
                messageCount,
                userId: systemContext.resourceId,
              });
            },
            onStreamComplete(event) {
              const { streamId, agentName, systemContext } = event;
              console.log(`[Stream Completed] ${agentName}`, {
                streamId,
                sessionId: systemContext.sessionId,
                agentName,
                userId: systemContext.resourceId,
              });
            },
            onAgentStart(event) {
              const { agentName, messageCount, systemContext } = event;
              console.log(`[Agent Started] ${agentName}`, {
                agentName,
                sessionId: systemContext.sessionId,
                messageCount,
                userId: systemContext.resourceId,
              });
            },
            onAgentComplete(event) {
              const { agentName, systemContext } = event;
              console.log(`[Agent Completed] ${agentName}`, {
                agentName,
                sessionId: systemContext.sessionId,
                userId: systemContext.resourceId,
              });
            },
          })
        ));
        
        return response;
      } catch (error) {
        return yield* _(Effect.fail(new ExecutionError(
          `Chat execution failed: ${error instanceof Error ? error.message : String(error)}`,
          error
        )));
      }
    });
  }
}