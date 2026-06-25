import type {
  Database,
  McpOauthAuthorizationCode,
  McpOauthGrant,
  McpOauthRefreshToken,
} from "@db/app";
import {
  consumeMcpAuthorizationCode,
  createMcpRefreshToken,
  getActiveMcpRefreshTokenByHash,
  getMcpOauthGrantByPublicId,
  revokeMcpOauthGrant,
  revokeMcpRefreshTokenByHash,
  rotateMcpRefreshToken as rotateStoredMcpRefreshToken,
} from "@db/app";
import type { McpScope } from "@repo/api-contract";
import { jwtVerify, SignJWT } from "@vendor/jose";

import { findOrCreateMcpOauthGrant } from "./grants";
import { hashOpaqueToken } from "./hash";
import { createRefreshTokenSecret } from "./ids";
import {
  MCP_ACCESS_TOKEN_TTL_SECONDS,
  MCP_REFRESH_TOKEN_TTL_SECONDS,
  McpOAuthError,
} from "./types";

export { hashOpaqueToken } from "./hash";

const AUTHORIZATION_CODE_SECRET_PATTERN = /^mcp_code_[A-Za-z0-9_-]{43}$/;
const CODE_VERIFIER_PATTERN = /^[A-Za-z0-9._~-]{43,128}$/;
const REFRESH_TOKEN_SECRET_PATTERN = /^mcp_refresh_[A-Za-z0-9_-]{43}$/;

