import type { Database } from "@db/app";
import {
  connectorProviderInputSchema,
  connectorSetAgentEnabledInputSchema,
  connectorSetAutomationEnabledInputSchema,
  connectorStartConnectInputSchema,
} from "@repo/connector-contract";
import { z } from "zod";

import type { AuthAccess, AuthIdentity } from "../../auth/identity";
import {
  disconnectConnector,
  listConnectorsForOrg,
  refreshConnectorTools,
  setConnectorAgentEnabled,
  setConnectorAutomationEnabled,
  startConnectorOAuth,
} from "../../services/connectors";
import { listUserConnectorsForViewer } from "../../services/user-connectors";
import type { Actor, ExecutionContext } from "../actor";
import { defineCommand } from "../command";
import {
  AuthzError,
  ConflictError,
  InternalDomainError,
  NotFoundError,
  ValidationError,
} from "../errors";
import {
  requireActiveClerkOrgActor,
  requireBoundClerkOrgActor,
  requireClerkOrgAdminActor,
} from "../gates";

type ListConnectorsResult = Awaited<ReturnType<typeof listConnectorsForOrg>>;
type ListUserConnectorsResult = Awaited<
  ReturnType<typeof listUserConnectorsForViewer>
>;
type StartConnectorOAuthResult = Awaited<
  ReturnType<typeof startConnectorOAuth>
>;
type RefreshConnectorToolsResult = Awaited<
  ReturnType<typeof refreshConnectorTools>
>;

interface ConnectorServiceContext {
  auth: {
    access: Extract<AuthAccess, { kind: "clerk-session" }>;
    identity: Extract<AuthIdentity, { type: "active" }>;
  };
  db: Database;
  headers: Headers;
}

interface ConnectorCommandDeps {
  db: Database;
  disconnectConnector: typeof disconnectConnector;
  headers: Headers;
  listConnectorsForOrg: typeof listConnectorsForOrg;
  listUserConnectorsForViewer: typeof listUserConnectorsForViewer;
  refreshConnectorTools: typeof refreshConnectorTools;
  setConnectorAgentEnabled: typeof setConnectorAgentEnabled;
  setConnectorAutomationEnabled: typeof setConnectorAutomationEnabled;
  startConnectorOAuth: typeof startConnectorOAuth;
}

export function createDefaultConnectorCommandDeps(input: {
  db: Database;
  disconnectConnector?: typeof disconnectConnector;
  headers: Headers;
  listConnectorsForOrg?: typeof listConnectorsForOrg;
  listUserConnectorsForViewer?: typeof listUserConnectorsForViewer;
  refreshConnectorTools?: typeof refreshConnectorTools;
  setConnectorAgentEnabled?: typeof setConnectorAgentEnabled;
  setConnectorAutomationEnabled?: typeof setConnectorAutomationEnabled;
  startConnectorOAuth?: typeof startConnectorOAuth;
}): ConnectorCommandDeps {
  return {
    db: input.db,
    disconnectConnector: input.disconnectConnector ?? disconnectConnector,
    headers: input.headers,
    listConnectorsForOrg: input.listConnectorsForOrg ?? listConnectorsForOrg,
    listUserConnectorsForViewer:
      input.listUserConnectorsForViewer ?? listUserConnectorsForViewer,
    refreshConnectorTools: input.refreshConnectorTools ?? refreshConnectorTools,
    setConnectorAgentEnabled:
      input.setConnectorAgentEnabled ?? setConnectorAgentEnabled,
    setConnectorAutomationEnabled:
      input.setConnectorAutomationEnabled ?? setConnectorAutomationEnabled,
    startConnectorOAuth: input.startConnectorOAuth ?? startConnectorOAuth,
  };
}

const emptyInput = z.object({}).strict();
const listConnectorsOutput = z.custom<ListConnectorsResult>((value) =>
  Array.isArray(value)
);
const listConnectorSectionsOutput = z.object({
  teamConnectors: z.custom<ListConnectorsResult>((value) =>
    Array.isArray(value)
  ),
  yourConnectors: z.custom<ListUserConnectorsResult>((value) =>
    Array.isArray(value)
  ),
});
const startConnectorOAuthOutput = z.custom<StartConnectorOAuthResult>(isRecord);
const refreshConnectorToolsOutput =
  z.custom<RefreshConnectorToolsResult>(isRecord);
