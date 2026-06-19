import { createFileRoute } from "@tanstack/react-router";
import { githubSetupRedirectPaths } from "~/org/setup/setup-paths";

async function handleGitHubOAuthCallbackRouteRequest(request: Request) {
  const { handleGitHubOAuthCallbackRequest } = await import(
    "@api/app/internal-api/github-oauth"
  );

  return handleGitHubOAuthCallbackRequest(request, {
    redirectPaths: githubSetupRedirectPaths,
  });
}

export const Route = createFileRoute("/api/github/oauth/callback")({
  server: {
    handlers: {
      GET: ({ request }) => handleGitHubOAuthCallbackRouteRequest(request),
    },
  },
});
