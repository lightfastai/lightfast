import { db } from "@db/app/client";
import { systemHealthOutput } from "@repo/api-contract";

import { isApiKeyAuthError, resolveApiKeyAuth } from "../../auth/api-key";

const SDK_VERSION = "0.1.0";

type PublicApiStatus = 401 | 403 | 500;

function withPublicApiCors(response: Response): Response {
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set(
    "Access-Control-Allow-Methods",
    "GET,POST,PUT,PATCH,DELETE,OPTIONS"
  );
  response.headers.set(
    "Access-Control-Allow-Headers",
    "authorization,content-type"
  );
  response.headers.set("Access-Control-Max-Age", "86400");
  return response;
}

function jsonResponse(data: unknown, status: number): Response {
  return withPublicApiCors(Response.json(data, { status }));
}

function jsonError(
  error: string,
  message: string,
  status: PublicApiStatus,
  extra?: Record<string, unknown>
): Response {
  return jsonResponse({ error, message, ...extra }, status);
}

function authErrorResponse(error: unknown): Response {
  if (!isApiKeyAuthError(error)) {
    return jsonError(
      "internal_error",
      "Failed to authenticate API request.",
      500
    );
  }

  return jsonError(
    error.status === 403 ? "forbidden" : "auth_required",
    error.message,
    error.status,
    { diagnostics: [error.diagnostic] }
  );
}

export function handlePublicApiOptionsRequest(): Response {
  return withPublicApiCors(new Response(null, { status: 204 }));
}

export async function handleSystemHealthPublicApiRequest(
  request: Request
): Promise<Response> {
  try {
    await resolveApiKeyAuth({ db, headers: request.headers });
  } catch (error) {
    return authErrorResponse(error);
  }

  return jsonResponse(
    systemHealthOutput.parse({
      status: "ok",
      timestamp: new Date().toISOString(),
      version: SDK_VERSION,
    }),
    200
  );
}
