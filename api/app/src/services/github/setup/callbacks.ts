export interface GitHubInstallationSetupCallback {
  installationId: string;
  setupAction?: string;
  state: string;
}

export interface GitHubOAuthCallback {
  code: string | null;
  denied: string | null;
  state: string | null;
}

export function parseGitHubInstallationSetupCallback(
  requestUrl: string
): GitHubInstallationSetupCallback | null {
  const url = new URL(requestUrl);
  const state = url.searchParams.get("state");
  const installationId = url.searchParams.get("installation_id");
  if (!(state && installationId)) {
    return null;
  }
  return {
    installationId,
    setupAction: url.searchParams.get("setup_action") ?? undefined,
    state,
  };
}

export function parseGitHubOAuthCallback(
  requestUrl: string
): GitHubOAuthCallback {
  const url = new URL(requestUrl);
  return {
    code: url.searchParams.get("code"),
    denied: url.searchParams.get("error"),
    state: url.searchParams.get("state"),
  };
}
