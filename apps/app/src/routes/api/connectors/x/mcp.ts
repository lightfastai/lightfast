import { handleXConnectorMcpRequest } from "@api/app/internal-api/connector-mcp";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/connectors/x/mcp")({
  server: {
    handlers: {
      GET: ({ request }) => handleXConnectorMcpRequest(request),
      POST: ({ request }) => handleXConnectorMcpRequest(request),
      DELETE: ({ request }) => handleXConnectorMcpRequest(request),
    },
  },
});
