import type { Database } from "@db/app";
import {
  type ConnectableConnectorProvider,
  type ConnectorProvider,
  connectableConnectorProviderSchema,
} from "@repo/api-contract";
import { z } from "zod";

import type { ExecutionContext } from "../actor";
import { defineCommand } from "../command";
import {
  AuthzError,
  ConflictError,
  InternalDomainError,
  isDomainError,
  NotFoundError,
  ValidationError,
} from "../errors";
import {
  type ClerkOrgAdminActor,
  requireActiveClerkOrgActor,
  requireBoundClerkOrgActor,
  requireClerkOrgAdminActor,
} from "../gates";

type ConnectAvailability =
  | { status: "available" }
  | {
      missing?: string[];
      reason: "coming_soon" | "missing_config" | "permission_required";
      status: "unavailable";
    };

interface DisplayConnectorTool {
  availableForAgents: boolean;
  availableForAutomations: boolean;
  description?: string;
  name: string;
}

interface ConnectorCatalogRow {
  availableForAgents: boolean;
  availableForAutomations: boolean;
  builder: "Lightfast";
  canManage: boolean;
  catalogStatus: "available" | "coming_soon";
  category: string;
  connectAvailability: ConnectAvailability;
  connection: {
    connectedAt: Date;
    enabledForAgents: boolean;
    enabledForAutomations: boolean;
    lastToolRefreshAt: Date | null;
    lastToolRefreshErrorAt: Date | null;
    lastToolRefreshErrorCode: string | null;
    missingScopes: string[];
    providerActorName: string | null;
    providerWorkspaceName: string | null;
    scopeStatus: "complete" | "missing_requested_scopes";
    status: "active" | "error" | "revoked";
    tools: DisplayConnectorTool[];
  } | null;
  description: string;
  displayName: string;
  provider: ConnectorProvider;
}

interface UserConnectorCatalogRow {
  builder: "Granola";
  canManage: boolean;
  catalogStatus: "available" | "coming_soon";
  category: string;
  connectAvailability: { status: "available" };
  connection: {
    availableForInteractiveChats: boolean;
    connectedAt: Date;
    lastToolRefreshAt: Date | null;
    lastToolRefreshErrorAt: Date | null;
    lastToolRefreshErrorCode: string | null;
    providerAccountName: string | null;
    status: "active" | "error" | "revoked";
    tools: Array<{
      availableForInteractiveChats: boolean;
      description?: string;
      name: string;
    }>;
  } | null;
  description: string;
  displayName: string;
  ownerType: "user";
  provider: "granola";
}

type ListConnectorsResult = ConnectorCatalogRow[];
type ListUserConnectorsResult = UserConnectorCatalogRow[];
interface StartConnectorOAuthResult {
  authorizationUrl: string;
  mode: string;
}
interface RefreshConnectorToolsResult {
  refreshed: boolean;
  status: string;
}

export interface ConnectorMutationServiceContext {
  actor: {
    userId: string;
  };
  db: Database;
  organization: {
    orgId: string;
  };
}

export interface ConnectorCommandDeps {
  db: Database;
  disconnectConnector(
    ctx: ConnectorMutationServiceContext,
    input: { provider: ConnectableConnectorProvider }
  ): Promise<{ disconnected: boolean }>;
  listConnectorsForOrg(input: {
    db: Database;
    organization: { orgId: string };
    viewer: { canManage: boolean };
  }): Promise<ListConnectorsResult>;
  listUserConnectorsForViewer(input: {
    db: Database;
    viewer: { userId: string };
  }): Promise<ListUserConnectorsResult>;
  refreshConnectorTools(
    ctx: ConnectorMutationServiceContext,
    input: { provider: ConnectableConnectorProvider }
  ): Promise<RefreshConnectorToolsResult>;
  setConnectorAgentEnabled(
    ctx: ConnectorMutationServiceContext,
    input: { enabled: boolean; provider: ConnectableConnectorProvider }
  ): Promise<{ enabled: boolean }>;
  setConnectorAutomationEnabled(
    ctx: ConnectorMutationServiceContext,
    input: { enabled: boolean; provider: ConnectableConnectorProvider }
  ): Promise<{ enabled: boolean }>;
  startConnectorOAuth(
    ctx: ConnectorMutationServiceContext,
    input: { provider: ConnectableConnectorProvider }
  ): Promise<StartConnectorOAuthResult>;
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
const connectorStartConnectInputSchema = z.object({
  provider: connectableConnectorProviderSchema,
});
const connectorProviderInputSchema = z.object({
  provider: connectableConnectorProviderSchema,
});
const connectorSetAutomationEnabledInputSchema = z.object({
  provider: connectableConnectorProviderSchema,
  enabled: z.boolean(),
});
const connectorSetAgentEnabledInputSchema = z.object({
  provider: connectableConnectorProviderSchema,
  enabled: z.boolean(),
});

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
      return await deps.listConnectorsForOrg({
        db: deps.db,
        organization: { orgId: actor.orgId },
        viewer: { canManage: actor.orgRole === "admin" },
      });
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
    try {
      return {
        teamConnectors: await deps.listConnectorsForOrg({
          db: deps.db,
          organization: { orgId: actor.orgId },
          viewer: { canManage: actor.orgRole === "admin" },
        }),
        yourConnectors: await deps.listUserConnectorsForViewer({
          db: deps.db,
          viewer: { userId: actor.userId },
        }),
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
  actor: ClerkOrgAdminActor,
  deps: ConnectorCommandDeps
): ConnectorMutationServiceContext {
  return {
    actor: { userId: actor.userId },
    db: deps.db,
    organization: { orgId: actor.orgId },
  };
}

function requireBoundClerkOrgAdminActor(ctx: ExecutionContext) {
  requireBoundClerkOrgActor(ctx);
  return requireClerkOrgAdminActor(ctx);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!(value && typeof value === "object" && !Array.isArray(value));
}

function mapConnectorServiceError(
  error: unknown,
  fallbackCode: string,
  fallbackMessage: string
) {
  if (isDomainError(error)) {
    return error;
  }

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
