import { createFileRoute } from "@tanstack/react-router";

async function handleXConnectorOAuthCallbackRouteRequest(request: Request) {
  const { handleXConnectorOAuthCallbackRequest } = await import(
    "@api/app/internal-api/connector-oauth"
  );

  return handleXConnectorOAuthCallbackRequest(request);
}

export const Route = createFileRoute("/api/connectors/x/oauth/callback")({
  server: {
    handlers: {
      GET: ({ request }) => handleXConnectorOAuthCallbackRouteRequest(request),
    },
  },
});
