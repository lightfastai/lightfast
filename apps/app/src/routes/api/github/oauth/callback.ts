import { handleGitHubOAuthCallbackRequest } from "@api/app/internal-api/github-oauth";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/github/oauth/callback")({
  server: {
    handlers: {
      GET: ({ request }) => handleGitHubOAuthCallbackRequest(request),
    },
  },
});
