import { handleAppHealthRequest } from "@api/app/internal-api/health";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: ({ request }) => handleAppHealthRequest(request),
    },
  },
});
