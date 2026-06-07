import { redirect } from "@tanstack/react-router";

export function redirectToSignInForOAuth(requestUrl: string): never {
  throw redirect({
    search: { redirect_url: requestUrl },
    throw: true,
    to: "/sign-in",
  });
}
