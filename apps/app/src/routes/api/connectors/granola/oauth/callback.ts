import { handleGranolaUserConnectorOAuthCallbackRequest } from "@api/app/internal-api/connector-oauth";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/connectors/granola/oauth/callback")({
  server: {
    handlers: {
      GET: ({ request }) =>
        handleGranolaUserConnectorOAuthCallbackRequest(request),
    },
  },
});
