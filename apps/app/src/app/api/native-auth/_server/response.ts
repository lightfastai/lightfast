import { TRPCError } from "@trpc/server";
import { getHTTPStatusCodeFromError } from "@trpc/server/http";

export function jsonResponse(data: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("cache-control", "no-store");
  headers.set("content-type", "application/json");

  return Response.json(data, { ...init, headers });
}

export function errorResponse(error: unknown) {
  if (error instanceof TRPCError) {
    return jsonResponse(
      { error: { code: error.code, message: error.message } },
      { status: getHTTPStatusCodeFromError(error) }
    );
  }

  console.error("[native-auth] Unexpected route error", error);

  return jsonResponse(
    {
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Unexpected auth error",
      },
    },
    { status: 500 }
  );
}
