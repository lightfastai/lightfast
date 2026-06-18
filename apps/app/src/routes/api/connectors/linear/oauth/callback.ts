import { handleLinearConnectorOAuthCallbackRequest } from "@api/app/internal-api/connector-oauth";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/connectors/linear/oauth/callback")({
  server: {
    handlers: {
      GET: ({ request }) => handleLinearConnectorOAuthCallbackRequest(request),
    },
  },
});
