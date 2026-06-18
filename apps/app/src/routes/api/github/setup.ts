import { handleGitHubInstallationSetupRequest } from "@api/app/internal-api/github-oauth";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/github/setup")({
  server: {
    handlers: {
      GET: ({ request }) => handleGitHubInstallationSetupRequest(request),
    },
  },
});
