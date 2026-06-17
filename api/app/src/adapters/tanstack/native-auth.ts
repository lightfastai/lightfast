import { db } from "@db/app/client";
import { nativeCreateAttemptInputSchema } from "@repo/native-auth-contract";
import { createServerFn } from "@tanstack/react-start";
import { getRequest, setResponseHeader } from "@tanstack/react-start/server";

import { resolveAuthContextFromClerk } from "../../auth/identity";
import {
  createNativeAuthAttemptForAuthContext,
  isNativeAuthError,
  listNativeOrganizationsForAuthContext,
} from "../../native-auth";

async function createTanStackNativeAuthContext() {
  const request = getRequest();
  return resolveAuthContextFromClerk({
    db,
    headers: new Headers(request.headers),
  });
}

function mapTanStackNativeAuthError(error: unknown): never {
  if (isNativeAuthError(error)) {
    throw new Error(error.message, { cause: error });
  }
  throw error;
}

function noStore() {
  setResponseHeader("cache-control", "private, no-store");
  setResponseHeader("vary", "Cookie, Authorization");
}

export const listNativeAuthOrganizations = createServerFn({
  method: "GET",
}).handler(async () => {
  noStore();
  try {
    return await listNativeOrganizationsForAuthContext({
      auth: await createTanStackNativeAuthContext(),
      db,
    });
  } catch (error) {
    mapTanStackNativeAuthError(error);
  }
});

export const createNativeAuthAttempt = createServerFn({ method: "POST" })
  .inputValidator(nativeCreateAttemptInputSchema)
  .handler(async ({ data }) => {
    noStore();
    try {
      return await createNativeAuthAttemptForAuthContext({
        auth: await createTanStackNativeAuthContext(),
        data,
        db,
      });
    } catch (error) {
      mapTanStackNativeAuthError(error);
    }
  });

export type ListNativeAuthOrganizationsResult = Awaited<
  ReturnType<typeof listNativeAuthOrganizations>
>;
export type CreateNativeAuthAttemptResult = Awaited<
  ReturnType<typeof createNativeAuthAttempt>
>;
