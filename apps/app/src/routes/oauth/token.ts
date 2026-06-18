import { createFileRoute } from "@tanstack/react-router";

async function handleMcpOAuthTokenRouteRequest(request: Request) {
  const { handleMcpOAuthTokenRequest } = await import(
    "@api/app/mcp-oauth/server-routes"
  );

  return handleMcpOAuthTokenRequest(request);
}

export const Route = createFileRoute("/oauth/token")({
  server: {
    handlers: {
      POST: ({ request }) => handleMcpOAuthTokenRouteRequest(request),
    },
  },
});
