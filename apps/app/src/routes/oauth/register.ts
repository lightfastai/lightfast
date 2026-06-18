import { handleRegisterMcpOAuthClientRequest } from "@api/app/mcp-oauth/server-routes";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/oauth/register")({
  server: {
    handlers: {
      POST: ({ request }) => handleRegisterMcpOAuthClientRequest(request),
    },
  },
});
