import type { GitHubUserAccountBindErrorCode } from "@lightfast/connector-github/contract";

export interface GitHubUserAccountRedirectResult {
  redirectUrl: string;
}

export function accountTaskUrl(input: { appOrigin: string }): string {
  return new URL("/account/tasks/github", input.appOrigin).toString();
}

export function userAccountCompleteUrl(input: {
  appOrigin: string;
  returnTo?: string;
}): string {
  const url = new URL("/account/tasks/github/complete", input.appOrigin);
  if (input.returnTo) {
    url.searchParams.set("return_to", input.returnTo);
  }
  return url.toString();
}

export function accountTaskErrorRedirect(input: {
  appOrigin: string;
  code: GitHubUserAccountBindErrorCode;
}): GitHubUserAccountRedirectResult {
  const url = new URL("/account/tasks/github", input.appOrigin);
  url.searchParams.set("github_error", input.code);
  return { redirectUrl: url.toString() };
}

export function missingUserAccountAttemptRedirect(input: {
  appOrigin: string;
}): GitHubUserAccountRedirectResult {
  return accountTaskErrorRedirect({
    appOrigin: input.appOrigin,
    code: "expired_state",
  });
}

export function userAccountSignInRedirect(input: {
  appOrigin: string;
  requestUrl: string;
}): GitHubUserAccountRedirectResult {
  const callbackUrl = new URL(input.requestUrl);
  const signInUrl = new URL("/sign-in", input.appOrigin);
  signInUrl.searchParams.set(
    "redirect_url",
    `${callbackUrl.pathname}${callbackUrl.search}`
  );
  return { redirectUrl: signInUrl.toString() };
}
