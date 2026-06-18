import {
  completeLinearConnectorOAuth,
  completeXConnectorOAuth,
} from "../../services/connectors";
import { completeGranolaUserConnectorOAuth } from "../../services/user-connectors";

export async function handleLinearConnectorOAuthCallbackRequest(
  request: Request
): Promise<Response> {
  const result = await completeLinearConnectorOAuth({
    requestUrl: request.url,
  });
  return Response.redirect(result.redirectUrl);
}

export async function handleXConnectorOAuthCallbackRequest(
  request: Request
): Promise<Response> {
  const result = await completeXConnectorOAuth({
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

  const result = await completeGranolaUserConnectorOAuth({
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
