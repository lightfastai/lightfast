import { Buffer } from "node:buffer";
import { z } from "zod";

import { GitHubAppNodeError } from "./errors";

const DEFAULT_GITHUB_OAUTH_EXCHANGE_TIMEOUT_MS = 10_000;
const DEFAULT_GITHUB_API_VERSION = "2022-11-28";

const githubOAuthTokenResponseSchema = z.object({
  access_token: z.string().min(1),
  expires_in: z.number().int().positive().optional(),
  refresh_token: z.string().min(1).optional(),
  refresh_token_expires_in: z.number().int().positive().optional(),
  scope: z.string().optional(),
  token_type: z.string().min(1),
});

const githubOAuthErrorResponseSchema = z.object({
  error: z.string().min(1),
  error_description: z.string().optional(),
  error_uri: z.string().optional(),
});

export interface GitHubUserTokenSet {
  accessToken: string;
  accessTokenExpiresIn?: number;
  refreshToken?: string;
  refreshTokenExpiresIn?: number;
  scope?: string;
  tokenType: string;
}

type GitHubOAuthTokenFailureCode =
  | "GITHUB_OAUTH_EXCHANGE_FAILED"
  | "GITHUB_OAUTH_REFRESH_TOKEN_INVALID";

interface RequestGitHubOAuthTokenInput {
  body: Record<string, string>;
  failureCode: (json: unknown) => GitHubOAuthTokenFailureCode;
  failureMessage: string;
  fetch?: typeof fetch;
  signal?: AbortSignal;
  timeoutMs?: number;
  tokenUrl?: string;
}

export interface ExchangeGitHubOAuthCodeInput {
  clientId: string;
  clientSecret: string;
  code: string;
  codeVerifier: string;
  fetch?: typeof fetch;
  redirectUri: string;
  signal?: AbortSignal;
  timeoutMs?: number;
  tokenUrl?: string;
}

export async function exchangeGitHubOAuthCode(
  input: ExchangeGitHubOAuthCodeInput
): Promise<GitHubUserTokenSet> {
  return await requestGitHubOAuthToken({
    body: {
      client_id: input.clientId,
      client_secret: input.clientSecret,
      code: input.code,
      code_verifier: input.codeVerifier,
      redirect_uri: input.redirectUri,
    },
    failureCode: () => "GITHUB_OAUTH_EXCHANGE_FAILED",
    failureMessage: "GitHub OAuth code exchange failed.",
    fetch: input.fetch,
    signal: input.signal,
    timeoutMs: input.timeoutMs,
    tokenUrl: input.tokenUrl,
  });
}

export interface RefreshGitHubUserAccessTokenInput {
  clientId: string;
  clientSecret: string;
  fetch?: typeof fetch;
  refreshToken: string;
  signal?: AbortSignal;
  timeoutMs?: number;
  tokenUrl?: string;
}

export async function refreshGitHubUserAccessToken(
  input: RefreshGitHubUserAccessTokenInput
): Promise<GitHubUserTokenSet> {
  return await requestGitHubOAuthToken({
    body: {
      client_id: input.clientId,
      client_secret: input.clientSecret,
      grant_type: "refresh_token",
      refresh_token: input.refreshToken,
    },
    failureCode: refreshTokenFailureCode,
    failureMessage: "GitHub OAuth token refresh failed.",
    fetch: input.fetch,
    signal: input.signal,
    timeoutMs: input.timeoutMs,
    tokenUrl: input.tokenUrl,
  });
}

