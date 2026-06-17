import { db } from "@db/app/client";
import { createServerFn } from "@tanstack/react-start";
import { getRequest, setResponseHeader } from "@tanstack/react-start/server";

import { resolveAuthContextFromClerk } from "../../auth/identity";
import { actorFromAuthIdentity, isDomainError } from "../../domain";
import {
  createDefaultOrgIdentityCommandDeps,
  getOrgIdentityCommand,
} from "../../domain/org-identity";

function requestId() {
  return crypto.randomUUID();
}

async function createTanStackOrgIdentityContext() {
  const request = getRequest();
  const auth = await resolveAuthContextFromClerk({
    db,
    headers: new Headers(request.headers),
  });

  return {
    actor: actorFromAuthIdentity(auth.identity, "web"),
    request: { id: requestId(), source: "tanstack" as const },
  };
}

function mapTanStackError(error: unknown): never {
  if (isDomainError(error)) {
    throw new Error(error.message, { cause: error });
  }
  throw error;
}

function noStore() {
  setResponseHeader("cache-control", "private, no-store");
  setResponseHeader("vary", "Cookie, Authorization");
}

export const getOrgIdentity = createServerFn({ method: "GET" }).handler(
  async () => {
    noStore();
    try {
      return await getOrgIdentityCommand.run({
        ctx: await createTanStackOrgIdentityContext(),
        deps: createDefaultOrgIdentityCommandDeps({ db }),
        input: {},
      });
    } catch (error) {
      mapTanStackError(error);
    }
  }
);

export type OrgIdentityResult = Awaited<ReturnType<typeof getOrgIdentity>>;
