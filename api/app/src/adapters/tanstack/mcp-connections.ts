import { db } from "@db/app/client";
import { createServerFn } from "@tanstack/react-start";
import { getRequest, setResponseHeader } from "@tanstack/react-start/server";

import { resolveAuthContextFromClerk } from "../../auth/identity";
import { actorFromAuthIdentity, isDomainError } from "../../domain";
import {
  createDefaultMcpConnectionCommandDeps,
  listAccountMcpConnectionsCommand,
  revokeAccountMcpConnectionCommand,
} from "../../domain/mcp-connections";

function requestId() {
  return crypto.randomUUID();
}

async function createTanStackMcpConnectionContext() {
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

export const listAccountMcpConnections = createServerFn({
  method: "GET",
}).handler(async () => {
  noStore();
  try {
    return await listAccountMcpConnectionsCommand.run({
      ctx: await createTanStackMcpConnectionContext(),
      deps: createDefaultMcpConnectionCommandDeps({ db }),
      input: {},
    });
  } catch (error) {
    mapTanStackError(error);
  }
});

export const revokeAccountMcpConnection = createServerFn({ method: "POST" })
  .inputValidator(revokeAccountMcpConnectionCommand.input)
  .handler(async ({ data }) => {
    noStore();
    try {
      return await revokeAccountMcpConnectionCommand.run({
        ctx: await createTanStackMcpConnectionContext(),
        deps: createDefaultMcpConnectionCommandDeps({ db }),
        input: data,
      });
    } catch (error) {
      mapTanStackError(error);
    }
  });
