export function buildGitHubInstallationUrl(input: {
  appSlug: string;
  installUrlOverride?: string | null;
  state: string;
}): string {
  const url = input.installUrlOverride
    ? new URL(input.installUrlOverride)
    : new URL(`https://github.com/apps/${input.appSlug}/installations/new`);
  url.searchParams.set("state", input.state);
  return url.toString();
}

export function buildGitHubOAuthAuthorizeUrl(input: {
  authorizationBaseUrl?: string;
  clientId: string;
  codeChallenge: string;
  redirectUri: string;
  state: string;
}): string {
  const url = new URL(
    input.authorizationBaseUrl ?? "https://github.com/login/oauth/authorize"
  );
  url.searchParams.set("client_id", input.clientId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("state", input.state);
  url.searchParams.set("code_challenge", input.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}
