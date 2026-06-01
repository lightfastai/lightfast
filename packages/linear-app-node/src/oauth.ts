import { createHash, randomBytes } from "node:crypto";

import { z } from "zod";

import {
  assertLinearEndpointAllowed,
  DEFAULT_LINEAR_ENDPOINTS,
} from "./config";
import { LinearAppNodeError } from "./errors";

const DEFAULT_LINEAR_OAUTH_TIMEOUT_MS = 10_000;

const linearOAuthTokenResponseSchema = z.object({
  access_token: z.string().min(1),
  expires_in: z.number().int().positive().optional(),
  refresh_token: z.string().min(1).optional(),
  refresh_token_expires_in: z.number().int().positive().optional(),
  scope: z.string().optional(),
  token_type: z.string().min(1),
});

export interface LinearPkcePair {
  codeChallenge: string;
  codeChallengeMethod: "S256";
  codeVerifier: string;
}

export interface LinearTokenSet {
  accessToken: string;
  accessTokenExpiresIn?: number;
  refreshToken?: string;
  refreshTokenExpiresIn?: number;
  scope?: string;
  scopes: string[];
  tokenType: string;
}

interface RequestLinearOAuthTokenInput {
  body: URLSearchParams;
  failureCode: "LINEAR_OAUTH_EXCHANGE_FAILED" | "LINEAR_TOKEN_REFRESH_FAILED";
  failureMessage: string;
  fetch?: typeof fetch;
  nodeEnv?: string;
  previousRefreshToken?: string;
  previousRefreshTokenExpiresIn?: number;
  signal?: AbortSignal;
  timeoutMs?: number;
  tokenUrl?: string;
}

export function createLinearPkcePair(): LinearPkcePair {
  const codeVerifier = base64url(randomBytes(32));
  const codeChallenge = base64url(
    createHash("sha256").update(codeVerifier).digest()
  );
  return { codeChallenge, codeChallengeMethod: "S256", codeVerifier };
}

