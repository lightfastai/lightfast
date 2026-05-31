import { GitHubAppNodeError, type GitHubAppNodeErrorCode } from "./errors";

export function normalizeGitHubApiBaseUrl(value: string | undefined): string {
  return (value ?? "https://api.github.com").replace(/\/+$/, "");
}

export function githubPathSegment(value: string): string {
  return encodeURIComponent(value);
}

export function githubJsonHeaders(input: {
  apiVersion?: string;
  token: string;
}): Record<string, string> {
  return {
    accept: "application/vnd.github+json",
    authorization: `Bearer ${input.token}`,
    ...(input.apiVersion ? { "x-github-api-version": input.apiVersion } : {}),
  };
}

export async function fetchGitHubJson(input: {
  fetch?: typeof fetch;
  init?: RequestInit;
  requestErrorCode: GitHubAppNodeErrorCode;
  requestErrorMessage: string;
  url: string | URL;
}): Promise<{ json: unknown; response: Response }> {
  let response: Response;
  try {
    response = await (input.fetch ?? fetch)(input.url.toString(), input.init);
  } catch {
    throw new GitHubAppNodeError(
      input.requestErrorCode,
      input.requestErrorMessage
    );
  }

  const json = await response.json().catch(() => null);
  return { json, response };
}
