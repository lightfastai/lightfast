import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/github/setup")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { completeGitHubInstallationSetup } = await import(
          "@api/app/services/github"
        );
        const result = await completeGitHubInstallationSetup({
          requestUrl: request.url,
        });
        return Response.redirect(result.redirectUrl);
      },
    },
  },
});
