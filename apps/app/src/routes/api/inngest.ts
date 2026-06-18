import { handleInngestRequest } from "@api/app/internal-api/inngest";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/inngest")({
  server: {
    handlers: {
      GET: async ({ request }) => handleInngestRequest(request, "GET"),
      POST: async ({ request }) => handleInngestRequest(request, "POST"),
      PUT: async ({ request }) => handleInngestRequest(request, "PUT"),
    },
  },
});
