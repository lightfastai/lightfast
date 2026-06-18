import { handleXConnectorOAuthCallbackRequest } from "@api/app/internal-api/connector-oauth";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/connectors/x/oauth/callback")({
  server: {
    handlers: {
      GET: ({ request }) => handleXConnectorOAuthCallbackRequest(request),
    },
  },
});
