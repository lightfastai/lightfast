import { z } from "zod";

import { GitHubAppNodeError } from "./errors";

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
  tokenUrl?: string;
}

export async function exchangeGitHubOAuthCode(
  input: ExchangeGitHubOAuthCodeInput
): Promise<{ accessToken: string; tokenType: string }> {
  const requestFetch = input.fetch ?? fetch;
  let res: Response;
  try {
    res = await requestFetch(
      input.tokenUrl ?? "https://github.com/login/oauth/access_token",
      {
        method: "POST",
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
  } catch {
    throw new GitHubAppNodeError(
      "GITHUB_OAUTH_EXCHANGE_FAILED",
      "GitHub OAuth code exchange failed."
    );
  }

  const json = await res.json().catch(() => null);
  const parsed = githubOAuthTokenResponseSchema.safeParse(json);
  if (!res.ok || !parsed.success) {
    throw new GitHubAppNodeError(
      "GITHUB_OAUTH_EXCHANGE_FAILED",
      "GitHub OAuth code exchange failed."
    );
  }

  return {
    accessToken: parsed.data.access_token,
    tokenType: parsed.data.token_type,
  };
}
