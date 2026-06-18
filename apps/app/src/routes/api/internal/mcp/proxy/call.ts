import { handleMcpProxyCallRequest } from "@api/app/internal-api/mcp-proxy";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/internal/mcp/proxy/call")({
  server: {
    handlers: {
      POST: async ({ request }) => handleMcpProxyCallRequest(request),
    },
  },
});
