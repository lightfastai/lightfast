import type {
  Database,
  McpOauthAuthorizationCode,
  McpOauthGrant,
} from "@db/app";
import {
  consumeMcpAuthorizationCode,
  createMcpRefreshToken,
  revokeMcpOauthGrant,
  rotateMcpRefreshToken as rotateStoredMcpRefreshToken,
} from "@db/app";
import type { McpScope } from "@repo/api-contract";
import { jwtVerify, SignJWT } from "jose";

import { findOrCreateMcpOauthGrant } from "./grants";
import { hashOpaqueToken } from "./hash";
import { createRefreshTokenSecret } from "./ids";
import {
  MCP_ACCESS_TOKEN_TTL_SECONDS,
  MCP_REFRESH_TOKEN_TTL_SECONDS,
  McpOAuthError,
} from "./types";

export { hashOpaqueToken } from "./hash";

export interface McpAccessTokenGrant {
  clientPublicId: string;
  clerkOrgId: string;
  clerkUserId: string;
  publicId: string;
  scopes: McpScope[];
}

export interface McpAccessTokenPayload {
  aud: string | string[];
  client_id: string;
  exp?: number;
  grant_id: string;
  iat?: number;
  iss: string;
  org_id: string;
  scope: string;
  sub: string;
  token_use: "mcp_access";
  user_id: string;
}

export function createJwtSecretKey(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

export function createCodeChallenge(codeVerifier: string): string {
  return hashOpaqueToken(codeVerifier);
}

export async function signMcpAccessToken(input: {
  audience: string;
  expiresInSeconds?: number;
  grant: McpAccessTokenGrant;
  issuer: string;
  jwtSecret: string;
}): Promise<string> {
  const scope = input.grant.scopes.join(" ");
  return await new SignJWT({
    client_id: input.grant.clientPublicId,
    grant_id: input.grant.publicId,
    org_id: input.grant.clerkOrgId,
    scope,
    token_use: "mcp_access",
    user_id: input.grant.clerkUserId,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(input.issuer)
    .setAudience(input.audience)
    .setSubject(input.grant.clerkUserId)
    .setIssuedAt()
    .setExpirationTime(
      `${input.expiresInSeconds ?? MCP_ACCESS_TOKEN_TTL_SECONDS}s`
    )
    .sign(createJwtSecretKey(input.jwtSecret));
}

export async function verifyMcpAccessToken(
  token: string,
  input: {
    audience: string;
    issuer: string;
    jwtSecret: string;
  }
): Promise<McpAccessTokenPayload> {
  const { payload } = await jwtVerify(
    token,
    createJwtSecretKey(input.jwtSecret),
    {
      audience: input.audience,
      issuer: input.issuer,
    }
  );

  if (payload.token_use !== "mcp_access") {
    throw new McpOAuthError(
      "invalid_grant",
      "Access token is not an MCP token."
    );
  }
  return payload as unknown as McpAccessTokenPayload;
}

export interface ExchangeMcpAuthorizationCodeInput {
  audience: string;
  clientId: string;
  code: string;
  codeVerifier: string;
  issuer: string;
  jwtSecret: string;
  now?: Date;
  redirectUri: string;
}

export interface McpTokenResponse {
  access_token: string;
  expires_in: number;
  grant_id: string;
  refresh_token: string;
  scope: string;
  token_type: "Bearer";
}

export async function exchangeMcpAuthorizationCode(
  db: Database,
  input: ExchangeMcpAuthorizationCodeInput
): Promise<McpTokenResponse> {
  const code = await consumeMcpAuthorizationCode(db, {
    codeHash: hashOpaqueToken(input.code),
  });
  if (!code) {
    throw new McpOAuthError("invalid_grant", "Authorization code is invalid.");
  }

  validateAuthorizationCodeForExchange(code, input);
  const grant = await findOrCreateMcpOauthGrant(db, {
    clientPublicId: code.clientPublicId,
    clerkOrgId: code.clerkOrgId,
    clerkUserId: code.clerkUserId,
    resource: code.resource,
    scopes: code.scopes,
  });
  const accessGrant = grantFromAuthorizationCode(code, grant);

  const refreshToken = createRefreshTokenSecret();
  await createMcpRefreshToken(db, {
    clientPublicId: accessGrant.clientPublicId,
    clerkOrgId: accessGrant.clerkOrgId,
    clerkUserId: accessGrant.clerkUserId,
    expiresAt: new Date(
      (input.now ?? new Date()).getTime() + MCP_REFRESH_TOKEN_TTL_SECONDS * 1000
    ),
    grantPublicId: accessGrant.publicId,
    tokenHash: hashOpaqueToken(refreshToken),
  });

  const accessToken = await signMcpAccessToken({
    audience: input.audience,
    grant: accessGrant,
    issuer: input.issuer,
    jwtSecret: input.jwtSecret,
  });

  return {
    access_token: accessToken,
    expires_in: MCP_ACCESS_TOKEN_TTL_SECONDS,
    grant_id: accessGrant.publicId,
    refresh_token: refreshToken,
    scope: accessGrant.scopes.join(" "),
    token_type: "Bearer",
  };
}

function validateAuthorizationCodeForExchange(
  code: McpOauthAuthorizationCode,
  input: ExchangeMcpAuthorizationCodeInput
): void {
  if (
    code.clientPublicId !== input.clientId ||
    code.redirectUri !== input.redirectUri
  ) {
    throw new McpOAuthError("invalid_grant", "Authorization code is invalid.");
  }

  const expectedChallenge =
    code.codeChallengeMethod === "S256"
      ? createCodeChallenge(input.codeVerifier)
      : input.codeVerifier;
  if (code.codeChallenge !== expectedChallenge) {
    throw new McpOAuthError("invalid_grant", "PKCE verification failed.");
  }
}

export interface RotateMcpRefreshTokenSecretInput {
  currentRefreshToken: string;
  expiresAt: Date;
}

export interface RotateMcpRefreshTokenSecretResult {
  grant_id: string;
  refresh_token: string;
  reuseDetected: false;
}

export async function rotateMcpRefreshTokenSecret(
  db: Database,
  input: RotateMcpRefreshTokenSecretInput
): Promise<RotateMcpRefreshTokenSecretResult> {
  const nextRefreshToken = createRefreshTokenSecret();
  const result = await rotateStoredMcpRefreshToken(db, {
    currentTokenHash: hashOpaqueToken(input.currentRefreshToken),
    expiresAt: input.expiresAt,
    nextTokenHash: hashOpaqueToken(nextRefreshToken),
  });

  if (result.reuseDetected) {
    if (result.refreshToken) {
      await revokeMcpOauthGrant(db, {
        publicId: result.refreshToken.grantPublicId,
      });
    }
    throw new McpOAuthError("invalid_grant", "Refresh token reuse detected.");
  }
  if (!result.refreshToken) {
    throw new McpOAuthError("invalid_grant", "Refresh token is invalid.");
  }

  return {
    grant_id: result.refreshToken.grantPublicId,
    refresh_token: nextRefreshToken,
    reuseDetected: false,
  };
}

export function getMcpOAuthJwks(): { keys: [] } {
  return { keys: [] };
}

function grantFromAuthorizationCode(
  code: McpOauthAuthorizationCode,
  grant: McpOauthGrant
): McpAccessTokenGrant {
  return {
    clientPublicId: grant.clientPublicId ?? code.clientPublicId,
    clerkOrgId: grant.clerkOrgId ?? code.clerkOrgId,
    clerkUserId: grant.clerkUserId ?? code.clerkUserId,
    publicId: grant.publicId,
    scopes: grant.scopes,
  };
}
