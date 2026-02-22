/**
 * POST /v1/search - Public Search API
 *
 * Semantic search through a workspace's neural memory using API key authentication.
 * Supports mode-based reranking for quality/latency tradeoffs.
 *
 * Authentication:
 * - Authorization: Bearer <api-key>
 * - X-Workspace-ID: <workspace-id>
 *
 * Request body:
 * - query: string (required) - Search query
 * - limit: number (1-100, default 10) - Results per page
 * - offset: number (default 0) - Pagination offset
 * - mode: "fast" | "balanced" | "thorough" (default: balanced)
 * - filters: object (optional) - Source/type/date filters
 * - includeContext: boolean (default true) - Include cluster/actor context
 * - includeHighlights: boolean (default true) - Include highlighted snippets
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";

import { log } from "@vendor/observability/log";
import { V1SearchRequestSchema } from "@repo/console-types";

import {
  withDualAuth,
  createDualAuthErrorResponse,
  buildRateLimitHeaders,
} from "../lib/with-dual-auth";
import { searchLogic } from "~/lib/v1/search";

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const requestId = randomUUID();

  log.info("v1/search request", { requestId });

  try {
    // 1. Authenticate via API key or session
    const authStart = Date.now();
    const authResult = await withDualAuth(request, requestId);
    const authLatency = Date.now() - authStart;

    if (!authResult.success) {
      return createDualAuthErrorResponse(authResult, requestId);
    }

    const { workspaceId, userId, authType } = authResult.auth;

    log.info("v1/search authenticated", {
      requestId,
      workspaceId,
      userId,
      authType,
      apiKeyId: authResult.auth.apiKeyId,
      authLatency,
    });

    // 2. Parse and validate request body
    const parseStart = Date.now();
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "INVALID_JSON", message: "Invalid JSON body", requestId },
        { status: 400 },
      );
    }

    const parseResult = V1SearchRequestSchema.safeParse(body);
    const parseLatency = Date.now() - parseStart;

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "VALIDATION_ERROR",
          message: "Invalid request",
          details: parseResult.error.flatten().fieldErrors,
          requestId,
        },
        { status: 400 },
      );
    }

    const {
      query,
      limit,
      offset,
      mode,
      filters,
      includeContext,
      includeHighlights,
    } = parseResult.data;

    log.info("v1/search validated", {
      requestId,
      query,
      limit,
      offset,
      mode,
      filters: filters ?? null,
    });

    // 3. Call extracted logic
    const response = await searchLogic(
      { workspaceId, userId, authType, apiKeyId: authResult.auth.apiKeyId },
      {
        query,
        limit,
        offset,
        mode,
        filters,
        includeContext,
        includeHighlights,
        requestId,
      }
    );

    // Update latency metrics to include auth and parse time
    response.latency.auth = authLatency;
    response.latency.parse = parseLatency;
    response.latency.total = Date.now() - startTime;

    log.info("v1/search complete", {
      requestId,
      resultCount: response.data.length,
      latency: response.latency,
    });

    return NextResponse.json(response, {
      headers: buildRateLimitHeaders(authResult.auth),
    });
  } catch (error) {
    log.error("v1/search error", {
      requestId,
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      {
        error: "INTERNAL_ERROR",
        message: error instanceof Error ? error.message : "Search failed",
        requestId,
      },
      { status: 500 },
    );
  }
}

/**
 * GET handler - return method not allowed
 */
export function GET() {
  return NextResponse.json(
    { error: "METHOD_NOT_ALLOWED", message: "Use POST method" },
    { status: 405 },
  );
}