const booleanFlagOutput = z.object({ enabled: z.boolean() });
const disconnectConnectorOutput = z.object({ disconnected: z.boolean() });

export const listConnectorsCommand = defineCommand<
  "connectors.list",
  typeof emptyInput,
  typeof listConnectorsOutput,
  ConnectorCommandDeps
>({
  name: "connectors.list",
  input: emptyInput,
  output: listConnectorsOutput,
  run: async ({ ctx, deps }) => {
    const actor = requireActiveClerkOrgActor(ctx);
    try {
      return await deps.listConnectorsForOrg(
        serviceContextForActor(actor, deps)
      );
    } catch (error) {
      throw mapConnectorServiceError(
        error,
        "CONNECTOR_LIST_FAILED",
        "Connectors could not be loaded."
      );
    }
  },
});

export const listConnectorSectionsCommand = defineCommand<
  "connectors.listSections",
  typeof emptyInput,
  typeof listConnectorSectionsOutput,
  ConnectorCommandDeps
>({
  name: "connectors.listSections",
  input: emptyInput,
  output: listConnectorSectionsOutput,
  run: async ({ ctx, deps }) => {
    const actor = requireActiveClerkOrgActor(ctx);
    const serviceContext = serviceContextForActor(actor, deps);
    try {
      return {
        teamConnectors: await deps.listConnectorsForOrg(serviceContext),
        yourConnectors: await deps.listUserConnectorsForViewer(serviceContext),
      };
    } catch (error) {
      throw mapConnectorServiceError(
        error,
        "CONNECTOR_SECTIONS_LIST_FAILED",
        "Connector sections could not be loaded."
      );
    }
  },
});

export const startConnectorOAuthCommand = defineCommand<
  "connectors.start",
  typeof connectorStartConnectInputSchema,
  typeof startConnectorOAuthOutput,
  ConnectorCommandDeps
>({
  name: "connectors.start",
  input: connectorStartConnectInputSchema,
  output: startConnectorOAuthOutput,
  run: async ({ ctx, deps, input }) => {
    const actor = requireClerkOrgAdminActor(ctx);
    try {
      return await deps.startConnectorOAuth(
        serviceContextForActor(actor, deps),
        input
      );
    } catch (error) {
      throw mapConnectorServiceError(
        error,
        "CONNECTOR_OAUTH_START_FAILED",
        "Connector authorization could not be started."
      );
    }
  },
});

export const refreshConnectorToolsCommand = defineCommand<
  "connectors.refreshTools",
  typeof connectorProviderInputSchema,
  typeof refreshConnectorToolsOutput,
  ConnectorCommandDeps
>({
  name: "connectors.refreshTools",
  input: connectorProviderInputSchema,
  output: refreshConnectorToolsOutput,
  run: async ({ ctx, deps, input }) => {
    const actor = requireBoundClerkOrgAdminActor(ctx);
    try {
      return await deps.refreshConnectorTools(
        serviceContextForActor(actor, deps),
        input
      );
    } catch (error) {
      throw mapConnectorServiceError(
        error,
        "CONNECTOR_TOOLS_REFRESH_FAILED",
        "Connector tools could not be refreshed."
      );
    }
  },
});

export const setConnectorAutomationEnabledCommand = defineCommand<
  "connectors.setAutomationEnabled",
  typeof connectorSetAutomationEnabledInputSchema,
  typeof booleanFlagOutput,
  ConnectorCommandDeps
>({
  name: "connectors.setAutomationEnabled",
  input: connectorSetAutomationEnabledInputSchema,
  output: booleanFlagOutput,
  run: async ({ ctx, deps, input }) => {
    const actor = requireBoundClerkOrgAdminActor(ctx);
    try {
      return await deps.setConnectorAutomationEnabled(
        serviceContextForActor(actor, deps),
        input
      );
    } catch (error) {
      throw mapConnectorServiceError(
        error,
        "CONNECTOR_AUTOMATION_TOGGLE_FAILED",
        "Connector automation access could not be updated."
      );
    }
  },
});

