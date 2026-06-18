import { createFileRoute } from "@tanstack/react-router";

async function handleMcpOAuthAuthorizationServerMetadataRouteRequest() {
  const { handleMcpOAuthAuthorizationServerMetadataRequest } = await import(
    "@api/app/mcp-oauth/server-routes"
  );

  return handleMcpOAuthAuthorizationServerMetadataRequest();
}

export const Route = createFileRoute("/.well-known/oauth-authorization-server")(
  {
    server: {
      handlers: {
        GET: () => handleMcpOAuthAuthorizationServerMetadataRouteRequest(),
      },
    },
  }
);
