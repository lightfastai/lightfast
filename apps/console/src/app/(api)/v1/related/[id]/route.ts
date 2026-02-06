/**
 * Related Events API
 *
 * GET /v1/related/{observationId}
 *
 * Returns observations directly connected to the given observation
 * via the relationship graph. Simpler than full graph traversal.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { log } from "@vendor/observability/log";
import {
  withDualAuth,
  createDualAuthErrorResponse,
} from "../../lib/with-dual-auth";
import { relatedLogic } from "~/lib/v1";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const requestId = randomUUID();
  const startTime = Date.now();
  const { id: observationId } = await params;

  log.info("v1/related request", { requestId, observationId });

  try {
    // Authenticate
    const authResult = await withDualAuth(request, requestId);
    if (!authResult.success) {
      return createDualAuthErrorResponse(authResult, requestId);
    }

    const { workspaceId } = authResult.auth;

    // Call extracted logic
    const result = await relatedLogic(
      { workspaceId, userId: authResult.auth.userId, authType: authResult.auth.authType },
      {
        observationId,
        requestId,
      }
    );

    log.info("v1/related complete", {
      requestId,
      total: result.data.related.length,
      took: Date.now() - startTime,
    });

    return NextResponse.json(result);
  } catch (error) {
    log.error("v1/related error", {
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
