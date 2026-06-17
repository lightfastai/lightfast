import { db } from "@db/app/client";
import { createServerFn } from "@tanstack/react-start";
import { getRequest, setResponseHeader } from "@tanstack/react-start/server";

import { resolveAuthContextFromClerk } from "../../auth/identity";
import { actorFromAuthIdentity, isDomainError } from "../../domain";
import {
  createDefaultUserConnectorCommandDeps,
  disconnectUserConnectorCommand,
  startUserConnectorCommand,
} from "../../domain/user-connectors";

function requestId() {
  return crypto.randomUUID();
}

async function createTanStackUserConnectorContext() {
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

export const startUserConnector = createServerFn({ method: "POST" })
  .inputValidator(startUserConnectorCommand.input)
  .handler(async ({ data }) => {
    const request = getRequest();
    noStore();
    try {
      return await startUserConnectorCommand.run({
        ctx: await createTanStackUserConnectorContext(),
        deps: createDefaultUserConnectorCommandDeps({
          db,
          headers: new Headers(request.headers),
        }),
        input: data,
      });
    } catch (error) {
      mapTanStackError(error);
    }
  });

export const disconnectUserConnector = createServerFn({ method: "POST" })
  .inputValidator(disconnectUserConnectorCommand.input)
  .handler(async ({ data }) => {
    const request = getRequest();
    noStore();
    try {
      return await disconnectUserConnectorCommand.run({
        ctx: await createTanStackUserConnectorContext(),
        deps: createDefaultUserConnectorCommandDeps({
          db,
          headers: new Headers(request.headers),
        }),
        input: data,
      });
    } catch (error) {
      mapTanStackError(error);
    }
  });
