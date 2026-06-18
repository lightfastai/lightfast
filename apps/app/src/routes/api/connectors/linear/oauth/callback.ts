import { createFileRoute } from "@tanstack/react-router";

async function handleLinearConnectorOAuthCallbackRouteRequest(
  request: Request
) {
  const { handleLinearConnectorOAuthCallbackRequest } = await import(
    "@api/app/internal-api/connector-oauth"
  );

  return handleLinearConnectorOAuthCallbackRequest(request);
}

export const Route = createFileRoute("/api/connectors/linear/oauth/callback")({
  server: {
    handlers: {
      GET: ({ request }) =>
        handleLinearConnectorOAuthCallbackRouteRequest(request),
    },
  },
});
