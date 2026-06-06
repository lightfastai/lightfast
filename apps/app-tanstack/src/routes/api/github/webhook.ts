import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/github/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { handleGitHubWebhook } = await import(
          "@api/app/services/github"
        );
        return handleGitHubWebhook({ request });
      },
    },
  },
});
