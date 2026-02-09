/**
 * Graph API - POST endpoint
 *
 * POST /v1/graph
 *
 * Traverses the relationship graph from a starting observation.
 * Returns connected observations with relationship edges.
 * Accepts parameters via JSON body for SDK/MCP consistency.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { log } from "@vendor/observability/log";
import { V1GraphRequestSchema } from "@repo/console-types";
import {
  withDualAuth,
  createDualAuthErrorResponse,
} from "../lib/with-dual-auth";
import { graphLogic } from "~/lib/v1/graph";

export async function POST(request: NextRequest) {
  const requestId = randomUUID();
  const startTime = Date.now();

  log.info("v1/graph POST request", { requestId });

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
    const parseResult = V1GraphRequestSchema.safeParse(body);
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

    const { id: observationId, depth, types } = parseResult.data;
    const allowedTypes = types ?? null;

    const authResult = await withDualAuth(request, requestId);
    if (!authResult.success) {
      return createDualAuthErrorResponse(authResult, requestId);
    }

    const { workspaceId } = authResult.auth;

    const result = await graphLogic(
      { workspaceId, userId: authResult.auth.userId, authType: authResult.auth.authType },
      { observationId, depth, allowedTypes, requestId }
    );

    log.info("v1/graph POST complete", {
      requestId,
      nodeCount: result.data.nodes.length,
      edgeCount: result.data.edges.length,
      depth,
      took: Date.now() - startTime,
    });

    return NextResponse.json(result);
  } catch (error) {
    log.error("v1/graph POST error", {
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
