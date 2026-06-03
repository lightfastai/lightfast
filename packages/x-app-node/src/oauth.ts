import { createHash, randomBytes } from "node:crypto";

import { z } from "zod";

import { assertXEndpointAllowed, DEFAULT_X_ENDPOINTS } from "./config";
import { XAppNodeError } from "./errors";

const DEFAULT_X_OAUTH_TIMEOUT_MS = 10_000;

export const X_OAUTH_SCOPE = "tweet.read users.read offline.access";

const xOAuthTokenResponseSchema = z.object({
  access_token: z.string().min(1),
  expires_in: z.number().int().positive().optional(),
  refresh_token: z.string().min(1).optional(),
  refresh_token_expires_in: z.number().int().positive().optional(),
  scope: z.string().optional(),
  token_type: z.string().min(1),
});

export interface XPkcePair {
  codeChallenge: string;
  codeChallengeMethod: "S256";
  codeVerifier: string;
}

export interface XTokenSet {
  accessToken: string;
  accessTokenExpiresIn?: number;
  refreshToken?: string;
  refreshTokenExpiresIn?: number;
  scope?: string;
  scopes: string[];
  tokenType: string;
}

interface RequestXOAuthTokenInput {
  body: URLSearchParams;
  clientId: string;
  clientSecret: string;
  failureCode: "X_OAUTH_EXCHANGE_FAILED" | "X_TOKEN_REFRESH_FAILED";
  failureMessage: string;
  fetch?: typeof fetch;
  nodeEnv?: string;
  previousRefreshToken?: string;
  previousRefreshTokenExpiresIn?: number;
  signal?: AbortSignal;
  timeoutMs?: number;
  tokenUrl?: string;
}

export function createXPkcePair(): XPkcePair {
  const codeVerifier = base64url(randomBytes(32));
  const codeChallenge = base64url(
    createHash("sha256").update(codeVerifier).digest()
  );
  return { codeChallenge, codeChallengeMethod: "S256", codeVerifier };
}

