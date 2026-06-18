import { handleMcpProxyFindRequest } from "@api/app/internal-api/mcp-proxy";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/internal/mcp/proxy/find")({
  server: {
    handlers: {
      POST: async ({ request }) => handleMcpProxyFindRequest(request),
    },
  },
});
