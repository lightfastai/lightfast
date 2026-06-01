import type { Database } from "@db/app";
import {
  createMcpAuthorizationCode,
  getMcpOauthClientByClientId,
} from "@db/app";
import type { McpScope } from "@repo/api-contract";

import { hashOpaqueToken } from "./hash";
import { createAuthorizationCodeSecret } from "./ids";
import {
  MCP_AUTHORIZATION_CODE_TTL_SECONDS,
  McpOAuthError,
  parseMcpScopes,
} from "./types";

const S256_CODE_CHALLENGE_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export interface IssueMcpAuthorizationCodeInput {
  clerkOrgId: string;
  clerkUserId: string;
  clientId: string;
  codeChallenge: string;
  codeChallengeMethod: "S256";
  now?: Date;
  redirectUri: string;
  resource: string;
  scope?: string;
}

export interface IssuedMcpAuthorizationCode {
  code: string;
  expiresAt: Date;
  redirectUri: string;
  scopes: McpScope[];
}

export async function issueMcpAuthorizationCode(
  db: Database,
  input: IssueMcpAuthorizationCodeInput
): Promise<IssuedMcpAuthorizationCode> {
  const client = await getMcpOauthClientByClientId(db, {
    publicClientId: input.clientId,
  });
  if (!client) {
    throw new McpOAuthError("invalid_client", "Unknown MCP OAuth client.");
  }
  if (!client.redirectUris.includes(input.redirectUri)) {
    throw new McpOAuthError(
      "invalid_request",
      "Redirect URI is not registered."
    );
  }
  if (!isValidMcpS256CodeChallenge(input.codeChallenge)) {
    throw new McpOAuthError("invalid_request", "Invalid PKCE code challenge.");
  }

  const scopes = parseMcpScopes(input.scope);
  const code = createAuthorizationCodeSecret();
  const now = input.now ?? new Date();
  const expiresAt = new Date(
    now.getTime() + MCP_AUTHORIZATION_CODE_TTL_SECONDS * 1000
  );

  await createMcpAuthorizationCode(db, {
    clientPublicId: input.clientId,
    clerkOrgId: input.clerkOrgId,
    clerkUserId: input.clerkUserId,
    codeChallenge: input.codeChallenge,
    codeChallengeMethod: input.codeChallengeMethod,
    codeHash: hashOpaqueToken(code),
    expiresAt,
    redirectUri: input.redirectUri,
    resource: input.resource,
    scopes,
  });

  return {
    code,
    expiresAt,
    redirectUri: input.redirectUri,
    scopes,
  };
}

export function isValidMcpS256CodeChallenge(value: string): boolean {
  return S256_CODE_CHALLENGE_PATTERN.test(value);
}

export function buildDeniedAuthorizationRedirect(input: {
  errorDescription?: string;
  redirectUri: string;
  state?: string;
}): string {
  const url = new URL(input.redirectUri);
  url.searchParams.set("error", "access_denied");
  if (input.errorDescription) {
    url.searchParams.set("error_description", input.errorDescription);
  }
  if (input.state) {
    url.searchParams.set("state", input.state);
  }
  return url.toString();
}
