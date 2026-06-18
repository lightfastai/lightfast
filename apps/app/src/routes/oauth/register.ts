import { createFileRoute } from "@tanstack/react-router";

async function handleRegisterMcpOAuthClientRouteRequest(request: Request) {
  const { handleRegisterMcpOAuthClientRequest } = await import(
    "@api/app/mcp-oauth/server-routes"
  );

  return handleRegisterMcpOAuthClientRequest(request);
}

export const Route = createFileRoute("/oauth/register")({
  server: {
    handlers: {
      POST: ({ request }) => handleRegisterMcpOAuthClientRouteRequest(request),
    },
  },
});
