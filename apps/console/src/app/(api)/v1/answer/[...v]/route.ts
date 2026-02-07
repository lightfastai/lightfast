import type { NextRequest } from "next/server";
import { gateway } from "@ai-sdk/gateway";
import { smoothStream, stepCountIs } from "ai";
import { createAgent } from "@lightfastai/ai-sdk/agent";
import { fetchRequestHandler } from "@lightfastai/ai-sdk/server/adapters/fetch";
import { randomUUID } from "node:crypto";
import { auth } from "@clerk/nextjs/server";
import { log } from "@vendor/observability/log";
import type {
  AnswerAppRuntimeContext,
  GraphToolOutput,
  RelatedToolOutput,
} from "@repo/console-ai-types";
import { workspaceSearchTool } from "@repo/console-ai/workspace-search";
import { workspaceContentsTool } from "@repo/console-ai/workspace-contents";
import { workspaceFindSimilarTool } from "@repo/console-ai/workspace-find-similar";
import { workspaceGraphTool } from "@repo/console-ai/workspace-graph";
import { workspaceRelatedTool } from "@repo/console-ai/workspace-related";
import {
  withDualAuth,
  createDualAuthErrorResponse,
} from "../../lib/with-dual-auth";
import { NotFoundError } from "@repo/console-types";
import {
  buildAnswerSystemPrompt,
  HARDCODED_WORKSPACE_CONTEXT,
} from "~/ai/prompts/system-prompt";
import { AnswerRedisMemory } from "~/ai/runtime/memory";
import {
  searchLogic,
  contentsLogic,
  findsimilarLogic,
  graphLogic,
  relatedLogic,
} from "~/lib/v1";

const MODEL_ID = "anthropic/claude-sonnet-4-5-20250929";

