import { createFileRoute } from "@tanstack/react-router";

async function handleGranolaUserConnectorOAuthCallbackRouteRequest(
  request: Request
) {
  const { handleGranolaUserConnectorOAuthCallbackRequest } = await import(
    "@api/app/internal-api/connector-oauth"
  );

  return handleGranolaUserConnectorOAuthCallbackRequest(request);
}

export const Route = createFileRoute("/api/connectors/granola/oauth/callback")({
  server: {
    handlers: {
      GET: ({ request }) =>
        handleGranolaUserConnectorOAuthCallbackRouteRequest(request),
    },
  },
});
