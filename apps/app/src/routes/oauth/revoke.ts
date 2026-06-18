import { handleMcpOAuthRevokeRequest } from "@api/app/mcp-oauth/server-routes";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/oauth/revoke")({
  server: {
    handlers: {
      POST: ({ request }) => handleMcpOAuthRevokeRequest(request),
    },
  },
});
