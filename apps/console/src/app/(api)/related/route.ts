import { randomUUID } from "node:crypto";
import { RelatedRequestSchema } from "@repo/console-validation";
import { log } from "@vendor/observability/log";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { relatedLogic } from "~/lib/related";
import {
  createDualAuthErrorResponse,
  withDualAuth,
} from "../lib/with-dual-auth";

export async function POST(request: NextRequest) {
  const requestId = randomUUID();

  log.info("Related API request", { requestId });

  try {
    const authResult = await withDualAuth(request, requestId);
    if (!authResult.success) {
      return createDualAuthErrorResponse(authResult, requestId);
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "INVALID_JSON", requestId },
        { status: 400 }
      );
    }

    const parsed = RelatedRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "VALIDATION_ERROR",
          details: parsed.error.flatten(),
          requestId,
        },
        { status: 400 }
      );
    }

    const result = await relatedLogic(
      {
        workspaceId: authResult.auth.workspaceId,
        userId: authResult.auth.userId,
        authType: authResult.auth.authType,
        apiKeyId: authResult.auth.apiKeyId,
      },
      parsed.data,
      requestId
    );

    return NextResponse.json(result);
  } catch (err) {
    log.error("Related API handler error", {
      error: err instanceof Error ? err.message : String(err),
      requestId,
    });
    return NextResponse.json(
      { error: "INTERNAL_ERROR", requestId },
      { status: 500 }
    );
  }
}
