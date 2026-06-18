import { createFileRoute } from "@tanstack/react-router";

async function handleMcpOAuthRevokeRouteRequest(request: Request) {
  const { handleMcpOAuthRevokeRequest } = await import(
    "@api/app/mcp-oauth/server-routes"
  );

  return handleMcpOAuthRevokeRequest(request);
}

export const Route = createFileRoute("/oauth/revoke")({
  server: {
    handlers: {
      POST: ({ request }) => handleMcpOAuthRevokeRouteRequest(request),
    },
  },
});
