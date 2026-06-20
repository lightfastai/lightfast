import {
  getMcpOauthGrantByPublicId,
  listMcpOauthGrantConnectionsForOrg,
  listMcpOauthGrantConnectionsForUser,
  revokeMcpOauthGrant,
} from "@db/app";
import { db } from "@db/app/client";
import { createServerFn } from "@tanstack/react-start";
import { getRequest, setResponseHeader } from "@tanstack/react-start/server";

import { resolveAuthContextFromClerk } from "../../auth/identity";
import type { Actor } from "../../domain";
import { actorFromAuthIdentity, isDomainError } from "../../domain";
import {
  listAccountMcpConnectionsCommand,
  listOrgMcpConnectionsCommand,
  type McpConnectionCommandDeps,
  revokeAccountMcpConnectionCommand,
  revokeOrgMcpConnectionCommand,
} from "../../domain/mcp-connections";

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

async function createTanStackMcpConnectionContext() {
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

function commandDeps(): McpConnectionCommandDeps {
  return {
    getGrantByPublicId: async (input) =>
      (await getMcpOauthGrantByPublicId(db, input)) ?? null,
    listGrantConnectionsForOrg: (input) =>
      listMcpOauthGrantConnectionsForOrg(db, input),
    listGrantConnectionsForUser: (input) =>
      listMcpOauthGrantConnectionsForUser(db, input),
    revokeGrant: (input) => revokeMcpOauthGrant(db, input),
  };
}

export const listAccountMcpConnections = createServerFn({
  method: "GET",
}).handler(async () => {
  noStore();
  try {
    return await listAccountMcpConnectionsCommand.run({
      ctx: await createTanStackMcpConnectionContext(),
      deps: commandDeps(),
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
        deps: commandDeps(),
        input: data,
      });
    } catch (error) {
      mapTanStackError(error);
    }
  });

export const listOrgMcpConnections = createServerFn({
  method: "GET",
}).handler(async () => {
  noStore();
  try {
    return await listOrgMcpConnectionsCommand.run({
      ctx: await createTanStackMcpConnectionContext(),
      deps: commandDeps(),
      input: {},
    });
  } catch (error) {
    mapTanStackError(error);
  }
});

export const revokeOrgMcpConnection = createServerFn({ method: "POST" })
  .inputValidator(revokeOrgMcpConnectionCommand.input)
  .handler(async ({ data }) => {
    noStore();
    try {
      return await revokeOrgMcpConnectionCommand.run({
        ctx: await createTanStackMcpConnectionContext(),
        deps: commandDeps(),
        input: data,
      });
    } catch (error) {
      mapTanStackError(error);
    }
  });

export type ListOrgMcpConnectionsResult = Awaited<
  ReturnType<typeof listOrgMcpConnections>
>;
