import { db } from "@db/app/client";
import { nativeCreateAttemptInputSchema } from "@repo/native-auth-contract";
import { redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import {
  getRequest,
  setResponseHeader,
  setResponseStatus,
} from "@tanstack/react-start/server";

import { resolveAuthContextFromClerk } from "../../auth/identity";
import {
  createNativeAuthAttemptForUser,
  isNativeAuthError,
  listNativeOrganizationsForUser,
  NativeAuthError,
} from "../../native-auth";

async function createTanStackNativeAuthContext() {
  const request = getRequest();
  return resolveAuthContextFromClerk({
    db,
    headers: new Headers(request.headers),
  });
}

function requireSignedInNativeAuthIdentity(
  auth: Awaited<ReturnType<typeof createTanStackNativeAuthContext>>
) {
  if (auth.identity.type === "unauthenticated") {
    throw new NativeAuthError(
      "UNAUTHORIZED",
      "Authentication required. Please sign in."
    );
  }

  return auth.identity;
}

function oauthRequestRedirectTarget(requestUrl: string): string {
  try {
    const url = new URL(requestUrl);
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return requestUrl.startsWith("/") ? requestUrl : "/";
  }
}

function redirectToSignInForOAuth(requestUrl: string): never {
  throw redirect({
    search: { redirect_url: oauthRequestRedirectTarget(requestUrl) },
    throw: true,
    to: "/sign-in",
  });
}

function mapTanStackNativeAuthError(
  error: unknown,
  options: { redirectUnauthorizedToSignIn?: boolean; requestUrl?: string } = {}
): never {
  if (isNativeAuthError(error)) {
    if (
      options.redirectUnauthorizedToSignIn &&
      options.requestUrl &&
      error.code === "UNAUTHORIZED"
    ) {
      redirectToSignInForOAuth(options.requestUrl);
    }

    setResponseStatus(error.status);
    throw new Error(error.message, { cause: error });
  }
  throw error;
}

function noStore() {
  setResponseHeader("cache-control", "private, no-store");
  setResponseHeader("vary", "Cookie, Authorization");
}

async function listNativeAuthOrganizationsForCurrentRequest(
  options: { redirectUnauthorizedToSignIn?: boolean } = {}
) {
  const request = getRequest();
  noStore();
  try {
    const identity = requireSignedInNativeAuthIdentity(
      await createTanStackNativeAuthContext()
    );
    return await listNativeOrganizationsForUser({
      db,
      userId: identity.userId,
    });
  } catch (error) {
    mapTanStackNativeAuthError(error, {
      redirectUnauthorizedToSignIn: options.redirectUnauthorizedToSignIn,
      requestUrl: request.url,
    });
  }
}

export const loadNativeAuthOrganizations = createServerFn({
  method: "GET",
}).handler(async () =>
  listNativeAuthOrganizationsForCurrentRequest({
    redirectUnauthorizedToSignIn: true,
  })
);

export const listNativeAuthOrganizations = createServerFn({
  method: "GET",
}).handler(async () => listNativeAuthOrganizationsForCurrentRequest());

export const createNativeAuthAttempt = createServerFn({ method: "POST" })
  .inputValidator(nativeCreateAttemptInputSchema)
  .handler(async ({ data }) => {
    noStore();
    try {
      const identity = requireSignedInNativeAuthIdentity(
        await createTanStackNativeAuthContext()
      );
      return await createNativeAuthAttemptForUser({
        data,
        db,
        userId: identity.userId,
      });
    } catch (error) {
      mapTanStackNativeAuthError(error);
    }
  });

export type LoadNativeAuthOrganizationsResult = Awaited<
  ReturnType<typeof loadNativeAuthOrganizations>
>;
export type ListNativeAuthOrganizationsResult = Awaited<
  ReturnType<typeof listNativeAuthOrganizations>
>;
export type CreateNativeAuthAttemptResult = Awaited<
  ReturnType<typeof createNativeAuthAttempt>
>;
