/**
 * Graph API
 *
 * GET /v1/graph/{observationId}?depth=2&types=fixes,deploys
 *
 * Traverses the relationship graph from a starting observation.
 * Returns connected observations with relationship edges.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { log } from "@vendor/observability/log";
import { NotFoundError } from "@repo/console-types";
import {
  withDualAuth,
  createDualAuthErrorResponse,
} from "../../lib/with-dual-auth";
import { graphLogic } from "~/lib/v1";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const requestId = randomUUID();
  const startTime = Date.now();
  const { id: observationId } = await params;

  log.info("v1/graph request", { requestId, observationId });

  try {
    // Parse query params
    const { searchParams } = new URL(request.url);
    const depth = Math.min(parseInt(searchParams.get("depth") ?? "2", 10), 3);
    const typesParam = searchParams.get("types");
    const allowedTypes = typesParam ? typesParam.split(",") : null;

    // Authenticate
    const authResult = await withDualAuth(request, requestId);
    if (!authResult.success) {
      return createDualAuthErrorResponse(authResult, requestId);
    }

    const { workspaceId } = authResult.auth;

    // Call extracted logic
    const result = await graphLogic(
      { workspaceId, userId: authResult.auth.userId, authType: authResult.auth.authType },
      {
        observationId,
        depth,
        allowedTypes,
        requestId,
      }
    );

    log.info("v1/graph complete", {
      requestId,
      nodeCount: result.data.nodes.length,
      edgeCount: result.data.edges.length,
      depth,
      took: Date.now() - startTime,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json(
        {
          error: "NOT_FOUND",
          message: error.message,
          requestId,
        },
        { status: 404 }
      );
    }

    log.error("v1/graph error", {
      requestId,
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      {
        error: "INTERNAL_ERROR",
        message: error instanceof Error ? error.message : "Graph traversal failed",
        requestId,
      },
      { status: 500 }
    );
  }
}
