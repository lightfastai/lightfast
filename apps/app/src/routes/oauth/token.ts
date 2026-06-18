import { handleMcpOAuthTokenRequest } from "@api/app/mcp-oauth/server-routes";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/oauth/token")({
  server: {
    handlers: {
      POST: ({ request }) => handleMcpOAuthTokenRequest(request),
    },
  },
});
