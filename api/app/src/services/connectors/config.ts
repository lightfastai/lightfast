import {
  type LinearEndpoints,
  resolveLinearEndpoints,
} from "@repo/linear-app-node";
import { resolveXEndpoints, type XEndpoints } from "@repo/x-app-node";
import { TRPCError } from "@trpc/server";

import { env as runtimeEnv } from "../../env";

export const LINEAR_OAUTH_CALLBACK_PATH =
  "/api/connectors/linear/oauth/callback";
export const X_OAUTH_CALLBACK_PATH = "/api/connectors/x/oauth/callback";

export interface LinearConnectorConfig {
  appOrigin: string;
  clientId: string;
  clientSecret: string;
  endpoints: LinearEndpoints;
}

export type LinearConnectorConfigResult =
  | { status: "configured"; config: LinearConnectorConfig }
  | {
      status: "missing_config";
      missing: Array<"LINEAR_CLIENT_ID" | "LINEAR_CLIENT_SECRET">;
    };

export interface XConnectorConfig {
  appOrigin: string;
  clientId: string;
  clientSecret: string;
  endpoints: XEndpoints;
}

export type XConnectorConfigResult =
  | { status: "configured"; config: XConnectorConfig }
  | {
      status: "missing_config";
      missing: Array<"X_CLIENT_ID" | "X_CLIENT_SECRET">;
    };

interface LinearConnectorConfigEnv {
  LINEAR_API_ORIGIN?: string;
  LINEAR_CLIENT_ID?: string;
  LINEAR_CLIENT_SECRET?: string;
  LINEAR_MCP_ENDPOINT?: string;
}

interface XConnectorConfigEnv {
  X_API_ORIGIN?: string;
  X_CLIENT_ID?: string;
  X_CLIENT_SECRET?: string;
  X_MCP_ENDPOINT?: string;
  X_OAUTH_ORIGIN?: string;
}

export function resolveConnectorAppOrigin(input: { appUrl?: string } = {}) {
  const appUrl = input.appUrl ?? process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) {
    throw new Error(
      "NEXT_PUBLIC_APP_URL is required for connector callback URL resolution."
    );
  }
  return new URL(appUrl).origin;
}

export function getLinearConnectorConfig(
  input: {
    appOrigin?: string;
    appUrl?: string;
    env?: LinearConnectorConfigEnv;
    nodeEnv?: string;
  } = {}
): LinearConnectorConfigResult {
  const configEnv = input.env ?? runtimeEnv;
  const clientId = configEnv.LINEAR_CLIENT_ID;
  const clientSecret = configEnv.LINEAR_CLIENT_SECRET;
  const missing: Array<"LINEAR_CLIENT_ID" | "LINEAR_CLIENT_SECRET"> = [];

  if (!clientId) {
    missing.push("LINEAR_CLIENT_ID");
  }
  if (!clientSecret) {
    missing.push("LINEAR_CLIENT_SECRET");
  }
  if (!(clientId && clientSecret)) {
    return { status: "missing_config", missing };
  }

  const endpointOverrides = {
    ...(configEnv.LINEAR_API_ORIGIN
      ? {
          apiOrigin: configEnv.LINEAR_API_ORIGIN,
          appOrigin: configEnv.LINEAR_API_ORIGIN,
        }
      : {}),
    ...(configEnv.LINEAR_MCP_ENDPOINT
      ? { mcpEndpoint: configEnv.LINEAR_MCP_ENDPOINT }
      : {}),
  };

  return {
    status: "configured",
    config: {
      appOrigin:
        input.appOrigin ?? resolveConnectorAppOrigin({ appUrl: input.appUrl }),
      clientId,
      clientSecret,
      endpoints: resolveLinearEndpoints({
        endpointOverrides,
        nodeEnv: input.nodeEnv,
      }),
    },
  };
}

export function requireLinearConnectorConfig(
  input: Parameters<typeof getLinearConnectorConfig>[0] = {}
): LinearConnectorConfig {
  const result = getLinearConnectorConfig(input);
  if (result.status === "configured") {
    return result.config;
  }

  throw new TRPCError({
    code: "PRECONDITION_FAILED",
    message: "Linear connector is not configured.",
    cause: result,
  });
}

export function getXConnectorConfig(
  input: {
    appOrigin?: string;
    appUrl?: string;
    env?: XConnectorConfigEnv;
    nodeEnv?: string;
  } = {}
): XConnectorConfigResult {
  const configEnv = input.env ?? runtimeEnv;
  const clientId = configEnv.X_CLIENT_ID;
  const clientSecret = configEnv.X_CLIENT_SECRET;
  const missing: Array<"X_CLIENT_ID" | "X_CLIENT_SECRET"> = [];

  if (!clientId) {
    missing.push("X_CLIENT_ID");
  }
  if (!clientSecret) {
    missing.push("X_CLIENT_SECRET");
  }
  if (!(clientId && clientSecret)) {
    return { status: "missing_config", missing };
  }

  const appOrigin =
    input.appOrigin ?? resolveConnectorAppOrigin({ appUrl: input.appUrl });
  const endpointOverrides = {
    ...(configEnv.X_API_ORIGIN ? { apiOrigin: configEnv.X_API_ORIGIN } : {}),
    ...(configEnv.X_OAUTH_ORIGIN
      ? { oauthOrigin: configEnv.X_OAUTH_ORIGIN }
      : {}),
    ...(configEnv.X_MCP_ENDPOINT
      ? { mcpEndpoint: configEnv.X_MCP_ENDPOINT }
      : {}),
  };

  return {
    status: "configured",
    config: {
      appOrigin,
      clientId,
      clientSecret,
      endpoints: resolveXEndpoints({
        appOrigin,
        endpointOverrides,
        nodeEnv: input.nodeEnv,
      }),
    },
  };
}

export function requireXConnectorConfig(
  input: Parameters<typeof getXConnectorConfig>[0] = {}
): XConnectorConfig {
  const result = getXConnectorConfig(input);
  if (result.status === "configured") {
    return result.config;
  }

  throw new TRPCError({
    code: "PRECONDITION_FAILED",
    message: "X connector is not configured.",
    cause: result,
  });
}
