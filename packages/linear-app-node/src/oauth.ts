import { createHash, randomBytes } from "node:crypto";

import { z } from "zod";

import { DEFAULT_LINEAR_ENDPOINTS } from "./config";
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
  failureCode:
    | "LINEAR_OAUTH_EXCHANGE_FAILED"
    | "LINEAR_TOKEN_REFRESH_FAILED";
  failureMessage: string;
  fetch?: typeof fetch;
  previousRefreshToken?: string;
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
  oauthAuthorizeUrl?: string;
  state: string;
}): string {
  const url = new URL(
    input.oauthAuthorizeUrl ?? DEFAULT_LINEAR_ENDPOINTS.oauthAuthorizeUrl
  );
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
    signal: input.signal,
    timeoutMs: input.timeoutMs,
    tokenUrl: input.tokenUrl,
  });
}

export async function refreshLinearOAuthToken(input: {
  clientId: string;
  clientSecret: string;
  fetch?: typeof fetch;
  refreshToken: string;
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
    previousRefreshToken: input.refreshToken,
    signal: input.signal,
    timeoutMs: input.timeoutMs,
    tokenUrl: input.tokenUrl,
  });
}

export async function revokeLinearOAuthToken(input: {
  clientId: string;
  clientSecret: string;
  fetch?: typeof fetch;
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
    const response = await requestFetch(
      input.revokeUrl ?? DEFAULT_LINEAR_ENDPOINTS.oauthRevokeUrl,
      {
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
      }
    );

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
    const response = await requestFetch(
      input.tokenUrl ?? DEFAULT_LINEAR_ENDPOINTS.oauthTokenUrl,
      {
        body: input.body,
        headers: {
          accept: "application/json",
          "content-type": "application/x-www-form-urlencoded",
        },
        method: "POST",
        signal,
      }
    );

    const json = await response.json().catch(() => null);
    const parsed = linearOAuthTokenResponseSchema.safeParse(json);
    if (!(response.ok && parsed.success)) {
      throw new LinearAppNodeError(input.failureCode, input.failureMessage);
    }

    return {
      accessToken: parsed.data.access_token,
      accessTokenExpiresIn: parsed.data.expires_in,
      refreshToken: parsed.data.refresh_token ?? input.previousRefreshToken,
      refreshTokenExpiresIn: parsed.data.refresh_token_expires_in,
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
