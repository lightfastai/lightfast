import type { Database } from "@db/app";
import { z } from "zod";

import type { Actor } from "../actor";
import { defineCommand } from "../command";
import {
  AuthzError,
  InternalDomainError,
  isDomainError,
  ValidationError,
} from "../errors";
import { requireClerkUserActor } from "../gates";

interface UserConnectorRequestContext {
  referer?: string | null;
}

interface UserConnectorServiceContext {
  db: Database;
  request: UserConnectorRequestContext;
  viewer: { userId: string };
}

export interface UserConnectorCommandDeps {
  db: Database;
  disconnectGranolaUserConnector: (
    ctx: UserConnectorServiceContext
  ) => Promise<{ disconnected: boolean }>;
  request: UserConnectorRequestContext;
  startGranolaUserConnectorOAuth: (
    ctx: UserConnectorServiceContext
  ) => Promise<{ authorizationUrl: string; mode: "connect" | "reconnect" }>;
}

const startUserConnectorOutput = z.object({
  authorizationUrl: z.string().url(),
  mode: z.enum(["connect", "reconnect"]),
});

const disconnectUserConnectorOutput = z.object({
  disconnected: z.boolean(),
});
const userConnectorStartConnectInputSchema = z.object({
  provider: z.literal("granola"),
});
const userConnectorProviderInputSchema = z.object({
  provider: z.literal("granola"),
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
  run: async ({ ctx, deps }) => {
    const actor = requireClerkUserActor(ctx);

    try {
      return await deps.startGranolaUserConnectorOAuth(
        serviceContextForActor(actor, deps)
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
  run: async ({ ctx, deps }) => {
    const actor = requireClerkUserActor(ctx);

    try {
      return await deps.disconnectGranolaUserConnector(
        serviceContextForActor(actor, deps)
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
    db: deps.db,
    request: deps.request,
    viewer: { userId: actor.userId },
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
