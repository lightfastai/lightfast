import { appRouter, createCallerFactory, createTRPCContext } from "@api/app";
import {
  NATIVE_AUTH_HEADERS,
  type NativeClient,
} from "@repo/native-auth-contract";
import { TRPCError } from "@trpc/server";
import { getHTTPStatusCodeFromError } from "@trpc/server/http";

const createCaller = createCallerFactory(appRouter);

export async function createNativeOAuthFacadeCaller(input: {
  headers: Headers;
  source: NativeClient;
}) {
  const headers = new Headers(input.headers);
  headers.set("x-trpc-source", input.source);
  headers.set(NATIVE_AUTH_HEADERS.client, input.source);

  return createCaller(await createTRPCContext({ headers }));
}

export function jsonResponse(data: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("cache-control", "no-store");
  headers.set("content-type", "application/json");

  return Response.json(data, { ...init, headers });
}

export function errorResponse(error: unknown) {
  if (error instanceof TRPCError) {
    const status = getHTTPStatusCodeFromError(error);
    return jsonResponse(
      {
        error: {
          code: error.code,
          message: status >= 500 ? "Unexpected auth error" : error.message,
        },
      },
      { status }
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