// Tool factories
const answerTools = {
  workspaceSearch: workspaceSearchTool(),
  workspaceContents: workspaceContentsTool(),
  workspaceFindSimilar: workspaceFindSimilarTool(),
  workspaceGraph: workspaceGraphTool(),
  workspaceRelated: workspaceRelatedTool(),
};

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
    const agent = createAgent<AnswerAppRuntimeContext, typeof answerTools>({
      name: agentId,
      system: systemPrompt,
      tools: answerTools,
      createRuntimeContext: () => ({
        workspaceId: authData.workspaceId,
        userId: authData.userId,
        authToken,
        tools: {
          workspaceSearch: {
            handler: async (input) =>
              searchLogic(
                {
                  workspaceId: authData.workspaceId,
                  userId: authData.userId,
                  authType: "session",
                },
                {
                  query: input.query,
                  mode: input.mode ?? "balanced",
                  limit: input.limit ?? 10,
                  offset: 0,
                  filters: input.filters,
                  includeContext: true,
                  includeHighlights: true,
                  requestId: randomUUID(),
                },
              ),
          },
          workspaceContents: {
            handler: async (input) =>
              contentsLogic(
                {
                  workspaceId: authData.workspaceId,
                  userId: authData.userId,
                  authType: "session",
                },
                {
                  ids: input.ids,
                  requestId: randomUUID(),
                },
              ),
          },
          workspaceFindSimilar: {
            handler: async (input) =>
              findsimilarLogic(
                {
                  workspaceId: authData.workspaceId,
                  userId: authData.userId,
                  authType: "session",
                },
                {
                  id: input.id,
                  limit: input.limit ?? 5,
                  threshold: input.threshold ?? 0.5,
                  requestId: randomUUID(),
                },
              ),
          },
          workspaceGraph: {
            handler: async (input) => {
              try {
                return await graphLogic(
                  {
                    workspaceId: authData.workspaceId,
                    userId: authData.userId,
                    authType: "session",
                  },
                  {
                    observationId: input.id,
                    depth: input.depth ?? 1,
                    requestId: randomUUID(),
                  },
                );
              } catch (error) {
                if (error instanceof NotFoundError) {
                  return {
                    error: "not_found",
                    message: `Observation ${input.id} was not found. It may have been deleted or not yet ingested. Try searching for the topic instead using workspaceSearch.`,
                    suggestedAction: "workspaceSearch",
                  } as unknown as GraphToolOutput;
                }
                throw error;
              }
            },
          },
          workspaceRelated: {
            handler: async (input) => {
              try {
                return await relatedLogic(
                  {
                    workspaceId: authData.workspaceId,
                    userId: authData.userId,
                    authType: "session",
                  },
                  {
                    observationId: input.id,
                    requestId: randomUUID(),
                  },
                );
              } catch (error) {
                if (error instanceof NotFoundError) {
                  return {
                    error: "not_found",
                    message: `Observation ${input.id} was not found. It may have been deleted or not yet ingested. Try searching for the topic instead using workspaceSearch.`,
                    suggestedAction: "workspaceSearch",
                  } as unknown as RelatedToolOutput;
                }
                throw error;
              }
            },
          },
        },
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
    const agent = createAgent<AnswerAppRuntimeContext, typeof answerTools>({
      name: agentId,
      system: systemPrompt,
      tools: answerTools,
      createRuntimeContext: () => ({
        workspaceId: authData.workspaceId,
        userId: authData.userId,
        authToken,
        tools: {
          workspaceSearch: {
            handler: async (input) =>
              searchLogic(
                {
                  workspaceId: authData.workspaceId,
                  userId: authData.userId,
                  authType: "session",
                },
                {
                  query: input.query,
                  mode: input.mode ?? "balanced",
                  limit: input.limit ?? 10,
                  offset: 0,
                  filters: input.filters,
                  includeContext: true,
                  includeHighlights: true,
                  requestId: randomUUID(),
                },
              ),
          },
          workspaceContents: {
            handler: async (input) =>
              contentsLogic(
                {
                  workspaceId: authData.workspaceId,
                  userId: authData.userId,
                  authType: "session",
                },
                {
                  ids: input.ids,
                  requestId: randomUUID(),
                },
              ),
          },
          workspaceFindSimilar: {
            handler: async (input) =>
              findsimilarLogic(
                {
                  workspaceId: authData.workspaceId,
                  userId: authData.userId,
                  authType: "session",
                },
                {
                  id: input.id,
                  limit: input.limit ?? 5,
                  threshold: input.threshold ?? 0.5,
                  requestId: randomUUID(),
                },
              ),
          },
          workspaceGraph: {
            handler: async (input) => {
              try {
                return await graphLogic(
                  {
                    workspaceId: authData.workspaceId,
                    userId: authData.userId,
                    authType: "session",
                  },
                  {
                    observationId: input.id,
                    depth: input.depth ?? 1,
                    requestId: randomUUID(),
                  },
                );
              } catch (error) {
                if (error instanceof NotFoundError) {
                  return {
                    error: "not_found",
                    message: `Observation ${input.id} was not found. It may have been deleted or not yet ingested. Try searching for the topic instead using workspaceSearch.`,
                    suggestedAction: "workspaceSearch",
                  } as unknown as GraphToolOutput;
                }
                throw error;
              }
            },
          },
          workspaceRelated: {
            handler: async (input) => {
              try {
                return await relatedLogic(
                  {
                    workspaceId: authData.workspaceId,
                    userId: authData.userId,
                    authType: "session",
                  },
                  {
                    observationId: input.id,
                    requestId: randomUUID(),
                  },
                );
              } catch (error) {
                if (error instanceof NotFoundError) {
                  return {
                    error: "not_found",
                    message: `Observation ${input.id} was not found. It may have been deleted or not yet ingested. Try searching for the topic instead using workspaceSearch.`,
                    suggestedAction: "workspaceSearch",
                  } as unknown as RelatedToolOutput;
                }
                throw error;
              }
            },
          },
        },
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
