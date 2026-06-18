import { createFileRoute } from "@tanstack/react-router";

async function handleGitHubWebhookRouteRequest(request: Request) {
  const { handleGitHubWebhookRequest } = await import(
    "@api/app/internal-api/github-webhook"
  );

  return handleGitHubWebhookRequest(request);
}

export const Route = createFileRoute("/api/github/webhook")({
  server: {
    handlers: {
      POST: ({ request }) => handleGitHubWebhookRouteRequest(request),
    },
  },
});
