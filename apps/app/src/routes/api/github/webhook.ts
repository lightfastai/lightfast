import { handleGitHubWebhookRequest } from "@api/app/internal-api/github-webhook";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/github/webhook")({
  server: {
    handlers: {
      POST: ({ request }) => handleGitHubWebhookRequest(request),
    },
  },
});
