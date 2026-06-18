function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

export function buildGitHubInstallationUrl(input: {
  appSlug: string;
  state: string;
  webBaseUrl?: string;
}): string {
  const baseUrl = trimTrailingSlash(input.webBaseUrl ?? "https://github.com");
  const url = new URL(`/apps/${input.appSlug}/installations/new`, baseUrl);
  url.searchParams.set("state", input.state);
  return url.toString();
}

export function buildGitHubNewRepositoryUrl(input: {
  accountLogin: string;
  name: string;
  webBaseUrl?: string;
}): string {
  const baseUrl = trimTrailingSlash(input.webBaseUrl ?? "https://github.com");
  const url = new URL(
    `/organizations/${input.accountLogin}/repositories/new`,
    baseUrl
  );
  url.searchParams.set("name", input.name);
  return url.toString();
}

export function buildGitHubRepositoryUrl(input: {
  fullName: string;
  webBaseUrl?: string;
}): string {
  const baseUrl = trimTrailingSlash(input.webBaseUrl ?? "https://github.com");
  return new URL(`/${input.fullName}`, baseUrl).toString();
}

export function buildGitHubOAuthAuthorizeUrl(input: {
  clientId: string;
  codeChallenge: string;
  oauthAuthorizeUrl?: string;
  redirectUri: string;
  state: string;
}): string {
  const url = new URL(
    input.oauthAuthorizeUrl ?? "https://github.com/login/oauth/authorize"
  );
  url.searchParams.set("client_id", input.clientId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("state", input.state);
  url.searchParams.set("code_challenge", input.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}
