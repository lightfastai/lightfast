import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/github/oauth/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { completeGitHubOAuthVerification } = await import(
          "@api/app/services/github"
        );
        const result = await completeGitHubOAuthVerification({
          requestUrl: request.url,
        });
        return Response.redirect(result.redirectUrl);
      },
    },
  },
});
