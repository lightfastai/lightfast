import { createFileRoute } from "@tanstack/react-router";
import { githubSetupRedirectPaths } from "~/org/setup/setup-paths";

async function handleGitHubInstallationSetupRouteRequest(request: Request) {
  const { handleGitHubInstallationSetupRequest } = await import(
    "@api/app/internal-api/github-oauth"
  );

  return handleGitHubInstallationSetupRequest(request, {
    redirectPaths: githubSetupRedirectPaths,
  });
}

export const Route = createFileRoute("/api/github/setup")({
  server: {
    handlers: {
      GET: ({ request }) => handleGitHubInstallationSetupRouteRequest(request),
    },
  },
});
