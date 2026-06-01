import { resolveLinearEndpoints, type LinearEndpoints } from "@repo/linear-app-node";
import { TRPCError } from "@trpc/server";

import { env as runtimeEnv } from "../../env";

export const LINEAR_OAUTH_CALLBACK_PATH = "/api/connectors/linear/callback";

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

interface LinearConnectorConfigEnv {
  LINEAR_API_ORIGIN?: string;
  LINEAR_CLIENT_ID?: string;
  LINEAR_CLIENT_SECRET?: string;
  LINEAR_MCP_ENDPOINT?: string;
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
  if (!clientId || !clientSecret) {
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
