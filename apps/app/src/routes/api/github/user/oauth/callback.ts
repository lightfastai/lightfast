import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/github/user/oauth/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { completeGitHubUserAccountOAuth } = await import(
          "@api/app/services/github"
        );
        const result = await completeGitHubUserAccountOAuth({
          requestUrl: request.url,
        });
        return Response.redirect(result.redirectUrl);
      },
    },
  },
});
