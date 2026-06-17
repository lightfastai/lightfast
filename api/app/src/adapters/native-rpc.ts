import {
  type NativeClient,
  type NativeRpcCommand,
  type NativeRpcErrorCode,
  nativeRpcAuthSessionInputSchema,
  nativeRpcAuthSessionSuccessResponseSchema,
  nativeRpcErrorResponseSchema,
  nativeRpcRequestSchema,
} from "@repo/native-auth-contract";

import {
  getNativeAuthSessionForRequest,
  isNativeAuthError,
} from "../native-auth";

type NativeRpcStatus = 400 | 401 | 403 | 404 | 500;

interface NativeRpcSurface {
  allowedCommands: readonly NativeRpcCommand[];
  source: NativeClient;
}

function jsonResponse(data: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("cache-control", "no-store");
  headers.set("content-type", "application/json");
  headers.set("vary", "Authorization");

  return Response.json(data, { ...init, headers });
}

function errorResponse(
  code: NativeRpcErrorCode,
  message: string,
  status: NativeRpcStatus
) {
  return jsonResponse(
    nativeRpcErrorResponseSchema.parse({
      ok: false,
      error: { code, message },
    }),
    { status }
  );
}

function invalidRequestResponse() {
  return errorResponse("BAD_REQUEST", "Native RPC request is invalid.", 400);
}

function normalizeErrorResponse(error: unknown) {
  if (isNativeAuthError(error)) {
    return errorResponse(
      error.code,
      error.status >= 500 ? "Unexpected native RPC error" : error.message,
      error.status as NativeRpcStatus
    );
  }

  console.error("[native-rpc] Unexpected route error", error);
  return errorResponse(
    "INTERNAL_SERVER_ERROR",
    "Unexpected native RPC error",
    500
  );
}

export async function handleNativeRpcRequest(
  request: Request,
  surface: NativeRpcSurface
): Promise<Response> {
  const parsedRequest = nativeRpcRequestSchema.safeParse(
    await request.json().catch(() => undefined)
  );
  if (!parsedRequest.success) {
    return invalidRequestResponse();
  }

  if (!surface.allowedCommands.includes(parsedRequest.data.command)) {
    return errorResponse(
      "COMMAND_NOT_FOUND",
      "Native RPC command was not found.",
      404
    );
  }

  try {
    switch (parsedRequest.data.command) {
      case "auth.session": {
        const input =
          "input" in parsedRequest.data ? parsedRequest.data.input : {};
        const parsedInput = nativeRpcAuthSessionInputSchema.safeParse(input);
        if (!parsedInput.success) {
          return invalidRequestResponse();
        }

        const result = await getNativeAuthSessionForRequest({
          headers: request.headers,
          source: surface.source,
        });
        return jsonResponse(
          nativeRpcAuthSessionSuccessResponseSchema.parse({
            ok: true,
            result,
          })
        );
      }
      default:
        return errorResponse(
          "COMMAND_NOT_FOUND",
          "Native RPC command was not found.",
          404
        );
    }
  } catch (error) {
    return normalizeErrorResponse(error);
  }
}