export function buildLinearOAuthAuthorizeUrl(input: {
  callbackUrl: string;
  clientId: string;
  codeChallenge: string;
  nodeEnv?: string;
  oauthAuthorizeUrl?: string;
  state: string;
}): string {
  const oauthAuthorizeUrl =
    input.oauthAuthorizeUrl ?? DEFAULT_LINEAR_ENDPOINTS.oauthAuthorizeUrl;
  assertLinearEndpointAllowed({
    defaultValue: DEFAULT_LINEAR_ENDPOINTS.oauthAuthorizeUrl,
    nodeEnv: input.nodeEnv,
    value: oauthAuthorizeUrl,
  });

  const url = new URL(oauthAuthorizeUrl);
  url.searchParams.set("actor", "app");
  url.searchParams.set("client_id", input.clientId);
  url.searchParams.set("redirect_uri", input.callbackUrl);
  url.searchParams.set("scope", "read,write");
  url.searchParams.set("state", input.state);
  url.searchParams.set("code_challenge", input.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

export async function exchangeLinearOAuthCode(input: {
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
}): Promise<LinearTokenSet> {
  return await requestLinearOAuthToken({
    body: new URLSearchParams({
      client_id: input.clientId,
      client_secret: input.clientSecret,
      code: input.code,
      code_verifier: input.codeVerifier,
      grant_type: "authorization_code",
      redirect_uri: input.callbackUrl,
    }),
    failureCode: "LINEAR_OAUTH_EXCHANGE_FAILED",
    failureMessage: "Linear OAuth code exchange failed.",
    fetch: input.fetch,
    nodeEnv: input.nodeEnv,
    signal: input.signal,
    timeoutMs: input.timeoutMs,
    tokenUrl: input.tokenUrl,
  });
}

export async function refreshLinearOAuthToken(input: {
  clientId: string;
  clientSecret: string;
  fetch?: typeof fetch;
  nodeEnv?: string;
  refreshToken: string;
  refreshTokenExpiresIn?: number;
  signal?: AbortSignal;
  timeoutMs?: number;
  tokenUrl?: string;
}): Promise<LinearTokenSet> {
  return await requestLinearOAuthToken({
    body: new URLSearchParams({
      client_id: input.clientId,
      client_secret: input.clientSecret,
      grant_type: "refresh_token",
      refresh_token: input.refreshToken,
    }),
    failureCode: "LINEAR_TOKEN_REFRESH_FAILED",
    failureMessage: "Linear OAuth token refresh failed.",
    fetch: input.fetch,
    nodeEnv: input.nodeEnv,
    previousRefreshToken: input.refreshToken,
    previousRefreshTokenExpiresIn: input.refreshTokenExpiresIn,
    signal: input.signal,
    timeoutMs: input.timeoutMs,
    tokenUrl: input.tokenUrl,
  });
}

export async function revokeLinearOAuthToken(input: {
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
          input.timeoutMs ?? DEFAULT_LINEAR_OAUTH_TIMEOUT_MS
        );

  try {
    const revokeUrl = input.revokeUrl ?? DEFAULT_LINEAR_ENDPOINTS.oauthRevokeUrl;
    assertLinearEndpointAllowed({
      defaultValue: DEFAULT_LINEAR_ENDPOINTS.oauthRevokeUrl,
      nodeEnv: input.nodeEnv,
      value: revokeUrl,
    });

    const response = await requestFetch(revokeUrl, {
      body: new URLSearchParams({
        client_id: input.clientId,
        client_secret: input.clientSecret,
        token: input.token,
      }),
      headers: {
        accept: "application/json",
        "content-type": "application/x-www-form-urlencoded",
      },
      method: "POST",
      signal,
    });

    if (!response.ok) {
      throw new LinearAppNodeError(
        "LINEAR_REVOKE_FAILED",
        "Linear OAuth token revocation failed."
      );
    }
  } catch (error) {
    if (error instanceof LinearAppNodeError) {
      throw error;
    }
    throw new LinearAppNodeError(
      "LINEAR_REVOKE_FAILED",
      "Linear OAuth token revocation failed.",
      error
    );
  } finally {
    if (timeout !== undefined) {
      clearTimeout(timeout);
    }
  }
}

async function requestLinearOAuthToken(
  input: RequestLinearOAuthTokenInput
): Promise<LinearTokenSet> {
  const requestFetch = input.fetch ?? fetch;
  const abortController = input.signal ? undefined : new AbortController();
  const signal = input.signal ?? abortController?.signal;
  const timeout =
    abortController === undefined
      ? undefined
      : setTimeout(
          () => abortController.abort(),
          input.timeoutMs ?? DEFAULT_LINEAR_OAUTH_TIMEOUT_MS
        );

  try {
    const tokenUrl = input.tokenUrl ?? DEFAULT_LINEAR_ENDPOINTS.oauthTokenUrl;
    assertLinearEndpointAllowed({
      defaultValue: DEFAULT_LINEAR_ENDPOINTS.oauthTokenUrl,
      nodeEnv: input.nodeEnv,
      value: tokenUrl,
    });

    const response = await requestFetch(tokenUrl, {
      body: input.body,
      headers: {
        accept: "application/json",
        "content-type": "application/x-www-form-urlencoded",
      },
      method: "POST",
      signal,
    });

    const json = await response.json().catch(() => null);
    const parsed = linearOAuthTokenResponseSchema.safeParse(json);
    if (!(response.ok && parsed.success)) {
      throw new LinearAppNodeError(input.failureCode, input.failureMessage);
    }

    return {
      accessToken: parsed.data.access_token,
      accessTokenExpiresIn: parsed.data.expires_in,
      refreshToken: parsed.data.refresh_token ?? input.previousRefreshToken,
      refreshTokenExpiresIn:
        parsed.data.refresh_token_expires_in ??
        input.previousRefreshTokenExpiresIn,
      scope: parsed.data.scope,
      scopes: parseLinearScopes(parsed.data.scope),
      tokenType: parsed.data.token_type,
    };
  } catch (error) {
    if (error instanceof LinearAppNodeError) {
      throw error;
    }
    throw new LinearAppNodeError(
      input.failureCode,
      input.failureMessage,
      error
    );
  } finally {
    if (timeout !== undefined) {
      clearTimeout(timeout);
    }
  }
}

function base64url(bytes: Buffer): string {
  return bytes.toString("base64url");
}

function parseLinearScopes(scope: string | undefined): string[] {
  return scope?.split(/[,\s]+/).filter(Boolean) ?? [];
}
