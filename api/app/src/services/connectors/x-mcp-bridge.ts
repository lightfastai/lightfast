import {
  getCurrentOrgConnectorConnection,
  markCurrentOrgConnectorConnectionError,
  type OrgConnectorConnection,
  updateObservedConnectorTokens,
} from "@db/app";
import { db as appDb } from "@db/app/client";
import { decrypt, encrypt } from "@repo/app-encryption";
import {
  executeXApiTool,
  getXToolDefinitionsForScopes,
  refreshXOAuthToken,
  XAppNodeError,
} from "@repo/x-app-node";
import {
  McpServer,
  WebStandardStreamableHTTPServerTransport,
} from "@vendor/mcp";
import { z } from "zod";

import { env } from "../../env";
import { requireXConnectorConfig } from "./config";
import {
  ConnectorMcpAuthError,
  type ConnectorMcpTokenClaims,
  type ConnectorMcpTokenPurpose,
  verifyConnectorMcpToken,
} from "./mcp-auth";

type XBridgeRequestKind =
  | { purpose: "call"; toolName?: string }
  | { purpose: "list" }
  | { purpose: null };

const permissiveToolInputSchema = z.object({}).passthrough();
const MALFORMED_JSON_REQUEST = Symbol("malformed-json");

type XToolArgs = Record<string, unknown>;

export async function handleXConnectorMcpRequest(input: {
  request: Request;
}): Promise<Response> {
  const parsedBody = await parseRequestBody(input.request);
  if (parsedBody === MALFORMED_JSON_REQUEST) {
    return invalidRequestResponse();
  }

  const token = bearerToken(input.request.headers);
  if (!token) {
    return unauthorizedResponse();
  }

  const requestKind = deriveRequestKind(parsedBody);
  const claims = await verifyXBridgeToken({ requestKind, token });
  if (!claims) {
    return unauthorizedResponse();
  }

  const connection =
    requestKind.purpose === null
      ? null
      : await getAuthorizedXConnection({ claims });
  if (requestKind.purpose !== null && !connection) {
    return unauthorizedResponse();
  }

  const server = new McpServer({
    name: "lightfast-x-connector",
    version: "0.1.0",
  });
  registerXTools(server, {
    appOrigin: new URL(input.request.url).origin,
    claims,
    connection,
  });

  const transport = new WebStandardStreamableHTTPServerTransport({
    enableJsonResponse: true,
    sessionIdGenerator: undefined,
  });

  try {
    await server.connect(transport);
    return await transport.handleRequest(input.request, { parsedBody });
  } finally {
    await server.close();
  }
}

function registerXTools(
  server: McpServer,
  input: {
    appOrigin: string;
    claims: ConnectorMcpTokenClaims;
    connection: OrgConnectorConnection | null;
  }
) {
  const connection = input.connection;
  const definitions = connection
    ? getXToolDefinitionsForScopes(connection.scopes).filter((definition) =>
        hasManifestTool(connection, definition.name)
      )
    : [];

  for (const definition of definitions) {
    const handleToolCall = async (args: XToolArgs) => {
      if (!input.connection) {
        throw new XAppNodeError(
          "X_TOKEN_REFRESH_FAILED",
          "X connector connection is not available."
        );
      }
      if (!hasManifestTool(input.connection, definition.name)) {
        throw new XAppNodeError(
          "X_TOOL_CALL_FAILED",
          "X connector tool is not available on the current connection."
        );
      }

      try {
        const config = requireXConnectorConfig({
          appOrigin: input.appOrigin,
        });
        const accessToken = await getFreshXBridgeAccessToken({
          config,
          connection: input.connection,
        });
        const result = await executeXApiTool({
          accessToken,
          apiOrigin: config.endpoints.apiOrigin,
          connectedActorId: input.connection.providerActorId,
          input: args,
          name: definition.name,
        });
        return {
          content: result.content,
          structuredContent: structuredContentObject(result.structuredContent),
        };
      } catch (error) {
        if (isTerminalXAuthError(error)) {
          await markCurrentOrgConnectorConnectionError(appDb, {
            clerkOrgId: input.claims.clerkOrgId,
            provider: "x",
          });
        }
        throw error;
      }
    };

    server.registerTool(
      definition.name,
      {
        description: definition.description,
        inputSchema: permissiveToolInputSchema,
      } as never,
      handleToolCall as never
    );
  }
}

function hasManifestTool(connection: OrgConnectorConnection, toolName: string) {
  return connection.toolManifest.some((tool) => tool.name === toolName);
}

