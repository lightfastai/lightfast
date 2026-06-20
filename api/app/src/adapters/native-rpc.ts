import { db } from "@db/app/client";
import {
  NATIVE_AUTH_HEADERS,
  type NativeClient,
  type NativeRpcCommand,
  type NativeRpcErrorCode,
  nativeRpcAuthSessionInputSchema,
  nativeRpcAuthSessionSuccessResponseSchema,
  nativeRpcErrorResponseSchema,
  nativeRpcRequestSchema,
  nativeRpcSuccessResponseSchema,
} from "@repo/native-auth-contract";

import { resolveAuthContextFromClerk } from "../auth/identity";
import {
  getNativeAuthSessionForNativeOAuth,
  isNativeAuthError,
  NativeAuthError,
} from "../native-auth";

type NativeRpcStatus = 400 | 401 | 403 | 404 | 500 | 502;

type NativeRpcCommandHandler = (input: {
  commandInput: unknown;
  request: Request;
}) => Promise<unknown>;

interface NativeRpcCommandHandlers {
  providerRoutineCall?: NativeRpcCommandHandler;
  providerRoutineFind?: NativeRpcCommandHandler;
}

interface NativeRpcSurface {
  allowedCommands: readonly NativeRpcCommand[];
  handlers?: NativeRpcCommandHandlers;
  source: NativeClient;
}

export class NativeRpcRouteError extends Error {
  constructor(
    readonly code: NativeRpcErrorCode,
    message: string,
    readonly status: NativeRpcStatus
  ) {
    super(message);
    this.name = "NativeRpcRouteError";
  }
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

function commandNotFoundResponse() {
  return errorResponse(
    "COMMAND_NOT_FOUND",
    "Native RPC command was not found.",
    404
  );
}

async function resolveNativeRpcAuth(input: {
  headers: Headers;
  source: NativeClient;
}) {
  const headers = new Headers(input.headers);
  headers.set(NATIVE_AUTH_HEADERS.client, input.source);

  return resolveAuthContextFromClerk({
    db,
    headers,
  });
}

async function loadNativeRpcAuthSession(input: {
  headers: Headers;
  source: NativeClient;
}) {
  const auth = await resolveNativeRpcAuth(input);
  if (
    auth.identity.type === "unauthenticated" ||
    auth.access?.kind !== "clerk-oauth" ||
    auth.access.client !== input.source
  ) {
    throw new NativeAuthError(
      "UNAUTHORIZED",
      "Lightfast native OAuth authentication required."
    );
  }

  if (auth.identity.type !== "active") {
    throw new NativeAuthError(
      "FORBIDDEN",
      "Native session organization required"
    );
  }

  return getNativeAuthSessionForNativeOAuth({
    client: auth.access.client,
    db,
    organizationId: auth.identity.orgId,
    userId: auth.identity.userId,
  });
}

function normalizeErrorResponse(error: unknown) {
  if (error instanceof NativeRpcRouteError) {
    return errorResponse(error.code, error.message, error.status);
  }

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

        const result = await loadNativeRpcAuthSession({
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
      case "providerRoutines.find": {
        const handler = surface.handlers?.providerRoutineFind;
        if (!handler) {
          return commandNotFoundResponse();
        }
        const result = await handler({
          commandInput:
            "input" in parsedRequest.data ? parsedRequest.data.input : {},
          request,
        });
        return jsonResponse(
          nativeRpcSuccessResponseSchema.parse({
            ok: true,
            result,
          })
        );
      }
      case "providerRoutines.call": {
        const handler = surface.handlers?.providerRoutineCall;
        if (!handler) {
          return commandNotFoundResponse();
        }
        const result = await handler({
          commandInput:
            "input" in parsedRequest.data ? parsedRequest.data.input : null,
          request,
        });
        return jsonResponse(
          nativeRpcSuccessResponseSchema.parse({
            ok: true,
            result,
          })
        );
      }
      default:
        return commandNotFoundResponse();
    }
  } catch (error) {
    return normalizeErrorResponse(error);
  }
}
