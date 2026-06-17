import { db } from "@db/app/client";
import { createServerFn } from "@tanstack/react-start";
import { getRequest, setResponseHeader } from "@tanstack/react-start/server";

import { resolveAuthContextFromClerk } from "../../auth/identity";
import type { Actor } from "../../domain";
import { actorFromAuthIdentity, isDomainError } from "../../domain";
import {
  completeSentryDeveloperConnectionAuthCommand,
  connectDeveloperConnectionCommand,
  createDefaultDeveloperConnectionCommandDeps,
  disconnectDeveloperConnectionCommand,
  listDeveloperConnectionsCommand,
  setDeveloperConnectionSandboxEnabledCommand,
  startSentryDeveloperConnectionAuthCommand,
} from "../../domain/developer-connections";

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

async function createTanStackDeveloperConnectionRequest() {
  const request = getRequest();
  const headers = new Headers(request.headers);
  const auth = await resolveAuthContextFromClerk({ db, headers });
  const actor = actorFromAuthIdentity(auth.identity, "web");

  return {
    ctx: {
      actor: maybeMarkOrgAdmin({ actor, auth }),
      request: { id: requestId(), source: "tanstack" as const },
    },
    headers,
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

export const listDeveloperConnections = createServerFn({
  method: "GET",
}).handler(async () => {
  noStore();
  try {
    const request = await createTanStackDeveloperConnectionRequest();
    return await listDeveloperConnectionsCommand.run({
      ctx: request.ctx,
      deps: createDefaultDeveloperConnectionCommandDeps({
        db,
        headers: request.headers,
      }),
      input: {},
    });
  } catch (error) {
    mapTanStackError(error);
  }
});

export const connectDeveloperConnection = createServerFn({ method: "POST" })
  .inputValidator(connectDeveloperConnectionCommand.input)
  .handler(async ({ data }) => {
    noStore();
    try {
      const request = await createTanStackDeveloperConnectionRequest();
      return await connectDeveloperConnectionCommand.run({
        ctx: request.ctx,
        deps: createDefaultDeveloperConnectionCommandDeps({
          db,
          headers: request.headers,
        }),
        input: data,
      });
    } catch (error) {
      mapTanStackError(error);
    }
  });

export const startSentryDeveloperConnectionAuth = createServerFn({
  method: "POST",
})
  .inputValidator(startSentryDeveloperConnectionAuthCommand.input)
  .handler(async ({ data }) => {
    noStore();
    try {
      const request = await createTanStackDeveloperConnectionRequest();
      return await startSentryDeveloperConnectionAuthCommand.run({
        ctx: request.ctx,
        deps: createDefaultDeveloperConnectionCommandDeps({
          db,
          headers: request.headers,
        }),
        input: data,
      });
    } catch (error) {
      mapTanStackError(error);
    }
  });

export const completeSentryDeveloperConnectionAuth = createServerFn({
  method: "POST",
})
  .inputValidator(completeSentryDeveloperConnectionAuthCommand.input)
  .handler(async ({ data }) => {
    noStore();
    try {
      const request = await createTanStackDeveloperConnectionRequest();
      return await completeSentryDeveloperConnectionAuthCommand.run({
        ctx: request.ctx,
        deps: createDefaultDeveloperConnectionCommandDeps({
          db,
          headers: request.headers,
        }),
        input: data,
      });
    } catch (error) {
      mapTanStackError(error);
    }
  });

export const setDeveloperConnectionSandboxEnabled = createServerFn({
  method: "POST",
})
  .inputValidator(setDeveloperConnectionSandboxEnabledCommand.input)
  .handler(async ({ data }) => {
    noStore();
    try {
      const request = await createTanStackDeveloperConnectionRequest();
      return await setDeveloperConnectionSandboxEnabledCommand.run({
        ctx: request.ctx,
        deps: createDefaultDeveloperConnectionCommandDeps({
          db,
          headers: request.headers,
        }),
        input: data,
      });
    } catch (error) {
      mapTanStackError(error);
    }
  });

export const disconnectDeveloperConnection = createServerFn({ method: "POST" })
  .inputValidator(disconnectDeveloperConnectionCommand.input)
  .handler(async ({ data }) => {
    noStore();
    try {
      const request = await createTanStackDeveloperConnectionRequest();
      return await disconnectDeveloperConnectionCommand.run({
        ctx: request.ctx,
        deps: createDefaultDeveloperConnectionCommandDeps({
          db,
          headers: request.headers,
        }),
        input: data,
      });
    } catch (error) {
      mapTanStackError(error);
    }
  });

export type ListDeveloperConnectionsResult = Awaited<
  ReturnType<typeof listDeveloperConnections>
>;
