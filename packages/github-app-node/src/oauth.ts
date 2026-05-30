import { z } from "zod";

import { GitHubAppNodeError } from "./errors";

const DEFAULT_GITHUB_OAUTH_EXCHANGE_TIMEOUT_MS = 10_000;

const githubOAuthTokenResponseSchema = z.object({
  access_token: z.string().min(1),
  expires_in: z.number().int().positive().optional(),
  refresh_token: z.string().min(1).optional(),
  refresh_token_expires_in: z.number().int().positive().optional(),
  scope: z.string().optional(),
  token_type: z.string().min(1),
});

export interface GitHubUserTokenSet {
  accessToken: string;
  accessTokenExpiresIn?: number;
  refreshToken?: string;
  refreshTokenExpiresIn?: number;
  scope?: string;
  tokenType: string;
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
        body: JSON.stringify({
          client_id: input.clientId,
          client_secret: input.clientSecret,
          code: input.code,
          code_verifier: input.codeVerifier,
          redirect_uri: input.redirectUri,
        }),
      }
    );

    const json = await res.json().catch(() => null);
    const parsed = githubOAuthTokenResponseSchema.safeParse(json);
    if (!(res.ok && parsed.success)) {
      throw new GitHubAppNodeError(
        "GITHUB_OAUTH_EXCHANGE_FAILED",
        "GitHub OAuth code exchange failed."
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
      "GitHub OAuth code exchange failed."
    );
  } finally {
    if (timeout !== undefined) {
      clearTimeout(timeout);
    }
  }
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
        body: JSON.stringify({
          client_id: input.clientId,
          client_secret: input.clientSecret,
          grant_type: "refresh_token",
          refresh_token: input.refreshToken,
        }),
      }
    );

    const json = await res.json().catch(() => null);
    const parsed = githubOAuthTokenResponseSchema.safeParse(json);
    if (!(res.ok && parsed.success)) {
      throw new GitHubAppNodeError(
        "GITHUB_OAUTH_EXCHANGE_FAILED",
        "GitHub OAuth token refresh failed."
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
      "GitHub OAuth token refresh failed."
    );
  } finally {
    if (timeout !== undefined) {
      clearTimeout(timeout);
    }
  }
}
