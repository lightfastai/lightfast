import type { Database } from "@db/app";
import {
  developerConnectionCompleteAuthInputSchema,
  developerConnectionConnectInputSchema,
  developerConnectionProviderInputSchema,
  developerConnectionProviderSchema,
  developerConnectionSetSandboxEnabledInputSchema,
  developerConnectionStartAuthInputSchema,
  developerConnectionStatusSchema,
} from "@repo/developer-connection-contract";
import { z } from "zod";

import type { AuthAccess, AuthIdentity } from "../../auth/identity";
import {
  completeSentryDeveloperConnectionAuth,
  connectDeveloperConnection,
  disconnectDeveloperConnection,
  listDeveloperConnectionsForOrg,
  setDeveloperConnectionSandboxEnabled,
  startSentryDeveloperConnectionAuth,
} from "../../services/developer-connections";
import type { Actor, ExecutionContext } from "../actor";
import { defineCommand } from "../command";
import {
  AuthzError,
  ConflictError,
  InternalDomainError,
  isDomainError,
  ValidationError,
} from "../errors";
import { requireBoundClerkOrgActor, requireClerkOrgAdminActor } from "../gates";

type ListDeveloperConnectionsResult = Awaited<
  ReturnType<typeof listDeveloperConnectionsForOrg>
>;

interface DeveloperConnectionServiceContext {
  auth: {
    access: Extract<AuthAccess, { kind: "clerk-session" }>;
    identity: Extract<AuthIdentity, { type: "active" }>;
  };
  db: Database;
  headers: Headers;
}

interface DeveloperConnectionCommandDeps {
  completeSentryDeveloperConnectionAuth: typeof completeSentryDeveloperConnectionAuth;
  connectDeveloperConnection: typeof connectDeveloperConnection;
  db: Database;
  disconnectDeveloperConnection: typeof disconnectDeveloperConnection;
  headers: Headers;
  listDeveloperConnectionsForOrg: typeof listDeveloperConnectionsForOrg;
  setDeveloperConnectionSandboxEnabled: typeof setDeveloperConnectionSandboxEnabled;
  startSentryDeveloperConnectionAuth: typeof startSentryDeveloperConnectionAuth;
}

export function createDefaultDeveloperConnectionCommandDeps(input: {
  completeSentryDeveloperConnectionAuth?: typeof completeSentryDeveloperConnectionAuth;
  connectDeveloperConnection?: typeof connectDeveloperConnection;
  db: Database;
  disconnectDeveloperConnection?: typeof disconnectDeveloperConnection;
  headers: Headers;
  listDeveloperConnectionsForOrg?: typeof listDeveloperConnectionsForOrg;
  setDeveloperConnectionSandboxEnabled?: typeof setDeveloperConnectionSandboxEnabled;
  startSentryDeveloperConnectionAuth?: typeof startSentryDeveloperConnectionAuth;
}): DeveloperConnectionCommandDeps {
  return {
    completeSentryDeveloperConnectionAuth:
      input.completeSentryDeveloperConnectionAuth ??
      completeSentryDeveloperConnectionAuth,
    connectDeveloperConnection:
      input.connectDeveloperConnection ?? connectDeveloperConnection,
    db: input.db,
    disconnectDeveloperConnection:
      input.disconnectDeveloperConnection ?? disconnectDeveloperConnection,
    headers: input.headers,
    listDeveloperConnectionsForOrg:
      input.listDeveloperConnectionsForOrg ?? listDeveloperConnectionsForOrg,
    setDeveloperConnectionSandboxEnabled:
      input.setDeveloperConnectionSandboxEnabled ??
      setDeveloperConnectionSandboxEnabled,
    startSentryDeveloperConnectionAuth:
      input.startSentryDeveloperConnectionAuth ??
      startSentryDeveloperConnectionAuth,
  };
}

const listDeveloperConnectionsInput = z.object({}).strict();
const listDeveloperConnectionsOutput = z.custom<ListDeveloperConnectionsResult>(
  (value) => Array.isArray(value)
);

const connectionMutationOutput = z.object({
  provider: developerConnectionProviderSchema,
  status: developerConnectionStatusSchema,
});

const startSentryAuthOutput = z.object({
  attemptId: z.string().min(1),
  expiresAt: z.date(),
  userCode: z.string().min(1),
  verificationUri: z.string().min(1),
});

const setSandboxEnabledOutput = z.object({
  enabled: z.boolean(),
});

const disconnectDeveloperConnectionOutput = z.object({
  disconnected: z.boolean(),
});

export const listDeveloperConnectionsCommand = defineCommand<
  "developerConnections.list",
  typeof listDeveloperConnectionsInput,
  typeof listDeveloperConnectionsOutput,
  DeveloperConnectionCommandDeps
>({
  name: "developerConnections.list",
  input: listDeveloperConnectionsInput,
  output: listDeveloperConnectionsOutput,
  run: async ({ ctx, deps }) => {
    const actor = requireBoundClerkOrgActor(ctx);
    try {
      return await deps.listDeveloperConnectionsForOrg(
        serviceContextForActor(actor, deps)
      );
    } catch (error) {
      throw mapDeveloperConnectionServiceError(
        error,
        "DEVELOPER_CONNECTION_LIST_FAILED",
        "Developer connections could not be loaded."
      );
    }
  },
});

