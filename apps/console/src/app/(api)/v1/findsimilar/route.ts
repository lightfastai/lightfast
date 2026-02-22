/**
 * POST /v1/findsimilar - Find Similar Content
 *
 * Find content similar to a given document or observation.
 *
 * Authentication:
 * - Authorization: Bearer <api-key>
 * - X-Workspace-ID: <workspace-id>
 *
 * Request body:
 * - id: string (optional) - Content ID to find similar items for
 * - url: string (optional) - URL to find similar items for
 * - limit: number (1-50, default 10)
 * - threshold: number (0-1, default 0.5)
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";

import { log } from "@vendor/observability/log";
import { V1FindSimilarRequestSchema } from "@repo/console-types";

import { withDualAuth, createDualAuthErrorResponse, buildRateLimitHeaders } from "../lib/with-dual-auth";
import { findsimilarLogic } from "~/lib/v1/findsimilar";

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const requestId = randomUUID();

  log.info("v1/findsimilar request", { requestId });

  try {
    // 1. Authenticate via API key or session
    const authResult = await withDualAuth(request, requestId);
    if (!authResult.success) {
      return createDualAuthErrorResponse(authResult, requestId);
    }

    const { workspaceId, userId, authType } = authResult.auth;

    log.info("v1/findsimilar authenticated", {
      requestId,
      workspaceId,
      userId,
      authType,
      apiKeyId: authResult.auth.apiKeyId,
    });

    // 2. Parse and validate request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "INVALID_JSON", message: "Invalid JSON body", requestId },
        { status: 400 }
      );
    }

    const parseResult = V1FindSimilarRequestSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "VALIDATION_ERROR",
          message: "Invalid request",
          details: parseResult.error.flatten().fieldErrors,
          requestId,
        },
        { status: 400 }
      );
    }

    const { id, url, limit, threshold, sameSourceOnly, excludeIds, filters } = parseResult.data;

    // 3. Call extracted logic
    const response = await findsimilarLogic(
      { workspaceId, userId, authType, apiKeyId: authResult.auth.apiKeyId },
      {
        id,
        url,
        limit,
        threshold,
        sameSourceOnly,
        excludeIds,
        filters,
        requestId,
      }
    );

    log.info("v1/findsimilar complete", {
      requestId,
      sourceId: response.source.id,
      similarCount: response.similar.length,
      latency: Date.now() - startTime,
    });

    return NextResponse.json(response, {
      headers: buildRateLimitHeaders(authResult.auth),
    });
  } catch (error) {
    log.error("v1/findsimilar error", {
      requestId,
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      {
        error: "INTERNAL_ERROR",
        message: error instanceof Error ? error.message : "Failed to find similar content",
        requestId,
      },
      { status: 500 }
    );
  }
}

/**
 * GET handler - return method not allowed
 */
export function GET() {
  return NextResponse.json(
    { error: "METHOD_NOT_ALLOWED", message: "Use POST method" },
    { status: 405 }
  );
}
