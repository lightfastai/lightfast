import { createFileRoute } from "@tanstack/react-router";

async function handleMcpOAuthJwksRouteRequest() {
  const { handleMcpOAuthJwksRequest } = await import(
    "@api/app/mcp-oauth/server-routes"
  );

  return handleMcpOAuthJwksRequest();
}

export const Route = createFileRoute("/oauth/jwks")({
  server: {
    handlers: {
      GET: () => handleMcpOAuthJwksRouteRequest(),
    },
  },
});
