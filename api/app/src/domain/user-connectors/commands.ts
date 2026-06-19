import type { Database } from "@db/app";
import { userConnectorProviderSchema } from "@repo/api-contract";
import { z } from "zod";

import type { AuthIdentity } from "../../auth/identity";
import {
  disconnectUserConnector,
  startUserConnectorOAuth,
} from "../../services/user-connectors";
import type { Actor } from "../actor";
import { defineCommand } from "../command";
import {
  AuthzError,
  InternalDomainError,
  isDomainError,
  ValidationError,
} from "../errors";
import { requireClerkUserActor } from "../gates";

interface UserConnectorServiceContext {
  auth: { identity: Exclude<AuthIdentity, { type: "unauthenticated" }> };
  db: Database;
  headers: Headers;
}

interface UserConnectorCommandDeps {
  db: Database;
  disconnectUserConnector: typeof disconnectUserConnector;
  headers: Headers;
  startUserConnectorOAuth: typeof startUserConnectorOAuth;
}

export function createDefaultUserConnectorCommandDeps(input: {
  db: Database;
  disconnectUserConnector?: typeof disconnectUserConnector;
  headers: Headers;
  startUserConnectorOAuth?: typeof startUserConnectorOAuth;
}): UserConnectorCommandDeps {
  return {
    db: input.db,
    disconnectUserConnector:
      input.disconnectUserConnector ?? disconnectUserConnector,
    headers: input.headers,
    startUserConnectorOAuth:
      input.startUserConnectorOAuth ?? startUserConnectorOAuth,
  };
}

const startUserConnectorOutput = z.object({
  authorizationUrl: z.string().url(),
  mode: z.enum(["connect", "reconnect"]),
});

const disconnectUserConnectorOutput = z.object({
  disconnected: z.boolean(),
});
const userConnectorStartConnectInputSchema = z.object({
  provider: userConnectorProviderSchema,
});
const userConnectorProviderInputSchema = z.object({
  provider: userConnectorProviderSchema,
});

export const startUserConnectorCommand = defineCommand<
  "userConnectors.start",
  typeof userConnectorStartConnectInputSchema,
  typeof startUserConnectorOutput,
  UserConnectorCommandDeps
>({
  name: "userConnectors.start",
  input: userConnectorStartConnectInputSchema,
  output: startUserConnectorOutput,
  run: async ({ ctx, deps, input }) => {
    const actor = requireClerkUserActor(ctx);

    try {
      return await deps.startUserConnectorOAuth(
        serviceContextForActor(actor, deps),
        input
      );
    } catch (error) {
      throw mapUserConnectorServiceError(
        error,
        "USER_CONNECTOR_START_FAILED",
        "User connector authorization could not be started."
      );
    }
  },
});

export const disconnectUserConnectorCommand = defineCommand<
  "userConnectors.disconnect",
  typeof userConnectorProviderInputSchema,
  typeof disconnectUserConnectorOutput,
  UserConnectorCommandDeps
>({
  name: "userConnectors.disconnect",
  input: userConnectorProviderInputSchema,
  output: disconnectUserConnectorOutput,
  run: async ({ ctx, deps, input }) => {
    const actor = requireClerkUserActor(ctx);

    try {
      return await deps.disconnectUserConnector(
        serviceContextForActor(actor, deps),
        input
      );
    } catch (error) {
      throw mapUserConnectorServiceError(
        error,
        "USER_CONNECTOR_DISCONNECT_FAILED",
        "User connector could not be disconnected."
      );
    }
  },
});

function serviceContextForActor(
  actor: Extract<Actor, { kind: "clerkUser" }>,
  deps: UserConnectorCommandDeps
): UserConnectorServiceContext {
  return {
    auth: { identity: identityForActor(actor) },
    db: deps.db,
    headers: deps.headers,
  };
}

function identityForActor(
  actor: Extract<Actor, { kind: "clerkUser" }>
): Exclude<AuthIdentity, { type: "unauthenticated" }> {
  if (actor.orgId && actor.orgGate) {
    return {
      type: "active",
      userId: actor.userId,
      orgId: actor.orgId,
      orgGate: actor.orgGate,
    };
  }

  return {
    type: "pending",
    userId: actor.userId,
  };
}

function mapUserConnectorServiceError(
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

  if (code === "UNAUTHORIZED") {
    return new AuthzError(
      "AUTH_REQUIRED",
      "Authentication required. Please sign in.",
      {},
      error instanceof Error ? { cause: error } : undefined
    );
  }

  if (code === "BAD_REQUEST") {
    return new ValidationError(
      "USER_CONNECTOR_UNSUPPORTED_PROVIDER",
      error instanceof Error ? error.message : "Unsupported user connector.",
      {},
      error instanceof Error ? { cause: error } : undefined
    );
  }

  return new InternalDomainError(
    fallbackCode,
    fallbackMessage,
    {},
    error instanceof Error ? { cause: error } : undefined
  );
}
