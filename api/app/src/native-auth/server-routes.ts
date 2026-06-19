import { db } from "@db/app/client";
import {
  NATIVE_AUTH_HEADERS,
  type NativeClient,
  nativeClientSchema,
  nativeFinalizeRequestSchema,
  nativeOAuthConfigSchema,
  nativeSessionMetadataSchema,
} from "@repo/native-auth-contract";

import { resolveAuthContextFromClerk } from "../auth/identity";
import {
  finalizeNativeAuthAttemptForNativeOAuth,
  getNativeAuthSessionForNativeOAuth,
  getNativeOAuthClientConfig,
  isNativeAuthError,
  NativeAuthError,
} from ".";

async function resolveNativeOAuthRequestAuth(input: {
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

async function requireNativeOAuthRequestAccess(input: {
  headers: Headers;
  source: NativeClient;
}) {
  const auth = await resolveNativeOAuthRequestAuth(input);
  if (
    auth.identity.type === "unauthenticated" ||
    auth.access?.kind !== "clerk-oauth"
  ) {
    throw new NativeAuthError(
      "UNAUTHORIZED",
      "Lightfast native OAuth authentication required."
    );
  }

  return {
    access: auth.access,
    identity: auth.identity,
  };
}

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
    const { access } = await requireNativeOAuthRequestAccess({
      headers: request.headers,
      source: body.client,
    });
    const session = await finalizeNativeAuthAttemptForNativeOAuth({
      data: body,
      db,
      userId: access.userId,
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
    const { access, identity } = await requireNativeOAuthRequestAccess({
      headers: request.headers,
      source: "desktop",
    });
    if (identity.type !== "active") {
      throw new NativeAuthError(
        "FORBIDDEN",
        "Native session organization required"
      );
    }
    const session = await getNativeAuthSessionForNativeOAuth({
      client: access.client,
      db,
      organizationId: identity.orgId,
      userId: identity.userId,
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
