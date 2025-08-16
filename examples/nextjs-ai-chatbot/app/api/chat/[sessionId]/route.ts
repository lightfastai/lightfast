/**
 * Chat API Route using fetchRequestHandler from @lightfastai/core
 * 
 * This implementation uses the actual fetchRequestHandler pattern from production.
 */

import { gateway } from "@ai-sdk/gateway";
import { createAgent } from "@lightfastai/core/agent";
import { fetchRequestHandler } from "@lightfastai/core/agent/handlers";
import { RedisMemory } from "@lightfastai/core/memory";
import { v4 as uuidv4 } from "uuid";

// Define the runtime context type
type AppRuntimeContext = {
  userId: string;
  sessionId: string;
};

// Define the system context type
type SystemContext = {
  sessionId: string;
  resourceId: string;
};

// Empty tools object (can be extended with actual tools)
const chatTools = {} as const;

// Fixed model - using gpt-5-nano
const MODEL = "openai/gpt-5-nano";

// Handler function using fetchRequestHandler
const handler = async (
  req: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) => {
  // Await the params
  const { sessionId } = await params;

  // Generate a request ID for tracking
  const requestId = uuidv4();

  // Validate params
  if (!sessionId) {
    return new Response(
      JSON.stringify({
        error: "Invalid path",
        message: "sessionId is required",
        requestId,
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  // Create a simple userId for this example
  const userId = `user_${sessionId}`;

  try {
    // Create memory instance
    // Requires UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN env vars
    const memory = new RedisMemory({
      url: process.env.UPSTASH_REDIS_REST_URL || "",
      token: process.env.UPSTASH_REDIS_REST_TOKEN || "",
    });

    // Use fetchRequestHandler with inline agent definition
    const response = await fetchRequestHandler({
      agent: createAgent({
        name: "assistant",
        system: `You are a helpful AI assistant powered by Lightfast Core infrastructure.
        
This implementation uses the actual fetchRequestHandler from @lightfastai/core/agent/handlers.

Key features:
- Agent orchestration with createAgent
- Memory persistence with Redis
- Tool execution capabilities (extendable)
- Streaming responses with proper error handling
- Request tracking and telemetry

Be concise, helpful, and friendly in your responses.`,
        tools: chatTools,
        createRuntimeContext: ({
          sessionId: _sessionId,
          resourceId: _resourceId,
        }: SystemContext): AppRuntimeContext => ({
          userId,
          sessionId,
        }),
        model: gateway(MODEL),
        onChunk: ({ chunk }: { chunk: { type?: string } }) => {
          if ("type" in chunk && chunk.type === "tool-call") {
            console.log("Tool called:", chunk);
          }
        },
        onFinish: (result: {
          finishReason: string;
          usage?: {
            promptTokens?: number;
            completionTokens?: number;
            totalTokens?: number;
          };
        }) => {
          console.log("Chat finished:", {
            sessionId,
            userId,
            finishReason: result.finishReason,
            usage: result.usage,
          });
        },
      }),
      sessionId,
      memory,
      req,
      resourceId: userId,
      context: {
        modelId: MODEL,
      },
      createRequestContext: (req: Request) => ({
        userAgent: req.headers.get("user-agent") ?? undefined,
        ipAddress:
          req.headers.get("x-forwarded-for") ??
          req.headers.get("x-real-ip") ??
          undefined,
      }),
      generateId: uuidv4,
      enableResume: true,
      onError({ error }: { error: Error }) {
        console.error(
          `[API Error] Session: ${sessionId}, User: ${userId}`,
          {
            error: error.message,
            stack: error.stack,
            sessionId,
            userId,
            method: req.method,
            url: req.url,
          },
        );
      },
    });

    return response;
  } catch (error) {
    console.error(`[API Route Error] Unhandled error in route handler:`, {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      sessionId,
      userId,
      method: req.method,
      url: req.url,
    });

    // Return a generic 500 error
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        message: "An unexpected error occurred",
        requestId,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
};

// Export the handler for both GET and POST
export { handler as GET, handler as POST };

// Note: Cannot use edge runtime with RedisMemory due to Node.js dependencies
// Remove the following line if you encounter edge runtime issues:
// export const runtime = "edge";