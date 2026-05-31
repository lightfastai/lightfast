export interface GitHubUserAccountOAuthCallback {
  code: string | null;
  denied: string | null;
  state: string | null;
}

export function parseGitHubUserAccountOAuthCallback(
  requestUrl: string
): GitHubUserAccountOAuthCallback {
  const url = new URL(requestUrl);
  return {
    code: url.searchParams.get("code"),
    denied: url.searchParams.get("error"),
    state: url.searchParams.get("state"),
  };
}