export const connectDeveloperConnectionCommand = defineCommand<
  "developerConnections.connect",
  typeof developerConnectionConnectInputSchema,
  typeof connectionMutationOutput,
  DeveloperConnectionCommandDeps
>({
  name: "developerConnections.connect",
  input: developerConnectionConnectInputSchema,
  output: connectionMutationOutput,
  run: async ({ ctx, deps, input }) => {
    const actor = requireBoundClerkOrgAdminActor(ctx);
    try {
      return await deps.connectDeveloperConnection(
        serviceContextForActor(actor, deps),
        input
      );
    } catch (error) {
      throw mapDeveloperConnectionServiceError(
        error,
        "DEVELOPER_CONNECTION_CONNECT_FAILED",
        "Developer connection could not be saved."
      );
    }
  },
});

export const startSentryDeveloperConnectionAuthCommand = defineCommand<
  "developerConnections.startSentryAuth",
  typeof developerConnectionStartAuthInputSchema,
  typeof startSentryAuthOutput,
  DeveloperConnectionCommandDeps
>({
  name: "developerConnections.startSentryAuth",
  input: developerConnectionStartAuthInputSchema,
  output: startSentryAuthOutput,
  run: async ({ ctx, deps, input }) => {
    const actor = requireBoundClerkOrgAdminActor(ctx);
    try {
      return await deps.startSentryDeveloperConnectionAuth(
        serviceContextForActor(actor, deps),
        input
      );
    } catch (error) {
      throw mapDeveloperConnectionServiceError(
        error,
        "DEVELOPER_CONNECTION_SENTRY_AUTH_START_FAILED",
        "Sentry authorization could not be started."
      );
    }
  },
});

export const completeSentryDeveloperConnectionAuthCommand = defineCommand<
  "developerConnections.completeSentryAuth",
  typeof developerConnectionCompleteAuthInputSchema,
  typeof connectionMutationOutput,
  DeveloperConnectionCommandDeps
>({
  name: "developerConnections.completeSentryAuth",
  input: developerConnectionCompleteAuthInputSchema,
  output: connectionMutationOutput,
  run: async ({ ctx, deps, input }) => {
    const actor = requireBoundClerkOrgAdminActor(ctx);
    try {
      return await deps.completeSentryDeveloperConnectionAuth(
        serviceContextForActor(actor, deps),
        input
      );
    } catch (error) {
      throw mapDeveloperConnectionServiceError(
        error,
        "DEVELOPER_CONNECTION_SENTRY_AUTH_COMPLETE_FAILED",
        "Sentry authorization could not be completed."
      );
    }
  },
});

export const setDeveloperConnectionSandboxEnabledCommand = defineCommand<
  "developerConnections.setSandboxEnabled",
  typeof developerConnectionSetSandboxEnabledInputSchema,
  typeof setSandboxEnabledOutput,
  DeveloperConnectionCommandDeps
>({
  name: "developerConnections.setSandboxEnabled",
  input: developerConnectionSetSandboxEnabledInputSchema,
  output: setSandboxEnabledOutput,
  run: async ({ ctx, deps, input }) => {
    const actor = requireBoundClerkOrgAdminActor(ctx);
    try {
      return await deps.setDeveloperConnectionSandboxEnabled(
        serviceContextForActor(actor, deps),
        input
      );
    } catch (error) {
      throw mapDeveloperConnectionServiceError(
        error,
        "DEVELOPER_CONNECTION_SANDBOX_TOGGLE_FAILED",
        "Developer connection sandbox access could not be updated."
      );
    }
  },
});

export const disconnectDeveloperConnectionCommand = defineCommand<
  "developerConnections.disconnect",
  typeof developerConnectionProviderInputSchema,
  typeof disconnectDeveloperConnectionOutput,
  DeveloperConnectionCommandDeps
>({
  name: "developerConnections.disconnect",
  input: developerConnectionProviderInputSchema,
  output: disconnectDeveloperConnectionOutput,
  run: async ({ ctx, deps, input }) => {
    const actor = requireBoundClerkOrgAdminActor(ctx);
    try {
      return await deps.disconnectDeveloperConnection(
        serviceContextForActor(actor, deps),
        input
      );
    } catch (error) {
      throw mapDeveloperConnectionServiceError(
        error,
        "DEVELOPER_CONNECTION_DISCONNECT_FAILED",
        "Developer connection could not be disconnected."
      );
    }
  },
});

function serviceContextForActor(
  actor: Extract<Actor, { kind: "clerkUser" }> & {
    orgGate: NonNullable<Extract<Actor, { kind: "clerkUser" }>["orgGate"]>;
    orgId: string;
  },
  deps: DeveloperConnectionCommandDeps
): DeveloperConnectionServiceContext {
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

function mapDeveloperConnectionServiceError(
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
    return new ValidationError(
      "DEVELOPER_CONNECTION_INVALID_INPUT",
      message,
      {},
      options
    );
  }

  if (code === "PRECONDITION_FAILED") {
    return new ConflictError(
      "DEVELOPER_CONNECTION_PRECONDITION_FAILED",
      message,
      {},
      options
    );
  }

  return new InternalDomainError(fallbackCode, fallbackMessage, {}, options);
}
