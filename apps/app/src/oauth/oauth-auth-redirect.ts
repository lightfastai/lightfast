import { redirect } from "@tanstack/react-router";

export function oauthRequestRedirectTarget(requestUrl: string): string {
  try {
    const url = new URL(requestUrl);
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return requestUrl.startsWith("/") ? requestUrl : "/";
  }
}

export function redirectToSignInForOAuth(requestUrl: string): never {
  throw redirect({
    search: { redirect_url: oauthRequestRedirectTarget(requestUrl) },
    throw: true,
    to: "/sign-in",
  });
}
