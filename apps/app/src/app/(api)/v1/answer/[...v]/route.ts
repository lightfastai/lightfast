import { randomUUID } from "node:crypto";
import { gateway } from "@ai-sdk/gateway";
import { createAgent } from "@lightfastai/ai-sdk/agent";
import { fetchRequestHandler } from "@lightfastai/ai-sdk/server/adapters/fetch";
import { orgContentsTool } from "@repo/app-ai/org-contents";
import { orgFindSimilarTool } from "@repo/app-ai/org-find-similar";
import { orgRelatedTool } from "@repo/app-ai/org-related";
import { orgSearchTool } from "@repo/app-ai/org-search";
import type { AnswerAppRuntimeContext } from "@repo/app-ai-types";
import { auth } from "@vendor/clerk/server";
import { log } from "@vendor/observability/log/next";
import { smoothStream, stepCountIs } from "ai";
import type { NextRequest } from "next/server";
import {
  buildAnswerSystemPrompt,
  HARDCODED_ORG_CONTEXT,
} from "~/ai/prompts/system-prompt";
import { AnswerRedisMemory } from "~/ai/runtime/memory";
import { contentsLogic } from "~/lib/contents";
import { findSimilarLogic } from "~/lib/findsimilar";
import { relatedLogic } from "~/lib/related";
import { searchLogic } from "~/lib/search";
import {
  createDualAuthErrorResponse,
  withDualAuth,
} from "../../../lib/with-dual-auth";

const MODEL_ID = "anthropic/claude-sonnet-4.6";

const answerTools = {
  orgSearch: orgSearchTool(),
  orgContents: orgContentsTool(),
  orgFindSimilar: orgFindSimilarTool(),
  orgRelated: orgRelatedTool(),
};

export async function POST(request: NextRequest) {
  const requestId = randomUUID();

  log.info("Answer API request", { requestId });

  try {
    const authResult = await withDualAuth(request, requestId);

    if (!authResult.success) {
      return createDualAuthErrorResponse(authResult, requestId);
    }

    const authData = authResult.auth;

    const clerkAuth = await auth();
    const token = await clerkAuth.getToken();
    const authToken = token ?? undefined;

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

    const systemPrompt = buildAnswerSystemPrompt({
      org: HARDCODED_ORG_CONTEXT,
      modelId: MODEL_ID,
    });

    const url = new URL(request.url);
    const pathSegments = url.pathname.split("/");
    const agentId = pathSegments[3] ?? "answer-v1";
    const sessionId = pathSegments[4] ?? randomUUID();

    const authContext = {
      clerkOrgId: authData.clerkOrgId,
      userId: authData.userId,
      authType: authData.authType,
      apiKeyId: authData.apiKeyId,
    } as const;

    const agent = createAgent<AnswerAppRuntimeContext, typeof answerTools>({
      name: agentId,
      system: systemPrompt,
      tools: answerTools,
      createRuntimeContext: () => ({
        clerkOrgId: authData.clerkOrgId,
        userId: authData.userId,
        authToken,
        tools: {
          orgSearch: {
            handler: (input) => searchLogic(authContext, input, randomUUID()),
          },
          orgContents: {
            handler: (input) => contentsLogic(authContext, input, randomUUID()),
          },
          orgFindSimilar: {
            handler: (input) =>
              findSimilarLogic(authContext, input, randomUUID()),
          },
          orgRelated: {
            handler: (input) => relatedLogic(authContext, input, randomUUID()),
          },
        },
      }),
      model: gateway(MODEL_ID),
      experimental_transform: smoothStream({ delayInMs: 10 }),
      stopWhen: stepCountIs(8),
    });

    const memory = new AnswerRedisMemory();

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
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const requestId = randomUUID();

  log.info("Answer API GET (resume) request", { requestId });

  try {
    const authResult = await withDualAuth(request, requestId);

    if (!authResult.success) {
      return createDualAuthErrorResponse(authResult, requestId);
    }

    const authData = authResult.auth;

    const clerkAuth = await auth();
    const token = await clerkAuth.getToken();
    const authToken = token ?? undefined;

    const systemPrompt = buildAnswerSystemPrompt({
      org: HARDCODED_ORG_CONTEXT,
      modelId: MODEL_ID,
    });

    const url = new URL(request.url);
    const pathSegments = url.pathname.split("/");
    const agentId = pathSegments[3] ?? "answer-v1";
    const sessionId = pathSegments[4] ?? randomUUID();

    const authContext = {
      clerkOrgId: authData.clerkOrgId,
      userId: authData.userId,
      authType: authData.authType,
      apiKeyId: authData.apiKeyId,
    } as const;

    const agent = createAgent<AnswerAppRuntimeContext, typeof answerTools>({
      name: agentId,
      system: systemPrompt,
      tools: answerTools,
      createRuntimeContext: () => ({
        clerkOrgId: authData.clerkOrgId,
        userId: authData.userId,
        authToken,
        tools: {
          orgSearch: {
            handler: (input) => searchLogic(authContext, input, randomUUID()),
          },
          orgContents: {
            handler: (input) => contentsLogic(authContext, input, randomUUID()),
          },
          orgFindSimilar: {
            handler: (input) =>
              findSimilarLogic(authContext, input, randomUUID()),
          },
          orgRelated: {
            handler: (input) => relatedLogic(authContext, input, randomUUID()),
          },
        },
      }),
      model: gateway(MODEL_ID),
    });

    const memory = new AnswerRedisMemory();

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
      { status: 500 }
    );
  }
}
