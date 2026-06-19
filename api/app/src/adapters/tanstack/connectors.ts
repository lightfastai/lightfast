import { db } from "@db/app/client";
import { createServerFn } from "@tanstack/react-start";
import { getRequest, setResponseHeader } from "@tanstack/react-start/server";
import type { z } from "zod";

import { resolveAuthContextFromClerk } from "../../auth/identity";
import type { Actor } from "../../domain";
import { actorFromAuthIdentity, isDomainError } from "../../domain";
import {
  createDefaultConnectorCommandDeps,
  disconnectConnectorCommand,
  listConnectorSectionsCommand,
  listConnectorsCommand,
  refreshConnectorToolsCommand,
  setConnectorAgentEnabledCommand,
  setConnectorAutomationEnabledCommand,
  startConnectorOAuthCommand,
} from "../../domain/connectors";

export type StartConnectorInput = z.input<
  typeof startConnectorOAuthCommand.input
>;
export type RefreshConnectorToolsInput = z.input<
  typeof refreshConnectorToolsCommand.input
>;
export type SetConnectorAutomationEnabledInput = z.input<
  typeof setConnectorAutomationEnabledCommand.input
>;
export type SetConnectorAgentEnabledInput = z.input<
  typeof setConnectorAgentEnabledCommand.input
>;
export type DisconnectConnectorInput = z.input<
  typeof disconnectConnectorCommand.input
>;

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

async function createTanStackConnectorRequest() {
  const request = getRequest();
  const headers = new Headers(request.headers);
  const auth = await resolveAuthContextFromClerk({ db, headers });
  const actor = actorFromAuthIdentity(auth.identity, "web");

  return {
    ctx: {
      actor: maybeMarkOrgAdmin({ actor, auth }),
      request: { id: requestId(), source: "tanstack" as const },
    },
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

function deps() {
  return createDefaultConnectorCommandDeps({
    db,
  });
}

export const listConnectors = createServerFn({ method: "GET" }).handler(
  async () => {
    noStore();
    try {
      const request = await createTanStackConnectorRequest();
      return await listConnectorsCommand.run({
        ctx: request.ctx,
        deps: deps(),
        input: {},
      });
    } catch (error) {
      mapTanStackError(error);
    }
  }
);

export const listConnectorSections = createServerFn({ method: "GET" }).handler(
  async () => {
    noStore();
    try {
      const request = await createTanStackConnectorRequest();
      return await listConnectorSectionsCommand.run({
        ctx: request.ctx,
        deps: deps(),
        input: {},
      });
    } catch (error) {
      mapTanStackError(error);
    }
  }
);

export const startConnector = createServerFn({ method: "POST" })
  .inputValidator(startConnectorOAuthCommand.input)
  .handler(async ({ data }) => {
    noStore();
    try {
      const request = await createTanStackConnectorRequest();
      return await startConnectorOAuthCommand.run({
        ctx: request.ctx,
        deps: deps(),
        input: data,
      });
    } catch (error) {
      mapTanStackError(error);
    }
  });

export const refreshConnectorTools = createServerFn({ method: "POST" })
  .inputValidator(refreshConnectorToolsCommand.input)
  .handler(async ({ data }) => {
    noStore();
    try {
      const request = await createTanStackConnectorRequest();
      const result = await refreshConnectorToolsCommand.run({
        ctx: request.ctx,
        deps: deps(),
        input: data,
      });
      return {
        refreshed: result.refreshed,
        status: result.status,
      };
    } catch (error) {
      mapTanStackError(error);
    }
  });

export const setConnectorAutomationEnabled = createServerFn({ method: "POST" })
  .inputValidator(setConnectorAutomationEnabledCommand.input)
  .handler(async ({ data }) => {
    noStore();
    try {
      const request = await createTanStackConnectorRequest();
      return await setConnectorAutomationEnabledCommand.run({
        ctx: request.ctx,
        deps: deps(),
        input: data,
      });
    } catch (error) {
      mapTanStackError(error);
    }
  });

export const setConnectorAgentEnabled = createServerFn({ method: "POST" })
  .inputValidator(setConnectorAgentEnabledCommand.input)
  .handler(async ({ data }) => {
    noStore();
    try {
      const request = await createTanStackConnectorRequest();
      return await setConnectorAgentEnabledCommand.run({
        ctx: request.ctx,
        deps: deps(),
        input: data,
      });
    } catch (error) {
      mapTanStackError(error);
    }
  });

export const disconnectConnector = createServerFn({ method: "POST" })
  .inputValidator(disconnectConnectorCommand.input)
  .handler(async ({ data }) => {
    noStore();
    try {
      const request = await createTanStackConnectorRequest();
      return await disconnectConnectorCommand.run({
        ctx: request.ctx,
        deps: deps(),
        input: data,
      });
    } catch (error) {
      mapTanStackError(error);
    }
  });

export type ListConnectorsResult = Awaited<ReturnType<typeof listConnectors>>;
export type ConnectorSectionsResult = Awaited<
  ReturnType<typeof listConnectorSections>
>;
export type StartConnectorResult = Awaited<ReturnType<typeof startConnector>>;
