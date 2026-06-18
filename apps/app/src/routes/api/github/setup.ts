import { createFileRoute } from "@tanstack/react-router";

async function handleGitHubInstallationSetupRouteRequest(request: Request) {
  const { handleGitHubInstallationSetupRequest } = await import(
    "@api/app/internal-api/github-oauth"
  );

  return handleGitHubInstallationSetupRequest(request);
}

export const Route = createFileRoute("/api/github/setup")({
  server: {
    handlers: {
      GET: ({ request }) => handleGitHubInstallationSetupRouteRequest(request),
    },
  },
});
