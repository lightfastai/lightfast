import { handleMcpOAuthJwksRequest } from "@api/app/mcp-oauth/server-routes";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/oauth/jwks")({
  server: {
    handlers: {
      GET: () => handleMcpOAuthJwksRequest(),
    },
  },
});