export interface McpAccessTokenGrant {
  clerkOrgId: string;
  clerkUserId: string;
  clientPublicId: string;
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

export function isValidMcpCodeVerifier(value: string): boolean {
  return CODE_VERIFIER_PATTERN.test(value);
}

export async function signMcpAccessToken(input: {
  audience: string;
  expiresInSeconds?: number;
  grant: McpAccessTokenGrant;
  issuer: string;
  jwtSecret: string;
}): Promise<string> {
  if (input.grant.scopes.length === 0) {
    throw new McpOAuthError("invalid_grant", "Authorization grant is invalid.");
  }
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
      algorithms: ["HS256"],
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
  audience?: string;
  clientId: string;
  code: string;
  codeVerifier: string;
  issuer: string;
  jwtSecret: string;
  now?: Date;
  redirectUri: string;
}

export interface McpAccessTokenResponse {
  access_token: string;
  expires_in: number;
  grant_id: string;
  scope: string;
  token_type: "Bearer";
}

export interface McpTokenResponse extends McpAccessTokenResponse {
  refresh_token: string;
}

export async function exchangeMcpAuthorizationCode(
  db: Database,
  input: ExchangeMcpAuthorizationCodeInput
): Promise<McpTokenResponse> {
  if (!isValidAuthorizationCodeSecret(input.code)) {
    throw new McpOAuthError("invalid_grant", "Authorization code is invalid.");
  }
  if (!isValidMcpCodeVerifier(input.codeVerifier)) {
    throw new McpOAuthError("invalid_request", "Invalid PKCE code verifier.");
  }

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
  validateGrantForAuthorizationCode(code, grant);
  const accessGrant = grantFromAuthorizationCode(code, grant);
  const audience = accessTokenAudience(code.resource, input.audience);

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
    audience,
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

function validateGrantForAuthorizationCode(
  code: McpOauthAuthorizationCode,
  grant: McpOauthGrant
): void {
  if (
    grant.clientPublicId !== code.clientPublicId ||
    grant.clerkOrgId !== code.clerkOrgId ||
    grant.clerkUserId !== code.clerkUserId ||
    grant.status !== "active" ||
    grant.resource !== code.resource ||
    !sameMcpScopes(grant.scopes, code.scopes)
  ) {
    throw new McpOAuthError("invalid_grant", "Authorization grant is invalid.");
  }
}

function sameMcpScopes(
  left: readonly McpScope[],
  right: readonly McpScope[]
): boolean {
  if (left.length !== right.length) {
    return false;
  }
  const rightScopes = new Set(right);
  return left.every((scope) => rightScopes.has(scope));
}

export interface RotateMcpRefreshTokenSecretInput {
  audience?: string;
  clientId?: string;
  currentRefreshToken: string;
  expiresAt: Date;
  issuer: string;
  jwtSecret: string;
  now?: Date;
}

export interface RotateMcpRefreshTokenSecretResult extends McpTokenResponse {
  reuseDetected: false;
}

export interface RefreshMcpAccessTokenInput {
  audience?: string;
  clientId: string;
  currentRefreshToken: string;
  issuer: string;
  jwtSecret: string;
  now?: Date;
}

export async function refreshMcpAccessTokenWithRefreshToken(
  db: Database,
  input: RefreshMcpAccessTokenInput
): Promise<McpAccessTokenResponse> {
  const { audience, grant, refreshToken } = await loadActiveRefreshTokenGrant(
    db,
    input
  );
  const accessGrant = grantFromRefreshToken(refreshToken, grant);
  const accessToken = await signMcpAccessToken({
    audience,
    grant: accessGrant,
    issuer: input.issuer,
    jwtSecret: input.jwtSecret,
  });

  return {
    access_token: accessToken,
    expires_in: MCP_ACCESS_TOKEN_TTL_SECONDS,
    grant_id: accessGrant.publicId,
    scope: accessGrant.scopes.join(" "),
    token_type: "Bearer",
  };
}

export async function rotateMcpRefreshTokenSecret(
  db: Database,
  input: RotateMcpRefreshTokenSecretInput
): Promise<RotateMcpRefreshTokenSecretResult> {
  if (!isValidRefreshTokenSecret(input.currentRefreshToken)) {
    throw new McpOAuthError("invalid_grant", "Refresh token is invalid.");
  }

  const nextRefreshToken = createRefreshTokenSecret();
  const currentTokenHash = hashOpaqueToken(input.currentRefreshToken);
  const activeRefreshToken = await getActiveMcpRefreshTokenByHash(db, {
    now: input.now,
    tokenHash: currentTokenHash,
  });
  if (activeRefreshToken) {
    await validateRefreshTokenGrant(db, activeRefreshToken, {
      audience: input.audience,
      clientId: input.clientId,
    });
  }

  const result = await rotateStoredMcpRefreshToken(db, {
    currentTokenHash,
    expiresAt: input.expiresAt,
    nextTokenHash: hashOpaqueToken(nextRefreshToken),
    now: input.now,
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

  const { audience, grant } = await validateRefreshTokenGrant(
    db,
    result.refreshToken,
    {
      audience: input.audience,
      clientId: input.clientId,
    }
  );

  const accessGrant = grantFromRefreshToken(result.refreshToken, grant);
  const accessToken = await signMcpAccessToken({
    audience,
    grant: accessGrant,
    issuer: input.issuer,
    jwtSecret: input.jwtSecret,
  });

  return {
    access_token: accessToken,
    expires_in: MCP_ACCESS_TOKEN_TTL_SECONDS,
    grant_id: accessGrant.publicId,
    refresh_token: nextRefreshToken,
    reuseDetected: false,
    scope: accessGrant.scopes.join(" "),
    token_type: "Bearer",
  };
}

export async function revokeMcpRefreshTokenSecret(
  db: Database,
  input: { refreshToken: string }
): Promise<boolean> {
  if (!isValidRefreshTokenSecret(input.refreshToken)) {
    return false;
  }
  return await revokeMcpRefreshTokenByHash(db, {
    tokenHash: hashOpaqueToken(input.refreshToken),
  });
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

function grantFromRefreshToken(
  token: { clientPublicId: string; clerkOrgId: string; clerkUserId: string },
  grant: McpOauthGrant
): McpAccessTokenGrant {
  return {
    clientPublicId: grant.clientPublicId ?? token.clientPublicId,
    clerkOrgId: grant.clerkOrgId ?? token.clerkOrgId,
    clerkUserId: grant.clerkUserId ?? token.clerkUserId,
    publicId: grant.publicId,
    scopes: grant.scopes,
  };
}

async function loadActiveRefreshTokenGrant(
  db: Database,
  input: RefreshMcpAccessTokenInput
): Promise<{
  audience: string;
  grant: McpOauthGrant;
  refreshToken: McpOauthRefreshToken;
}> {
  if (!isValidRefreshTokenSecret(input.currentRefreshToken)) {
    throw new McpOAuthError("invalid_grant", "Refresh token is invalid.");
  }

  const refreshToken = await getActiveMcpRefreshTokenByHash(db, {
    now: input.now,
    tokenHash: hashOpaqueToken(input.currentRefreshToken),
  });
  if (!refreshToken) {
    throw new McpOAuthError("invalid_grant", "Refresh token is invalid.");
  }

  const { audience, grant } = await validateRefreshTokenGrant(
    db,
    refreshToken,
    {
      audience: input.audience,
      clientId: input.clientId,
    }
  );
  return { audience, grant, refreshToken };
}

async function validateRefreshTokenGrant(
  db: Database,
  refreshToken: McpOauthRefreshToken,
  input: { audience?: string; clientId?: string }
): Promise<{ audience: string; grant: McpOauthGrant }> {
  if (input.clientId && refreshToken.clientPublicId !== input.clientId) {
    throw new McpOAuthError("invalid_grant", "Refresh token is invalid.");
  }

  const grant = await getMcpOauthGrantByPublicId(db, {
    publicId: refreshToken.grantPublicId,
  });
  if (
    !grant ||
    grant.publicId !== refreshToken.grantPublicId ||
    grant.status !== "active" ||
    grant.clientPublicId !== refreshToken.clientPublicId ||
    grant.clerkOrgId !== refreshToken.clerkOrgId ||
    grant.clerkUserId !== refreshToken.clerkUserId
  ) {
    throw new McpOAuthError("invalid_grant", "Refresh token is invalid.");
  }

  return {
    audience: accessTokenAudience(grant.resource, input.audience),
    grant,
  };
}

function accessTokenAudience(resource: string, audience?: string): string {
  if (audience && audience !== resource) {
    throw new McpOAuthError(
      "invalid_request",
      "Access token audience must match the authorized MCP resource."
    );
  }
  return resource;
}

function isValidAuthorizationCodeSecret(value: string): boolean {
  return AUTHORIZATION_CODE_SECRET_PATTERN.test(value);
}

function isValidRefreshTokenSecret(value: string): boolean {
  return REFRESH_TOKEN_SECRET_PATTERN.test(value);
}
