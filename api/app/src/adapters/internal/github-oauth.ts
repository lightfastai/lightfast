import {
  completeGitHubInstallationSetup,
  completeGitHubOAuthVerification,
  type GitHubSetupRedirectPaths,
} from "../../services/github/setup/flow";
import { completeGitHubUserAccountOAuth } from "../../services/github/user-account/flow";

export type { GitHubSetupRedirectPaths };

interface GitHubSetupRouteOptions {
  redirectPaths: GitHubSetupRedirectPaths;
}

export async function handleGitHubInstallationSetupRequest(
  request: Request,
  options: GitHubSetupRouteOptions
): Promise<Response> {
  const result = await completeGitHubInstallationSetup({
    redirectPaths: options.redirectPaths,
    requestUrl: request.url,
  });
  return Response.redirect(result.redirectUrl);
}

export async function handleGitHubOAuthCallbackRequest(
  request: Request,
  options: GitHubSetupRouteOptions
): Promise<Response> {
  const result = await completeGitHubOAuthVerification({
    redirectPaths: options.redirectPaths,
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
