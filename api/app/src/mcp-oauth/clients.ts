import type { Database } from "@db/app";
import {
  createMcpOauthClient,
  getMcpOauthClientByRegistrationTokenHash,
  type McpOauthClientWithRedirectUris,
} from "@db/app";
import { z } from "zod";

import { hashOpaqueToken } from "./hash";
import { createMcpClientId, createRegistrationAccessTokenSecret } from "./ids";
import { McpOAuthError } from "./types";

const REDIRECT_URI_POLICY_ERROR =
  "Redirect URIs must be exact HTTPS URLs or loopback HTTP URLs with explicit ports and no fragments.";

const registrationRequestSchema = z
  .object({
    client_name: z.string().trim().min(1).max(255),
    client_uri: z.string().url().optional(),
    contacts: z.array(z.string().min(1)).optional(),
    grant_types: z.array(z.string()).optional(),
    jwks_uri: z.string().url().optional(),
    logo_uri: z.string().url().optional(),
    policy_uri: z.string().url().optional(),
    redirect_uris: z.array(z.string().url()).min(1).max(20),
    response_types: z.array(z.string()).optional(),
    scope: z.string().optional(),
    token_endpoint_auth_method: z.literal("none").default("none"),
    tos_uri: z.string().url().optional(),
  })
  .passthrough();

export type McpClientRegistrationRequest = z.input<
  typeof registrationRequestSchema
>;

export interface RegisteredMcpOAuthClient {
  client_id: string;
  client_id_issued_at: number;
  client_name: string;
  client_uri?: string;
  code_challenge_methods_supported: ["S256"];
  grant_types: ["authorization_code", "refresh_token"];
  logo_uri?: string;
  redirect_uris: string[];
  registration_access_token: string;
  response_types: ["code"];
  token_endpoint_auth_method: "none";
}

export async function registerMcpOAuthClient(
  db: Database,
  input: McpClientRegistrationRequest,
  options: { now?: Date } = {}
): Promise<RegisteredMcpOAuthClient> {
  const parsed = parseRegistrationRequest(input);
  const publicClientId = createMcpClientId();
  const registrationAccessToken = createRegistrationAccessTokenSecret();

  const client = await createMcpOauthClient(db, {
    clientName: parsed.client_name,
    clientUri: parsed.client_uri ?? null,
    contacts: parsed.contacts ?? null,
    logoUri: parsed.logo_uri ?? null,
    metadata: {
      grantTypes: ["authorization_code", "refresh_token"],
      policyUri: parsed.policy_uri ?? null,
      responseTypes: ["code"],
      tokenEndpointAuthMethod: "none",
    },
    publicClientId,
    redirectUris: parsed.redirect_uris,
    registrationAccessTokenHash: hashOpaqueToken(registrationAccessToken),
  });

  return {
    ...formatRegisteredClientMetadata(client, { now: options.now }),
    registration_access_token: registrationAccessToken,
  };
}

export async function getRegisteredMcpOAuthClient(
  db: Database,
  input: { registrationAccessToken: string }
): Promise<Omit<RegisteredMcpOAuthClient, "registration_access_token">> {
  const client = await getMcpOauthClientByRegistrationTokenHash(db, {
    tokenHash: hashOpaqueToken(input.registrationAccessToken),
  });
  if (!client) {
    throw new McpOAuthError(
      "invalid_client",
      "Registration access token is invalid."
    );
  }
  return formatRegisteredClientMetadata(client);
}

function formatRegisteredClientMetadata(
  client: McpOauthClientWithRedirectUris,
  options: { now?: Date } = {}
): Omit<RegisteredMcpOAuthClient, "registration_access_token"> {
  const issuedAt =
    client.createdAt instanceof Date
      ? client.createdAt
      : (options.now ?? new Date());
  return {
    client_id: client.publicClientId,
    client_id_issued_at: Math.floor(issuedAt.getTime() / 1000),
    client_name: client.clientName,
    client_uri: client.clientUri ?? undefined,
    code_challenge_methods_supported: ["S256"],
    grant_types: ["authorization_code", "refresh_token"],
    logo_uri: client.logoUri ?? undefined,
    redirect_uris: client.redirectUris,
    response_types: ["code"],
    token_endpoint_auth_method: "none",
  };
}

function parseRegistrationRequest(
  input: McpClientRegistrationRequest
): z.output<typeof registrationRequestSchema> {
  const result = registrationRequestSchema.safeParse(input);
  if (!result.success) {
    throw new McpOAuthError("invalid_request", "Invalid client metadata.");
  }

  const parsed = result.data;
  if (
    parsed.grant_types?.some(
      (grantType) =>
        !["authorization_code", "refresh_token"].includes(grantType)
    )
  ) {
    throw new McpOAuthError(
      "unauthorized_client",
      "Only authorization_code and refresh_token grants are supported."
    );
  }
  if (parsed.response_types?.some((responseType) => responseType !== "code")) {
    throw new McpOAuthError(
      "invalid_request",
      "Only the code response type is supported."
    );
  }

  for (const redirectUri of parsed.redirect_uris) {
    assertAllowedRedirectUri(redirectUri);
  }

  for (const key of [
    "client_uri",
    "jwks_uri",
    "logo_uri",
    "policy_uri",
    "tos_uri",
  ] as const) {
    const value = parsed[key];
    if (value) {
      assertPublicMetadataUrl(key, value);
    }
  }

  return parsed;
}

function assertAllowedRedirectUri(value: string): void {
  if (value.includes("*")) {
    throw new McpOAuthError(
      "invalid_request",
      "Wildcard redirect URIs are not allowed."
    );
  }

  const url = new URL(value);
  if (url.hash) {
    throw new McpOAuthError(
      "invalid_request",
      REDIRECT_URI_POLICY_ERROR
    );
  }
  if (url.protocol === "https:") {
    return;
  }
  if (
    url.protocol === "http:" &&
    isLoopbackHostname(url.hostname) &&
    hasExplicitLoopbackPort(value)
  ) {
    return;
  }

  throw new McpOAuthError("invalid_request", REDIRECT_URI_POLICY_ERROR);
}

function isLoopbackHostname(hostname: string): boolean {
  const value = hostname.toLowerCase();
  return value === "localhost" || value === "127.0.0.1" || value === "[::1]";
}

function hasExplicitLoopbackPort(value: string): boolean {
  const match =
    /^http:\/\/(?:localhost|127\.0\.0\.1|\[::1\]):(?<port>\d+)(?:[/?#]|$)/iu.exec(
      value
    );
  const port = Number(match?.groups?.port);
  return Number.isInteger(port) && port >= 1 && port <= 65535;
}

function assertPublicMetadataUrl(name: string, value: string): void {
  const url = new URL(value);
  if (url.protocol !== "https:" || isPrivateHostname(url.hostname)) {
    throw new McpOAuthError(
      "invalid_request",
      `${name} must be a public HTTPS URL.`
    );
  }
}

function isPrivateHostname(hostname: string): boolean {
  const value = hostname.toLowerCase();
  if (
    value === "localhost" ||
    value === "::1" ||
    value.endsWith(".localhost") ||
    value.endsWith(".local")
  ) {
    return true;
  }

  const parts = value.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) {
    return false;
  }

  const [first = 0, second = 0] = parts;
  return (
    first === 10 ||
    first === 127 ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168)
  );
}
