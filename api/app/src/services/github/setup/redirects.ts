import type { GitHubBindErrorCode } from "@lightfast/connector-github/contract";

export interface GitHubRedirectResult {
  redirectUrl: string;
}

export function bindPageUrl(input: {
  appOrigin: string;
  code?: GitHubBindErrorCode;
  orgSlug: string;
}): string {
  const url = new URL(`/${input.orgSlug}/tasks/bind`, input.appOrigin);
  if (input.code) {
    url.searchParams.set("github_error", input.code);
  }
  return url.toString();
}

export function completionPageUrl(input: {
  appOrigin: string;
  orgSlug: string;
}): string {
  return new URL(
    `/${input.orgSlug}/tasks/bind/github/complete`,
    input.appOrigin
  ).toString();
}

export function missingAttemptRedirect(input: {
  appOrigin: string;
}): GitHubRedirectResult {
  const url = new URL("/account/teams", input.appOrigin);
  url.searchParams.set("github_error", "expired_state");
  return { redirectUrl: url.toString() };
}

export function errorRedirect(input: {
  appOrigin: string;
  code: GitHubBindErrorCode;
  orgSlug: string;
}): GitHubRedirectResult {
  return { redirectUrl: bindPageUrl(input) };
}

export function signInRedirect(input: {
  appOrigin: string;
  requestUrl: string;
}): GitHubRedirectResult {
  const callbackUrl = new URL(input.requestUrl);
  const signInUrl = new URL("/sign-in", input.appOrigin);
  signInUrl.searchParams.set(
    "redirect_url",
    `${callbackUrl.pathname}${callbackUrl.search}`
  );
  return { redirectUrl: signInUrl.toString() };
}
