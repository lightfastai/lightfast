import { auth } from "@vendor/clerk/server";

import {
  completeLinearConnectorOAuth,
  completeXConnectorOAuth,
  type XConnectorOAuthRedirectPaths,
} from "../../services/connectors";
import { completeGranolaUserConnectorOAuth } from "../../services/user-connectors";

export type { XConnectorOAuthRedirectPaths };

interface XConnectorOAuthRouteOptions {
  redirectPaths: XConnectorOAuthRedirectPaths;
}

export async function handleLinearConnectorOAuthCallbackRequest(
  request: Request
): Promise<Response> {
  const result = await completeLinearConnectorOAuth({
    requestUrl: request.url,
  });
  return Response.redirect(result.redirectUrl);
}

export async function handleXConnectorOAuthCallbackRequest(
  request: Request,
  options: XConnectorOAuthRouteOptions
): Promise<Response> {
  const result = await completeXConnectorOAuth({
    redirectPaths: options.redirectPaths,
    requestUrl: request.url,
  });
  return Response.redirect(result.redirectUrl);
}

export async function handleGranolaUserConnectorOAuthCallbackRequest(
  request: Request
): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) {
    return accountSettingsRedirect(request.url, error);
  }

  if (!(code && state)) {
    return accountSettingsRedirect(request.url, "missing_oauth_code");
  }

  const session = await auth({ treatPendingAsSignedOut: false });
  const result = await completeGranolaUserConnectorOAuth({
    callbackUserId: session.userId ?? null,
    code,
    requestUrl: request.url,
    state,
  });
  return Response.redirect(result.redirectUrl);
}

function accountSettingsRedirect(requestUrl: string, error: string): Response {
  const url = new URL("/account/settings", requestUrl);
  url.searchParams.set("connector", "granola");
  url.searchParams.set("error", error);
  return Response.redirect(url.toString());
}
