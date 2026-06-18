import { handleGitHubUserAccountOAuthCallbackRequest } from "@api/app/internal-api/github-oauth";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/github/user/oauth/callback")({
  server: {
    handlers: {
      GET: ({ request }) =>
        handleGitHubUserAccountOAuthCallbackRequest(request),
    },
  },
});