export function buildXOAuthAuthorizeUrl(input: {
  callbackUrl: string;
  clientId: string;
  codeChallenge: string;
  nodeEnv?: string;
  oauthAuthorizeUrl?: string;
  state: string;
}): string {
  const oauthAuthorizeUrl =
    input.oauthAuthorizeUrl ?? DEFAULT_X_ENDPOINTS.oauthAuthorizeUrl;
  assertXEndpointAllowed({
    defaultValue: DEFAULT_X_ENDPOINTS.oauthAuthorizeUrl,
    nodeEnv: input.nodeEnv,
    value: oauthAuthorizeUrl,
  });

  const url = new URL(oauthAuthorizeUrl);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", input.clientId);
  url.searchParams.set("redirect_uri", input.callbackUrl);
  url.searchParams.set("scope", X_OAUTH_SCOPE);
  url.searchParams.set("state", input.state);
  url.searchParams.set("code_challenge", input.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

export async function exchangeXOAuthCode(input: {
  callbackUrl: string;
  clientId: string;
  clientSecret: string;
  code: string;
  codeVerifier: string;
  fetch?: typeof fetch;
  nodeEnv?: string;
  signal?: AbortSignal;
  timeoutMs?: number;
  tokenUrl?: string;
}): Promise<XTokenSet> {
  return await requestXOAuthToken({
    body: new URLSearchParams({
      client_id: input.clientId,
      code: input.code,
      code_verifier: input.codeVerifier,
      grant_type: "authorization_code",
      redirect_uri: input.callbackUrl,
    }),
    clientId: input.clientId,
    clientSecret: input.clientSecret,
    failureCode: "X_OAUTH_EXCHANGE_FAILED",
    failureMessage: "X OAuth code exchange failed.",
    fetch: input.fetch,
    nodeEnv: input.nodeEnv,
    signal: input.signal,
    timeoutMs: input.timeoutMs,
    tokenUrl: input.tokenUrl,
  });
}

export async function refreshXOAuthToken(input: {
  clientId: string;
  clientSecret: string;
  fetch?: typeof fetch;
  nodeEnv?: string;
  refreshToken: string;
  refreshTokenExpiresIn?: number;
  signal?: AbortSignal;
  timeoutMs?: number;
  tokenUrl?: string;
}): Promise<XTokenSet> {
  return await requestXOAuthToken({
    body: new URLSearchParams({
      client_id: input.clientId,
      grant_type: "refresh_token",
      refresh_token: input.refreshToken,
    }),
    clientId: input.clientId,
    clientSecret: input.clientSecret,
    failureCode: "X_TOKEN_REFRESH_FAILED",
    failureMessage: "X OAuth token refresh failed.",
    fetch: input.fetch,
    nodeEnv: input.nodeEnv,
    previousRefreshToken: input.refreshToken,
    previousRefreshTokenExpiresIn: input.refreshTokenExpiresIn,
    signal: input.signal,
    timeoutMs: input.timeoutMs,
    tokenUrl: input.tokenUrl,
  });
}

export async function revokeXOAuthToken(input: {
  clientId: string;
  clientSecret: string;
  fetch?: typeof fetch;
  nodeEnv?: string;
  revokeUrl?: string;
  signal?: AbortSignal;
  timeoutMs?: number;
  token: string;
}): Promise<void> {
  const requestFetch = input.fetch ?? fetch;
  const abortController = input.signal ? undefined : new AbortController();
  const signal = input.signal ?? abortController?.signal;
  const timeout =
    abortController === undefined
      ? undefined
      : setTimeout(
          () => abortController.abort(),
          input.timeoutMs ?? DEFAULT_X_OAUTH_TIMEOUT_MS
        );

  try {
    const revokeUrl = input.revokeUrl ?? DEFAULT_X_ENDPOINTS.oauthRevokeUrl;
    assertXEndpointAllowed({
      defaultValue: DEFAULT_X_ENDPOINTS.oauthRevokeUrl,
      nodeEnv: input.nodeEnv,
      value: revokeUrl,
    });

    const response = await requestFetch(revokeUrl, {
      body: new URLSearchParams({
        client_id: input.clientId,
        token: input.token,
      }),
      headers: tokenRequestHeaders(input.clientId, input.clientSecret),
      method: "POST",
      signal,
    });

    if (!response.ok) {
      throw new XAppNodeError(
        "X_REVOKE_FAILED",
        "X OAuth token revocation failed."
      );
    }
  } catch (error) {
    if (error instanceof XAppNodeError) {
      throw error;
    }
    throw new XAppNodeError(
      "X_REVOKE_FAILED",
      "X OAuth token revocation failed.",
      error
    );
  } finally {
    if (timeout !== undefined) {
      clearTimeout(timeout);
    }
  }
}

async function requestXOAuthToken(
  input: RequestXOAuthTokenInput
): Promise<XTokenSet> {
  const requestFetch = input.fetch ?? fetch;
  const abortController = input.signal ? undefined : new AbortController();
  const signal = input.signal ?? abortController?.signal;
  const timeout =
    abortController === undefined
      ? undefined
      : setTimeout(
          () => abortController.abort(),
          input.timeoutMs ?? DEFAULT_X_OAUTH_TIMEOUT_MS
        );

  try {
    const tokenUrl = input.tokenUrl ?? DEFAULT_X_ENDPOINTS.oauthTokenUrl;
    assertXEndpointAllowed({
      defaultValue: DEFAULT_X_ENDPOINTS.oauthTokenUrl,
      nodeEnv: input.nodeEnv,
      value: tokenUrl,
    });

    const response = await requestFetch(tokenUrl, {
      body: input.body,
      headers: tokenRequestHeaders(input.clientId, input.clientSecret),
      method: "POST",
      signal,
    });

    const json = await response.json().catch(() => null);
    const parsed = xOAuthTokenResponseSchema.safeParse(json);
    if (!(response.ok && parsed.success)) {
      throw new XAppNodeError(input.failureCode, input.failureMessage);
    }

    return {
      accessToken: parsed.data.access_token,
      accessTokenExpiresIn: parsed.data.expires_in,
      refreshToken: parsed.data.refresh_token ?? input.previousRefreshToken,
      refreshTokenExpiresIn:
        parsed.data.refresh_token_expires_in ??
        input.previousRefreshTokenExpiresIn,
      scope: parsed.data.scope,
      scopes: parseXScopes(parsed.data.scope),
      tokenType: parsed.data.token_type,
    };
  } catch (error) {
    if (error instanceof XAppNodeError) {
      throw error;
    }
    throw new XAppNodeError(input.failureCode, input.failureMessage, error);
  } finally {
    if (timeout !== undefined) {
      clearTimeout(timeout);
    }
  }
}

function tokenRequestHeaders(clientId: string, clientSecret: string) {
  return {
    accept: "application/json",
    authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    "content-type": "application/x-www-form-urlencoded",
  };
}

function base64url(bytes: Buffer): string {
  return bytes.toString("base64url");
}

function parseXScopes(scope: string | undefined): string[] {
  return scope?.split(/\s+/).filter(Boolean) ?? [];
}
