import {
  finalizeNativeAuthAttemptForRequest,
  getNativeAuthSessionForRequest,
  getNativeOAuthClientConfig,
  isNativeAuthError,
} from "@api/app/native-auth";

export {
  finalizeNativeAuthAttemptForRequest,
  getNativeAuthSessionForRequest,
  getNativeOAuthClientConfig,
};

export function jsonResponse(data: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("cache-control", "no-store");
  headers.set("content-type", "application/json");

  return Response.json(data, { ...init, headers });
}

export function errorResponse(error: unknown) {
  if (isNativeAuthError(error)) {
    return jsonResponse(
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
