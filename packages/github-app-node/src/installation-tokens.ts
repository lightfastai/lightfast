import { z } from "zod";
import { GitHubAppNodeError } from "./errors";

const installationTokenResponseSchema = z.object({
  expires_at: z.string().min(1),
  token: z.string().min(1),
});

function normalizeApiBaseUrl(value: string | undefined) {
  return (value ?? "https://api.github.com").replace(/\/+$/, "");
}

export async function createGitHubInstallationToken(input: {
  apiBaseUrl?: string;
  apiVersion?: string;
  appJwt: string;
  fetch?: typeof fetch;
  installationId: string;
}): Promise<{ expiresAt: string; token: string }> {
  const requestFetch = input.fetch ?? fetch;
  const apiBaseUrl = normalizeApiBaseUrl(input.apiBaseUrl);
  const url = `${apiBaseUrl}/app/installations/${input.installationId}/access_tokens`;

  let res: Response;
  try {
    res = await requestFetch(url, {
      method: "POST",
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${input.appJwt}`,
        ...(input.apiVersion
          ? { "x-github-api-version": input.apiVersion }
          : {}),
      },
    });
  } catch {
    throw new GitHubAppNodeError(
      "GITHUB_API_REQUEST_FAILED",
      "GitHub installation token request failed."
    );
  }

  const json = await res.json().catch(() => null);
  const parsed = installationTokenResponseSchema.safeParse(json);
  if (!(res.ok && parsed.success)) {
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
