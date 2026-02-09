/**
 * Related Events API - POST endpoint
 *
 * POST /v1/related
 *
 * Returns observations directly connected to the given observation
 * via the relationship graph. Simpler than full graph traversal.
 * Accepts parameters via JSON body for SDK/MCP consistency.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { log } from "@vendor/observability/log";
import { V1RelatedRequestSchema } from "@repo/console-types";
import {
  withDualAuth,
  createDualAuthErrorResponse,
} from "../lib/with-dual-auth";
import { relatedLogic } from "~/lib/v1";

export async function POST(request: NextRequest) {
  const requestId = randomUUID();
  const startTime = Date.now();

  log.info("v1/related POST request", { requestId });

  try {
    // Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "INVALID_JSON", message: "Invalid JSON body", requestId },
        { status: 400 }
      );
    }

    // Validate request body
    const parseResult = V1RelatedRequestSchema.safeParse(body);
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

    const { id: observationId } = parseResult.data;

    const authResult = await withDualAuth(request, requestId);
    if (!authResult.success) {
      return createDualAuthErrorResponse(authResult, requestId);
    }

    const { workspaceId } = authResult.auth;

    const result = await relatedLogic(
      { workspaceId, userId: authResult.auth.userId, authType: authResult.auth.authType },
      { observationId, requestId }
    );

    log.info("v1/related POST complete", {
      requestId,
      total: result.data.related.length,
      took: Date.now() - startTime,
    });

    return NextResponse.json(result);
  } catch (error) {
    log.error("v1/related POST error", {
      requestId,
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      {
        error: "INTERNAL_ERROR",
        message: error instanceof Error ? error.message : "Related lookup failed",
        requestId,
      },
      { status: 500 }
    );
  }
}
