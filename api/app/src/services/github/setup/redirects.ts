import type { GitHubBindErrorCode } from "@lightfast/connector-github/contract";

export interface GitHubRedirectResult {
  redirectUrl: string;
}

export interface GitHubSetupRedirectPaths {
  accountTeams(): string;
  bind(input: { orgSlug: string }): string;
  complete(input: { orgSlug: string }): string;
  signIn(): string;
}

export function bindPageUrl(input: {
  appOrigin: string;
  code?: GitHubBindErrorCode;
  orgSlug: string;
  redirectPaths: GitHubSetupRedirectPaths;
}): string {
  const url = new URL(
    input.redirectPaths.bind({ orgSlug: input.orgSlug }),
    input.appOrigin
  );
  if (input.code) {
    url.searchParams.set("github_error", input.code);
  }
  return url.toString();
}

export function completionPageUrl(input: {
  appOrigin: string;
  orgSlug: string;
  redirectPaths: GitHubSetupRedirectPaths;
}): string {
  return new URL(
    input.redirectPaths.complete({ orgSlug: input.orgSlug }),
    input.appOrigin
  ).toString();
}

export function missingAttemptRedirect(input: {
  appOrigin: string;
  redirectPaths: GitHubSetupRedirectPaths;
}): GitHubRedirectResult {
  const url = new URL(input.redirectPaths.accountTeams(), input.appOrigin);
  url.searchParams.set("github_error", "expired_state");
  return { redirectUrl: url.toString() };
}

export function errorRedirect(input: {
  appOrigin: string;
  code: GitHubBindErrorCode;
  orgSlug: string;
  redirectPaths: GitHubSetupRedirectPaths;
}): GitHubRedirectResult {
  return { redirectUrl: bindPageUrl(input) };
}

export function signInRedirect(input: {
  appOrigin: string;
  redirectPaths: GitHubSetupRedirectPaths;
  requestUrl: string;
}): GitHubRedirectResult {
  const callbackUrl = new URL(input.requestUrl);
  const signInUrl = new URL(input.redirectPaths.signIn(), input.appOrigin);
  signInUrl.searchParams.set(
    "redirect_url",
    `${callbackUrl.pathname}${callbackUrl.search}`
  );
  return { redirectUrl: signInUrl.toString() };
}