async function getFreshXBridgeAccessToken(input: {
  config: ReturnType<typeof requireXConnectorConfig>;
  connection: OrgConnectorConnection;
}): Promise<string> {
  if (!input.connection.encryptedAccessToken) {
    throw new XAppNodeError(
      "X_TOKEN_REFRESH_FAILED",
      "X connector access token is missing."
    );
  }

  if (!shouldRefreshAccessToken(input.connection)) {
    return await decrypt(
      input.connection.encryptedAccessToken,
      env.ENCRYPTION_KEY
    );
  }

  if (!input.connection.encryptedRefreshToken) {
    throw new XAppNodeError(
      "X_TOKEN_REFRESH_FAILED",
      "X connector refresh token is missing."
    );
  }

  const refreshToken = await decrypt(
    input.connection.encryptedRefreshToken,
    env.ENCRYPTION_KEY
  );
  const refreshed = await refreshXOAuthToken({
    clientId: input.config.clientId,
    clientSecret: input.config.clientSecret,
    refreshToken,
    refreshTokenExpiresIn: input.connection.refreshTokenExpiresAt
      ? Math.max(
          1,
          Math.floor(
            (input.connection.refreshTokenExpiresAt.getTime() - Date.now()) /
              1000
          )
        )
      : undefined,
    tokenUrl: input.config.endpoints.oauthTokenUrl,
  });

  const encryptedAccessToken = await encrypt(
    refreshed.accessToken,
    env.ENCRYPTION_KEY
  );
  const encryptedRefreshToken = refreshed.refreshToken
    ? await encrypt(refreshed.refreshToken, env.ENCRYPTION_KEY)
    : null;
  const updated = await updateObservedConnectorTokens(appDb, {
    accessTokenExpiresAt: expiresAtFromSeconds(refreshed.accessTokenExpiresIn),
    clerkOrgId: input.connection.clerkOrgId,
    encryptedAccessToken,
    encryptedRefreshToken,
    id: input.connection.id,
    observedEncryptedAccessToken: input.connection.encryptedAccessToken,
    observedEncryptedRefreshToken: input.connection.encryptedRefreshToken,
    refreshTokenExpiresAt: expiresAtFromSeconds(
      refreshed.refreshTokenExpiresIn
    ),
    updatedAt: new Date(),
  });

  if (!updated) {
    throw new XAppNodeError(
      "X_TOKEN_REFRESH_FAILED",
      "X OAuth token refresh failed."
    );
  }

  return refreshed.accessToken;
}

async function verifyXBridgeToken(input: {
  requestKind: XBridgeRequestKind;
  token: string;
}): Promise<ConnectorMcpTokenClaims | null> {
  const purposes: ConnectorMcpTokenPurpose[] =
    input.requestKind.purpose === null
      ? ["list", "call"]
      : [input.requestKind.purpose];

  for (const purpose of purposes) {
    try {
      return await verifyConnectorMcpToken({
        provider: "x",
        purpose,
        token: input.token,
        toolName:
          purpose === "call" && input.requestKind.purpose === "call"
            ? input.requestKind.toolName
            : undefined,
      });
    } catch (error) {
      if (!(error instanceof ConnectorMcpAuthError)) {
        throw error;
      }
    }
  }

  return null;
}

async function getAuthorizedXConnection(input: {
  claims: ConnectorMcpTokenClaims;
}): Promise<OrgConnectorConnection | null> {
  const connection = await getCurrentOrgConnectorConnection(appDb, {
    clerkOrgId: input.claims.clerkOrgId,
    provider: "x",
  });

  if (
    !connection ||
    connection.id !== input.claims.connectionId ||
    connection.provider !== "x" ||
    connection.status !== "active"
  ) {
    return null;
  }

  return connection;
}

async function parseRequestBody(request: Request): Promise<unknown> {
  if (request.method !== "POST") {
    return;
  }

  const text = await request.clone().text();
  if (!text) {
    return;
  }

  try {
    return JSON.parse(text);
  } catch {
    return MALFORMED_JSON_REQUEST;
  }
}

function deriveRequestKind(parsedBody: unknown): XBridgeRequestKind {
  const messages = Array.isArray(parsedBody) ? parsedBody : [parsedBody];
  const methods = messages.flatMap((message) =>
    message && typeof message === "object" && "method" in message
      ? [message as { method: unknown; params?: unknown }]
      : []
  );

  const toolCall = methods.find((message) => message.method === "tools/call");
  if (toolCall) {
    return {
      purpose: "call",
      toolName: toolNameFromParams(toolCall.params),
    };
  }

  if (methods.some((message) => message.method === "tools/list")) {
    return { purpose: "list" };
  }

  return { purpose: null };
}

function toolNameFromParams(params: unknown): string | undefined {
  if (!params || typeof params !== "object" || !("name" in params)) {
    return;
  }
  const name = params.name;
  return typeof name === "string" ? name : undefined;
}

function bearerToken(headers: Headers): string | null {
  const authorization = headers.get("authorization");
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

function unauthorizedResponse() {
  return new Response("Unauthorized", { status: 401 });
}

function invalidRequestResponse() {
  return new Response("Invalid request body", { status: 400 });
}

function shouldRefreshAccessToken(connection: OrgConnectorConnection) {
  if (!connection.accessTokenExpiresAt) {
    return false;
  }
  return connection.accessTokenExpiresAt.getTime() <= Date.now() + 60_000;
}

function expiresAtFromSeconds(seconds: number | undefined) {
  return seconds ? new Date(Date.now() + seconds * 1000) : null;
}

function isTerminalXAuthError(error: unknown) {
  return (
    error instanceof XAppNodeError && error.code === "X_TOKEN_REFRESH_FAILED"
  );
}

function structuredContentObject(
  value: unknown
): Record<string, unknown> | undefined {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return;
}
