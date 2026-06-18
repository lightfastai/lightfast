import {
  nativeClientSchema,
  nativeFinalizeRequestSchema,
  nativeOAuthConfigSchema,
  nativeSessionMetadataSchema,
} from "@repo/native-auth-contract";

import {
  finalizeNativeAuthAttemptForRequest,
  getNativeAuthSessionForRequest,
  getNativeOAuthClientConfig,
  isNativeAuthError,
} from ".";

export function handleNativeOAuthClientConfigRequest(client: string): Response {
  try {
    const parsedClient = nativeClientSchema.parse(client);
    const config = getNativeOAuthClientConfig({
      client: parsedClient,
    });
    return nativeOAuthJson(nativeOAuthConfigSchema.parse(config));
  } catch (error) {
    return nativeOAuthError(error);
  }
}

export async function handleNativeOAuthFinalizeRequest(
  request: Request
): Promise<Response> {
  try {
    const body = nativeFinalizeRequestSchema.parse(
      await request.json().catch(() => null)
    );
    const session = await finalizeNativeAuthAttemptForRequest({
      data: body,
      headers: request.headers,
      source: body.client,
    });
    return nativeOAuthJson(nativeSessionMetadataSchema.parse(session));
  } catch (error) {
    return nativeOAuthError(error);
  }
}

export async function handleNativeOAuthDesktopSessionRequest(
  request: Request
): Promise<Response> {
  try {
    const session = await getNativeAuthSessionForRequest({
      headers: request.headers,
      source: "desktop",
    });
    return nativeOAuthJson(nativeSessionMetadataSchema.parse(session));
  } catch (error) {
    return nativeOAuthError(error);
  }
}

function nativeOAuthJson(data: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set("cache-control", "no-store");
  headers.set("content-type", "application/json");

  return Response.json(data, { ...init, headers });
}

function nativeOAuthError(error: unknown): Response {
  if (isNativeAuthError(error)) {
    return nativeOAuthJson(
      {
        error: {
          code: error.code,
          message:
            error.status >= 500 ? "Unexpected auth error" : error.message,
        },
      },
      { status: error.status }
    );
  }

  console.error("[native-auth] Unexpected route error", error);

  return nativeOAuthJson(
    {
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Unexpected auth error",
      },
    },
    { status: 500 }
  );
}
