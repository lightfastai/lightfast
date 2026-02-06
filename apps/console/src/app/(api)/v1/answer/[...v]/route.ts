import type { NextRequest } from "next/server";
import { gateway } from "@ai-sdk/gateway";
import { smoothStream, stepCountIs } from "ai";
import { createAgent } from "@lightfastai/ai-sdk/agent";
import { fetchRequestHandler } from "@lightfastai/ai-sdk/server/adapters/fetch";
import { randomUUID } from "node:crypto";
import { auth } from "@clerk/nextjs/server";
import { log } from "@vendor/observability/log";
import {
  withDualAuth,
  createDualAuthErrorResponse,
} from "../../lib/with-dual-auth";
import { answerTools } from "~/ai/tools";
import {
  buildAnswerSystemPrompt,
  HARDCODED_WORKSPACE_CONTEXT,
} from "~/ai/prompts/system-prompt";
import { AnswerRedisMemory } from "~/ai/runtime/memory";
import type { AnswerRuntimeContext } from "~/ai/types";

const MODEL_ID = "anthropic/claude-sonnet-4-20250514";

export async function POST(request: NextRequest) {
  const requestId = randomUUID();

  log.info("Answer API request", { requestId });

  try {
    // 1. Authenticate via withDualAuth (same as search APIs)
    const authResult = await withDualAuth(request, requestId);

    if (!authResult.success) {
      return createDualAuthErrorResponse(authResult, requestId);
    }

    const authData = authResult.auth;

    // 2. Get Clerk auth token for internal API calls
    const clerkAuth = await auth();
    const token = await clerkAuth.getToken();
    const authToken = token ?? undefined;

    console.log("authToken", authToken);

    // 3. Parse request body
    let body: { messages?: { role: string; content: string }[] };
    try {
      body = (await request.json()) as typeof body;
    } catch (err) {
      log.warn("Failed to parse request body", {
        requestId,
        error: String(err),
      });
      return Response.json({ error: "Invalid request body" }, { status: 400 });
    }

    // 4. Build system prompt with hardcoded workspace context
    const systemPrompt = buildAnswerSystemPrompt(HARDCODED_WORKSPACE_CONTEXT);

    // 5. Extract sessionId and resourceId from URL
    const url = new URL(request.url);
    const pathSegments = url.pathname.split("/");
    // /v1/answer/answer-v1/session-id
    const agentId = pathSegments[3] ?? "answer-v1";
    const sessionId = pathSegments[4] ?? randomUUID();

    // 6. Create agent
    const agent = createAgent<AnswerRuntimeContext, typeof answerTools>({
      name: agentId,
      system: systemPrompt,
      tools: answerTools,
      createRuntimeContext: () => ({
        workspaceId: authData.workspaceId,
        userId: authData.userId,
        authToken,
      }),
      model: gateway(MODEL_ID),
      experimental_transform: smoothStream({ delayInMs: 10 }),
      stopWhen: stepCountIs(8),
    });

    // 6. Create ephemeral memory
    const memory = new AnswerRedisMemory();

    // 7. Delegate to fetchRequestHandler
    return fetchRequestHandler({
      agent,
      sessionId,
      memory,
      req: request,
      resourceId: authData.userId,
      body,
      generateId: () => randomUUID(),
      onError(event) {
        const { error, systemContext } = event;
        log.error("Answer API error", {
          error: error.message || JSON.stringify(error),
          sessionId: systemContext.sessionId,
          userId: systemContext.resourceId,
          requestId,
        });
      },
    });
  } catch (err) {
    log.error("Answer API handler error", {
      error: err instanceof Error ? err.message : String(err),
      requestId,
    });
    return Response.json(
      {
        error: "Internal server error",
      },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  const requestId = randomUUID();

  log.info("Answer API GET (resume) request", { requestId });

  try {
    // Same auth
    const authResult = await withDualAuth(request, requestId);

    if (!authResult.success) {
      return createDualAuthErrorResponse(authResult, requestId);
    }

    const authData = authResult.auth;

    // Get Clerk auth token for internal API calls
    const clerkAuth = await auth();
    const token = await clerkAuth.getToken();
    const authToken = token ?? undefined;

    // System prompt
    const systemPrompt = buildAnswerSystemPrompt(HARDCODED_WORKSPACE_CONTEXT);

    // Extract sessionId and resourceId from URL
    const url = new URL(request.url);
    const pathSegments = url.pathname.split("/");
    // /v1/answer/answer-v1/session-id
    const agentId = pathSegments[3] ?? "answer-v1";
    const sessionId = pathSegments[4] ?? randomUUID();

    // Create agent
    const agent = createAgent<AnswerRuntimeContext, typeof answerTools>({
      name: agentId,
      system: systemPrompt,
      tools: answerTools,
      createRuntimeContext: () => ({
        workspaceId: authData.workspaceId,
        userId: authData.userId,
        authToken,
      }),
      model: gateway(MODEL_ID),
    });

    // Create memory
    const memory = new AnswerRedisMemory();

    // Delegate to fetchRequestHandler for resume
    return fetchRequestHandler({
      agent,
      sessionId,
      memory,
      req: request,
      resourceId: authData.userId,
      generateId: () => randomUUID(),
      enableResume: true,
      onError(event) {
        const { error, systemContext } = event;
        log.error("Answer API resume error", {
          error: error.message || JSON.stringify(error),
          sessionId: systemContext.sessionId,
          userId: systemContext.resourceId,
          requestId,
        });
      },
    });
  } catch (err) {
    log.error("Answer API GET handler error", {
      error: err instanceof Error ? err.message : String(err),
      requestId,
    });
    return Response.json(
      {
        error: "Internal server error",
      },
      { status: 500 },
    );
  }
}
