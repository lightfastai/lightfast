import { z } from "zod";
import { GitHubAppNodeError } from "./errors";
import {
  fetchGitHubJson,
  githubJsonHeaders,
  normalizeGitHubApiBaseUrl,
} from "./github-api";

const installationTokenResponseSchema = z.object({
  expires_at: z.string().min(1),
  token: z.string().min(1),
});

export async function createGitHubInstallationToken(input: {
  apiBaseUrl?: string;
  apiVersion?: string;
  appJwt: string;
  fetch?: typeof fetch;
  installationId: string;
  signal?: AbortSignal;
}): Promise<{ expiresAt: string; token: string }> {
  const requestFetch = input.fetch ?? fetch;
  const apiBaseUrl = normalizeGitHubApiBaseUrl(input.apiBaseUrl);
  const url = `${apiBaseUrl}/app/installations/${input.installationId}/access_tokens`;

  const { json, response } = await fetchGitHubJson({
    fetch: requestFetch,
    init: {
      method: "POST",
      headers: githubJsonHeaders({
        apiVersion: input.apiVersion,
        token: input.appJwt,
      }),
      signal: input.signal,
    },
    requestErrorCode: "GITHUB_API_REQUEST_FAILED",
    requestErrorMessage: "GitHub installation token request failed.",
    url,
  });

  const parsed = installationTokenResponseSchema.safeParse(json);
  if (!(response.ok && parsed.success)) {
    throw new GitHubAppNodeError(
      "GITHUB_API_RESPONSE_INVALID",
      "GitHub installation token response was invalid."
    );
  }

  return {
    expiresAt: parsed.data.expires_at,
    token: parsed.data.token,
  };
}
