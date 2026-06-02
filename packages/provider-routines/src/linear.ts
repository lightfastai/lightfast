import {
  getCurrentOrgConnectorConnection,
  type OrgConnectorConnection,
  updateObservedConnectorTokens,
} from "@db/app";
import { decrypt, encrypt } from "@repo/app-encryption";
import type {
  LinearProviderRoutineAdapter,
  ProviderRoutineServiceContext,
} from "./context";

const LINEAR_APP_NODE_PACKAGE: string = "@repo/linear-app-node";

interface LinearEndpoints {
  mcpEndpoint: string;
  oauthRevokeUrl: string;
  oauthTokenUrl: string;
}

interface LinearTokenSet {
  accessToken: string;
  accessTokenExpiresIn?: number;
  refreshToken?: string;
  refreshTokenExpiresIn?: number;
}

interface LinearAppNodeModule {
  callLinearMcpTool(input: {
    accessToken: string;
    endpoint: string;
    input?: Record<string, unknown>;
    name: string;
  }): Promise<unknown>;
  refreshLinearOAuthToken(input: {
    clientId: string;
    clientSecret: string;
    refreshToken: string;
    refreshTokenExpiresIn?: number;
    tokenUrl: string;
  }): Promise<LinearTokenSet>;
  resolveLinearEndpoints(input: {
    endpointOverrides?: {
      apiOrigin?: string;
      appOrigin?: string;
      mcpEndpoint?: string;
    };
    nodeEnv?: string;
  }): LinearEndpoints;
  revokeLinearOAuthToken(input: {
    clientId: string;
    clientSecret: string;
    revokeUrl: string;
    token: string;
  }): Promise<void>;
}

interface LinearProviderRoutineConfig {
  clientId: string;
  clientSecret: string;
  encryptionKey: string;
  endpoints: LinearEndpoints;
}

export const defaultLinearProviderRoutineAdapter: LinearProviderRoutineAdapter =
  {
    async callTool(input) {
      const linear = await linearAppNode();
      return await linear.callLinearMcpTool({
        accessToken: input.accessToken,
        endpoint: input.connection.mcpEndpoint,
        input: input.input,
        name: input.providerToolName,
      });
    },
    async getAccessToken(input) {
      return await getFreshLinearAccessToken({
        connection: input.connection,
        db: input.db,
        log: input.log,
        now: input.now,
      });
    },
  };

async function configFromEnv(): Promise<LinearProviderRoutineConfig> {
  const linear = await linearAppNode();
  const clientId = process.env.LINEAR_CLIENT_ID;
  const clientSecret = process.env.LINEAR_CLIENT_SECRET;
  const encryptionKey = process.env.ENCRYPTION_KEY;

  if (!(clientId && clientSecret && encryptionKey)) {
    throw linearError(
      "LINEAR_TOKEN_REFRESH_FAILED",
      "Linear connector config is missing."
    );
  }

  return {
    clientId,
    clientSecret,
    encryptionKey,
    endpoints: linear.resolveLinearEndpoints({
      endpointOverrides: {
        ...(process.env.LINEAR_API_ORIGIN
          ? {
              apiOrigin: process.env.LINEAR_API_ORIGIN,
              appOrigin: process.env.LINEAR_API_ORIGIN,
            }
          : {}),
        ...(process.env.LINEAR_MCP_ENDPOINT
          ? { mcpEndpoint: process.env.LINEAR_MCP_ENDPOINT }
          : {}),
      },
      nodeEnv: process.env.NODE_ENV,
    }),
  };
}

