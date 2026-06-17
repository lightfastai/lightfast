import { db } from "@db/app/client";
import { createServerFn } from "@tanstack/react-start";
import { getRequest, setResponseHeader } from "@tanstack/react-start/server";

import { resolveAuthContextFromClerk } from "../../auth/identity";
import type { Actor } from "../../domain";
import { actorFromAuthIdentity, isDomainError } from "../../domain";
import {
  createDefaultSourceControlCommandDeps,
  getSourceControlConnectionCommand,
  importSourceControlRepositoryCommand,
  listSourceControlRepositoriesCommand,
} from "../../domain/source-control";

function requestId() {
  return crypto.randomUUID();
}

function maybeMarkOrgAdmin(input: {
  actor: Actor;
  auth: Awaited<ReturnType<typeof resolveAuthContextFromClerk>>;
}): Actor {
  if (
    input.actor.kind === "clerkUser" &&
    input.auth.identity.type === "active" &&
    input.auth.access?.kind === "clerk-session" &&
    input.auth.access.userId === input.auth.identity.userId &&
    input.auth.access.orgId === input.auth.identity.orgId &&
    input.auth.access.has({ role: "org:admin" })
  ) {
    return { ...input.actor, orgRole: "admin" };
  }

  return input.actor;
}

async function createTanStackSourceControlContext() {
  const request = getRequest();
  const auth = await resolveAuthContextFromClerk({
    db,
    headers: new Headers(request.headers),
  });
  const actor = actorFromAuthIdentity(auth.identity, "web");

  return {
    actor: maybeMarkOrgAdmin({ actor, auth }),
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

export const getSourceControlConnection = createServerFn({
  method: "GET",
}).handler(async () => {
  noStore();
  try {
    return await getSourceControlConnectionCommand.run({
      ctx: await createTanStackSourceControlContext(),
      deps: createDefaultSourceControlCommandDeps({ db }),
      input: {},
    });
  } catch (error) {
    mapTanStackError(error);
  }
});

export const listSourceControlRepositories = createServerFn({
  method: "GET",
}).handler(async () => {
  noStore();
  try {
    return await listSourceControlRepositoriesCommand.run({
      ctx: await createTanStackSourceControlContext(),
      deps: createDefaultSourceControlCommandDeps({ db }),
      input: {},
    });
  } catch (error) {
    mapTanStackError(error);
  }
});

export const importSourceControlRepository = createServerFn({ method: "POST" })
  .inputValidator(importSourceControlRepositoryCommand.input)
  .handler(async ({ data }) => {
    noStore();
    try {
      return await importSourceControlRepositoryCommand.run({
        ctx: await createTanStackSourceControlContext(),
        deps: createDefaultSourceControlCommandDeps({ db }),
        input: data,
      });
    } catch (error) {
      mapTanStackError(error);
    }
  });

export type SourceControlConnectionResult = Awaited<
  ReturnType<typeof getSourceControlConnection>
>;
export type ListSourceControlRepositoriesResult = Awaited<
  ReturnType<typeof listSourceControlRepositories>
>;
