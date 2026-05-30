import { z } from "zod";

import { GitHubAppNodeError } from "./errors";

const DEFAULT_GITHUB_OAUTH_EXCHANGE_TIMEOUT_MS = 10_000;

const githubOAuthTokenResponseSchema = z.object({
  access_token: z.string().min(1),
  token_type: z.string().min(1),
});

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
): Promise<{ accessToken: string; tokenType: string }> {
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
