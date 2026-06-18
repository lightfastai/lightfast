import { createFileRoute } from "@tanstack/react-router";

async function handleXConnectorMcpRouteRequest(request: Request) {
  const { handleXConnectorMcpRequest } = await import(
    "@api/app/internal-api/connector-mcp"
  );

  return handleXConnectorMcpRequest(request);
}

export const Route = createFileRoute("/api/connectors/x/mcp")({
  server: {
    handlers: {
      GET: ({ request }) => handleXConnectorMcpRouteRequest(request),
      POST: ({ request }) => handleXConnectorMcpRouteRequest(request),
      DELETE: ({ request }) => handleXConnectorMcpRouteRequest(request),
    },
  },
});
