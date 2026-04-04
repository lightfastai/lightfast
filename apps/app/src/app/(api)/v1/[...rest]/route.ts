import { randomUUID } from "node:crypto";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { log } from "@vendor/observability/log/next";
import { router } from "../../lib/orpc-router";

const handler = new OpenAPIHandler(router);

async function handleRequest(request: Request) {
  const requestId = randomUUID();

  try {
    const { matched, response } = await handler.handle(request, {
      context: {
        headers: request.headers,
        requestId,
      },
    });

    if (matched) {
      return response;
    }

    return Response.json(
      { error: "NOT_FOUND", message: "Endpoint not found", requestId },
      { status: 404 }
    );
  } catch (error) {
    log.error("oRPC handler error", {
      error: error instanceof Error ? error.message : String(error),
      requestId,
    });
    return Response.json(
      { error: "INTERNAL_ERROR", requestId },
      { status: 500 }
    );
  }
}

export const GET = handleRequest;
export const POST = handleRequest;
export const PUT = handleRequest;
export const DELETE = handleRequest;
export const PATCH = handleRequest;
