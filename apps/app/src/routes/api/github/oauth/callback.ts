import { createFileRoute } from "@tanstack/react-router";

async function handleGitHubOAuthCallbackRouteRequest(request: Request) {
  const { handleGitHubOAuthCallbackRequest } = await import(
    "@api/app/internal-api/github-oauth"
  );

  return handleGitHubOAuthCallbackRequest(request);
}

export const Route = createFileRoute("/api/github/oauth/callback")({
  server: {
    handlers: {
      GET: ({ request }) => handleGitHubOAuthCallbackRouteRequest(request),
    },
  },
});
