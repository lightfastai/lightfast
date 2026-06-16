import { createFileRoute } from "@tanstack/react-router";

async function handleXConnectorMcpRequest(request: Request) {
  const { handleXConnectorMcpRequest: handleRequest } = await import(
    "@api/app/services/connectors"
  );
  return handleRequest({ request });
}

export const Route = createFileRoute("/api/connectors/x/mcp")({
  server: {
    handlers: {
      GET: async ({ request }) => handleXConnectorMcpRequest(request),
      POST: async ({ request }) => handleXConnectorMcpRequest(request),
      DELETE: async ({ request }) => handleXConnectorMcpRequest(request),
    },
  },
});
