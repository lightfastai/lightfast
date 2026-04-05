import { randomUUID } from "node:crypto";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { parseError } from "@vendor/observability/error/next";
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
      const enriched = new Response(response.body, response);
      enriched.headers.set("X-Request-ID", requestId);
      return enriched;
    }

    return Response.json(
      {
        defined: false,
        code: "NOT_FOUND",
        status: 404,
        message: "Endpoint not found",
      },
      { status: 404, headers: { "X-Request-ID": requestId } }
    );
  } catch (error) {
    log.error("oRPC handler error", {
      error: parseError(error),
      requestId,
    });
    return Response.json(
      {
        defined: false,
        code: "INTERNAL_SERVER_ERROR",
        status: 500,
        message: "Internal server error",
      },
      { status: 500, headers: { "X-Request-ID": requestId } }
    );
  }
}

export const GET = handleRequest;
export const POST = handleRequest;
export const PUT = handleRequest;
export const DELETE = handleRequest;
export const PATCH = handleRequest;
