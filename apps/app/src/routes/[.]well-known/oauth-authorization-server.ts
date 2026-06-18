import { handleMcpOAuthAuthorizationServerMetadataRequest } from "@api/app/mcp-oauth/server-routes";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/.well-known/oauth-authorization-server")(
  {
    server: {
      handlers: {
        GET: () => handleMcpOAuthAuthorizationServerMetadataRequest(),
      },
    },
  }
);