async function requestGitHubOAuthToken(
  input: RequestGitHubOAuthTokenInput
): Promise<GitHubUserTokenSet> {
  const requestFetch = input.fetch ?? fetch;
  const abortController = input.signal ? undefined : new AbortController();
  const signal = input.signal ?? abortController?.signal;
  const timeout =
    abortController === undefined
      ? undefined
      : setTimeout(
          () => abortController.abort(),
          input.timeoutMs ?? DEFAULT_GITHUB_OAUTH_EXCHANGE_TIMEOUT_MS
        );

  try {
    const res = await requestFetch(
      input.tokenUrl ?? "https://github.com/login/oauth/access_token",
      {
        method: "POST",
        signal,
        headers: {
          accept: "application/json",
          "content-type": "application/json",
        },
        body: JSON.stringify(input.body),
      }
    );

    const json = await res.json().catch(() => null);
    const parsed = githubOAuthTokenResponseSchema.safeParse(json);
    if (!(res.ok && parsed.success)) {
      throw new GitHubAppNodeError(
        input.failureCode(json),
        input.failureMessage
      );
    }

    return {
      accessToken: parsed.data.access_token,
      accessTokenExpiresIn: parsed.data.expires_in,
      refreshToken: parsed.data.refresh_token,
      refreshTokenExpiresIn: parsed.data.refresh_token_expires_in,
      scope: parsed.data.scope,
      tokenType: parsed.data.token_type,
    };
  } catch (error) {
    if (error instanceof GitHubAppNodeError) {
      throw error;
    }
    throw new GitHubAppNodeError(
      "GITHUB_OAUTH_EXCHANGE_FAILED",
      input.failureMessage
    );
  } finally {
    if (timeout !== undefined) {
      clearTimeout(timeout);
    }
  }
}

function refreshTokenFailureCode(
  json: unknown
): "GITHUB_OAUTH_EXCHANGE_FAILED" | "GITHUB_OAUTH_REFRESH_TOKEN_INVALID" {
  const parsed = githubOAuthErrorResponseSchema.safeParse(json);
  return parsed.success && parsed.data.error === "bad_refresh_token"
    ? "GITHUB_OAUTH_REFRESH_TOKEN_INVALID"
    : "GITHUB_OAUTH_EXCHANGE_FAILED";
}

export interface RevokeGitHubOAuthGrantInput {
  accessToken: string;
  apiBaseUrl?: string;
  apiVersion?: string;
  clientId: string;
  clientSecret: string;
  fetch?: typeof fetch;
  signal?: AbortSignal;
  timeoutMs?: number;
}

export async function revokeGitHubOAuthGrant(
  input: RevokeGitHubOAuthGrantInput
): Promise<void> {
  const requestFetch = input.fetch ?? fetch;
  const abortController = input.signal ? undefined : new AbortController();
  const signal = input.signal ?? abortController?.signal;
  const timeout =
    abortController === undefined
      ? undefined
      : setTimeout(
          () => abortController.abort(),
          input.timeoutMs ?? DEFAULT_GITHUB_OAUTH_EXCHANGE_TIMEOUT_MS
        );

  try {
    const baseUrl = input.apiBaseUrl ?? "https://api.github.com";
    const url = new URL(
      `/applications/${encodeURIComponent(input.clientId)}/grant`,
      baseUrl
    );
    const res = await requestFetch(url.toString(), {
      method: "DELETE",
      signal,
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Basic ${Buffer.from(
          `${input.clientId}:${input.clientSecret}`
        ).toString("base64")}`,
        "content-type": "application/json",
        "x-github-api-version": input.apiVersion ?? DEFAULT_GITHUB_API_VERSION,
      },
      body: JSON.stringify({ access_token: input.accessToken }),
    });

    if (res.status !== 204) {
      throw new GitHubAppNodeError(
        "GITHUB_OAUTH_REVOKE_FAILED",
        "GitHub OAuth grant revocation failed."
      );
    }
  } catch (error) {
    if (error instanceof GitHubAppNodeError) {
      throw error;
    }
    throw new GitHubAppNodeError(
      "GITHUB_OAUTH_REVOKE_FAILED",
      "GitHub OAuth grant revocation failed."
    );
  } finally {
    if (timeout !== undefined) {
      clearTimeout(timeout);
    }
  }
}