export const setConnectorAgentEnabledCommand = defineCommand<
  "connectors.setAgentEnabled",
  typeof connectorSetAgentEnabledInputSchema,
  typeof booleanFlagOutput,
  ConnectorCommandDeps
>({
  name: "connectors.setAgentEnabled",
  input: connectorSetAgentEnabledInputSchema,
  output: booleanFlagOutput,
  run: async ({ ctx, deps, input }) => {
    const actor = requireBoundClerkOrgAdminActor(ctx);
    try {
      return await deps.setConnectorAgentEnabled(
        serviceContextForActor(actor, deps),
        input
      );
    } catch (error) {
      throw mapConnectorServiceError(
        error,
        "CONNECTOR_AGENT_TOGGLE_FAILED",
        "Connector agent access could not be updated."
      );
    }
  },
});

export const disconnectConnectorCommand = defineCommand<
  "connectors.disconnect",
  typeof connectorProviderInputSchema,
  typeof disconnectConnectorOutput,
  ConnectorCommandDeps
>({
  name: "connectors.disconnect",
  input: connectorProviderInputSchema,
  output: disconnectConnectorOutput,
  run: async ({ ctx, deps, input }) => {
    const actor = requireBoundClerkOrgAdminActor(ctx);
    try {
      return await deps.disconnectConnector(
        serviceContextForActor(actor, deps),
        input
      );
    } catch (error) {
      throw mapConnectorServiceError(
        error,
        "CONNECTOR_DISCONNECT_FAILED",
        "Connector could not be disconnected."
      );
    }
  },
});

function serviceContextForActor(
  actor: Extract<Actor, { kind: "clerkUser" }> & {
    orgGate: NonNullable<Extract<Actor, { kind: "clerkUser" }>["orgGate"]>;
    orgId: string;
  },
  deps: ConnectorCommandDeps
): ConnectorServiceContext {
  return {
    auth: {
      access: accessForActor(actor),
      identity: {
        type: "active",
        userId: actor.userId,
        orgId: actor.orgId,
        orgGate: actor.orgGate,
      },
    },
    db: deps.db,
    headers: deps.headers,
  };
}

function requireBoundClerkOrgAdminActor(ctx: ExecutionContext) {
  requireBoundClerkOrgActor(ctx);
  return requireClerkOrgAdminActor(ctx);
}

function accessForActor(
  actor: Extract<Actor, { kind: "clerkUser" }> & { orgId: string }
): Extract<AuthAccess, { kind: "clerk-session" }> {
  const has = ((params: { role?: string }) =>
    actor.orgRole === "admin" && params.role === "org:admin") as Extract<
    AuthAccess,
    { kind: "clerk-session" }
  >["has"];

  return {
    kind: "clerk-session",
    userId: actor.userId,
    orgId: actor.orgId,
    has,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!(value && typeof value === "object" && !Array.isArray(value));
}

function mapConnectorServiceError(
  error: unknown,
  fallbackCode: string,
  fallbackMessage: string
) {
  const code =
    error && typeof error === "object" && "code" in error
      ? String(error.code)
      : undefined;
  const message =
    error instanceof Error && error.message ? error.message : fallbackMessage;
  const options = error instanceof Error ? { cause: error } : undefined;

  if (code === "UNAUTHORIZED") {
    return new AuthzError(
      "AUTH_REQUIRED",
      "Authentication required. Please sign in.",
      {},
      options
    );
  }

  if (code === "FORBIDDEN") {
    return new AuthzError(
      "PERMISSION_REQUIRED",
      "Only organization administrators can perform this action.",
      {},
      options
    );
  }

  if (code === "BAD_REQUEST") {
    return new ValidationError("CONNECTOR_INVALID_INPUT", message, {}, options);
  }

  if (code === "NOT_FOUND") {
    return new NotFoundError("CONNECTOR_NOT_FOUND", message, {}, options);
  }

  if (code === "PRECONDITION_FAILED") {
    return new ConflictError(
      "CONNECTOR_PRECONDITION_FAILED",
      message,
      {},
      options
    );
  }

  return new InternalDomainError(fallbackCode, fallbackMessage, {}, options);
}