async function getFreshLinearAccessToken(input: {
  connection: OrgConnectorConnection;
  db: ProviderRoutineServiceContext["db"];
  log: ProviderRoutineServiceContext["log"];
  now: () => Date;
}) {
  const config = await configFromEnv();
  const linear = await linearAppNode();

  if (!input.connection.encryptedAccessToken) {
    throw linearError(
      "LINEAR_TOKEN_REFRESH_FAILED",
      "Linear connector access token is missing."
    );
  }

  if (!shouldRefreshAccessToken(input.connection, input.now())) {
    return await decrypt(
      input.connection.encryptedAccessToken,
      config.encryptionKey
    );
  }

  if (!input.connection.encryptedRefreshToken) {
    throw linearError(
      "LINEAR_TOKEN_REFRESH_FAILED",
      "Linear connector refresh token is missing."
    );
  }

  const refreshToken = await decrypt(
    input.connection.encryptedRefreshToken,
    config.encryptionKey
  );
  const refreshed = await linear.refreshLinearOAuthToken({
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    refreshToken,
    refreshTokenExpiresIn: input.connection.refreshTokenExpiresAt
      ? Math.max(
          1,
          Math.floor(
            (input.connection.refreshTokenExpiresAt.getTime() -
              input.now().getTime()) /
              1000
          )
        )
      : undefined,
    tokenUrl: config.endpoints.oauthTokenUrl,
  });

  const encryptedAccessToken = await encrypt(
    refreshed.accessToken,
    config.encryptionKey
  );
  const encryptedRefreshToken = refreshed.refreshToken
    ? await encrypt(refreshed.refreshToken, config.encryptionKey)
    : null;

  const updated = await updateObservedConnectorTokens(input.db, {
    accessTokenExpiresAt: expiresAtFromSeconds(
      refreshed.accessTokenExpiresIn,
      input.now()
    ),
    clerkOrgId: input.connection.clerkOrgId,
    encryptedAccessToken,
    encryptedRefreshToken,
    id: input.connection.id,
    observedEncryptedAccessToken: input.connection.encryptedAccessToken,
    observedEncryptedRefreshToken: input.connection.encryptedRefreshToken,
    refreshTokenExpiresAt: expiresAtFromSeconds(
      refreshed.refreshTokenExpiresIn,
      input.now()
    ),
    updatedAt: input.now(),
  });

  if (updated) {
    return refreshed.accessToken;
  }

  await revokeDroppedTokens({
    config,
    connection: input.connection,
    log: input.log,
    tokens: [
      { kind: "access", token: refreshed.accessToken },
      {
        kind: "refresh",
        token:
          refreshed.refreshToken && refreshed.refreshToken !== refreshToken
            ? refreshed.refreshToken
            : undefined,
      },
    ],
  });

  const winner = await getConcurrentRefreshWinner({
    config,
    connection: input.connection,
    db: input.db,
  });
  if (winner) {
    return winner.accessToken;
  }

  throw linearError(
    "LINEAR_TOKEN_REFRESH_FAILED",
    "Linear OAuth token refresh failed."
  );
}

function shouldRefreshAccessToken(
  connection: OrgConnectorConnection,
  now: Date
) {
  if (!connection.accessTokenExpiresAt) {
    return false;
  }
  return connection.accessTokenExpiresAt.getTime() <= now.getTime() + 60_000;
}

function expiresAtFromSeconds(seconds: number | undefined, now: Date) {
  return seconds ? new Date(now.getTime() + seconds * 1000) : null;
}

async function getConcurrentRefreshWinner(input: {
  config: LinearProviderRoutineConfig;
  connection: OrgConnectorConnection;
  db: ProviderRoutineServiceContext["db"];
}) {
  const current = await getCurrentOrgConnectorConnection(input.db, {
    clerkOrgId: input.connection.clerkOrgId,
    provider: input.connection.provider,
  });

  if (
    !(
      current?.encryptedAccessToken &&
      current.status === "active" &&
      (current.encryptedAccessToken !== input.connection.encryptedAccessToken ||
        current.encryptedRefreshToken !==
          input.connection.encryptedRefreshToken)
    )
  ) {
    return null;
  }

  return {
    accessToken: await decrypt(
      current.encryptedAccessToken,
      input.config.encryptionKey
    ),
    connection: current,
  };
}

async function revokeDroppedTokens(input: {
  config: LinearProviderRoutineConfig;
  connection: OrgConnectorConnection;
  log: ProviderRoutineServiceContext["log"];
  tokens: Array<{ kind: "access" | "refresh"; token?: string }>;
}) {
  const linear = await linearAppNode();
  const seen = new Set<string>();
  for (const issuedToken of input.tokens) {
    if (!issuedToken.token || seen.has(issuedToken.token)) {
      continue;
    }
    seen.add(issuedToken.token);

    try {
      await linear.revokeLinearOAuthToken({
        clientId: input.config.clientId,
        clientSecret: input.config.clientSecret,
        revokeUrl: input.config.endpoints.oauthRevokeUrl,
        token: issuedToken.token,
      });
    } catch (error) {
      input.log.warn("[provider-routines] linear dropped token revoke failed", {
        clerkOrgId: input.connection.clerkOrgId,
        failure: safeErrorDetails(error),
        provider: "linear",
        tokenKind: issuedToken.kind,
      });
    }
  }
}

async function linearAppNode(): Promise<LinearAppNodeModule> {
  return (await import(LINEAR_APP_NODE_PACKAGE)) as LinearAppNodeModule;
}

function linearError(code: string, message: string) {
  return Object.assign(new Error(message), {
    code,
    name: "LinearAppNodeError",
  });
}

function safeErrorDetails(error: unknown) {
  return {
    code:
      error && typeof error === "object" && "code" in error
        ? String(error.code)
        : undefined,
    message: error instanceof Error ? error.message : undefined,
    name: error instanceof Error ? error.name : typeof error,
  };
}
