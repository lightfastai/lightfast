import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import {
  CONNECTABLE_CONNECTOR_PROVIDERS,
  type ConnectableConnectorProvider,
} from "@repo/connector-contract";
import { z } from "zod";

import { env } from "../../env";

const TOKEN_PREFIX = "lfmcp_v1";
const DEFAULT_TTL_SECONDS = 5 * 60;
const ISSUER = "lightfast-connectors";

export type ConnectorMcpTokenPurpose = "call" | "list";

export interface ConnectorMcpTokenClaims {
  aud: `connector-mcp:${ConnectableConnectorProvider}`;
  clerkOrgId: string;
  connectionId: number;
  exp: number;
  iat: number;
  iss: "lightfast-connectors";
  nonce: string;
  provider: ConnectableConnectorProvider;
  purpose: ConnectorMcpTokenPurpose;
  toolName?: string;
}

export class ConnectorMcpAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConnectorMcpAuthError";
  }
}

const claimsSchema = z.object({
  aud: z.string().min(1),
  clerkOrgId: z.string().min(1),
  connectionId: z.number().int().positive(),
  exp: z.number().int().positive(),
  iat: z.number().int().positive(),
  iss: z.literal(ISSUER),
  nonce: z.string().min(16),
  provider: z.enum(CONNECTABLE_CONNECTOR_PROVIDERS),
  purpose: z.enum(["call", "list"]),
  toolName: z.string().min(1).optional(),
});

export async function issueConnectorMcpToken(input: {
  clerkOrgId: string;
  connectionId: number;
  now?: Date;
  provider: ConnectableConnectorProvider;
  purpose: ConnectorMcpTokenPurpose;
  toolName?: string;
  ttlSeconds?: number;
}): Promise<string> {
  if (
    input.ttlSeconds !== undefined &&
    (!Number.isFinite(input.ttlSeconds) ||
      !Number.isInteger(input.ttlSeconds) ||
      input.ttlSeconds <= 0)
  ) {
    throw new ConnectorMcpAuthError(
      "Connector MCP token TTL must be a positive integer."
    );
  }

  if (input.purpose === "call" && !input.toolName) {
    throw new ConnectorMcpAuthError(
      "Connector MCP call tokens require a tool name."
    );
  }

  const nowSeconds = epochSeconds(input.now);
  const claims: ConnectorMcpTokenClaims = {
    aud: `connector-mcp:${input.provider}`,
    clerkOrgId: input.clerkOrgId,
    connectionId: input.connectionId,
    exp: nowSeconds + (input.ttlSeconds ?? DEFAULT_TTL_SECONDS),
    iat: nowSeconds,
    iss: ISSUER,
    nonce: randomUUID().replaceAll("-", ""),
    provider: input.provider,
    purpose: input.purpose,
    ...(input.toolName ? { toolName: input.toolName } : {}),
  };
  const payload = encodeJson(claims);
  return `${TOKEN_PREFIX}.${payload}.${signatureFor(payload)}`;
}

export async function verifyConnectorMcpToken(input: {
  now?: Date;
  provider: ConnectableConnectorProvider;
  purpose: ConnectorMcpTokenPurpose;
  token: string;
  toolName?: string;
}): Promise<ConnectorMcpTokenClaims> {
  const parts = input.token.split(".");
  if (parts.length !== 3 || parts[0] !== TOKEN_PREFIX) {
    throw new ConnectorMcpAuthError("Connector MCP token format is invalid.");
  }

  const [, payloadSegment, signature] = parts as [string, string, string];
  if (!verifySignature(payloadSegment, signature)) {
    throw new ConnectorMcpAuthError(
      "Connector MCP token signature is invalid."
    );
  }

  const claims = parseClaims(payloadSegment);
  if (claims.provider !== input.provider) {
    throw new ConnectorMcpAuthError("Connector MCP token provider is invalid.");
  }
  if (claims.aud !== `connector-mcp:${input.provider}`) {
    throw new ConnectorMcpAuthError("Connector MCP token audience is invalid.");
  }
  if (claims.purpose !== input.purpose) {
    throw new ConnectorMcpAuthError("Connector MCP token purpose is invalid.");
  }
  if (claims.exp <= epochSeconds(input.now)) {
    throw new ConnectorMcpAuthError("Connector MCP token is expired.");
  }
  if (input.purpose === "call" && !claims.toolName) {
    throw new ConnectorMcpAuthError(
      "Connector MCP token tool name is invalid."
    );
  }
  if (input.toolName !== undefined && claims.toolName !== input.toolName) {
    throw new ConnectorMcpAuthError(
      "Connector MCP token tool name is invalid."
    );
  }

  return claims;
}

function parseClaims(payloadSegment: string): ConnectorMcpTokenClaims {
  try {
    const parsed = claimsSchema.parse(
      JSON.parse(Buffer.from(payloadSegment, "base64url").toString("utf8"))
    );
    return parsed as ConnectorMcpTokenClaims;
  } catch (error) {
    throw new ConnectorMcpAuthError(
      error instanceof Error
        ? "Connector MCP token payload is invalid."
        : "Connector MCP token format is invalid."
    );
  }
}

function verifySignature(payloadSegment: string, signature: string): boolean {
  const expected = Buffer.from(signatureFor(payloadSegment));
  const actual = Buffer.from(signature);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function signatureFor(payloadSegment: string): string {
  return createHmac("sha256", getMcpAuthSecret())
    .update(payloadSegment)
    .digest("base64url");
}

function getMcpAuthSecret(): string {
  if (env.CONNECTOR_MCP_AUTH_SECRET) {
    return env.CONNECTOR_MCP_AUTH_SECRET;
  }

  if (
    env.ENCRYPTION_KEY &&
    (env.VERCEL_ENV === "development" || process.env.NODE_ENV === "test")
  ) {
    return env.ENCRYPTION_KEY;
  }

  throw new ConnectorMcpAuthError(
    "CONNECTOR_MCP_AUTH_SECRET is required for connector MCP auth."
  );
}

function encodeJson(value: ConnectorMcpTokenClaims): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function epochSeconds(now?: Date): number {
  return Math.floor((now?.getTime() ?? Date.now()) / 1000);
}
