import {
  completeGitHubInstallationSetup,
  completeGitHubOAuthVerification,
  completeGitHubUserAccountOAuth,
} from "../../services/github";

export async function handleGitHubInstallationSetupRequest(
  request: Request
): Promise<Response> {
  const result = await completeGitHubInstallationSetup({
    requestUrl: request.url,
  });
  return Response.redirect(result.redirectUrl);
}

export async function handleGitHubOAuthCallbackRequest(
  request: Request
): Promise<Response> {
  const result = await completeGitHubOAuthVerification({
    requestUrl: request.url,
  });
  return Response.redirect(result.redirectUrl);
}

export async function handleGitHubUserAccountOAuthCallbackRequest(
  request: Request
): Promise<Response> {
  const result = await completeGitHubUserAccountOAuth({
    requestUrl: request.url,
  });
  return Response.redirect(result.redirectUrl);
}
