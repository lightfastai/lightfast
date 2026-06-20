import { db } from "@db/app/client";
import { createServerFn } from "@tanstack/react-start";
import { getRequest, setResponseHeader } from "@tanstack/react-start/server";

import { resolveAuthContextFromClerk } from "../../auth/identity";
import { actorFromAuthIdentity, isDomainError } from "../../domain";
import {
  disconnectUserConnectorCommand,
  startUserConnectorCommand,
  type UserConnectorCommandDeps,
} from "../../domain/user-connectors";
import {
  disconnectGranolaUserConnector,
  startGranolaUserConnectorOAuth,
} from "../../services/user-connectors/granola-flow";

function requestId() {
  return crypto.randomUUID();
}

async function createTanStackUserConnectorContext(request: Request) {
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

function deps(request: Request): UserConnectorCommandDeps {
  return {
    db,
    disconnectGranolaUserConnector,
    request: { referer: request.headers.get("referer") },
    startGranolaUserConnectorOAuth,
  };
}

export const startUserConnector = createServerFn({ method: "POST" })
  .inputValidator(startUserConnectorCommand.input)
  .handler(async ({ data }) => {
    const request = getRequest();
    noStore();
    try {
      return await startUserConnectorCommand.run({
        ctx: await createTanStackUserConnectorContext(request),
        deps: deps(request),
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
        ctx: await createTanStackUserConnectorContext(request),
        deps: deps(request),
        input: data,
      });
    } catch (error) {
      mapTanStackError(error);
    }
  });
