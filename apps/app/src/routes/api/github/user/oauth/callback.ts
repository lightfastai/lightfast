import { createFileRoute } from "@tanstack/react-router";

async function handleGitHubUserAccountOAuthCallbackRouteRequest(
  request: Request
) {
  const { handleGitHubUserAccountOAuthCallbackRequest } = await import(
    "@api/app/internal-api/github-oauth"
  );

  return handleGitHubUserAccountOAuthCallbackRequest(request);
}

export const Route = createFileRoute("/api/github/user/oauth/callback")({
  server: {
    handlers: {
      GET: ({ request }) =>
        handleGitHubUserAccountOAuthCallbackRouteRequest(request),
    },
  },
});
