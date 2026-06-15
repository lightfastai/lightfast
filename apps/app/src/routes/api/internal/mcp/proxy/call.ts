import { createFileRoute } from "@tanstack/react-router";
import { handleMcpProxyCallRequest } from "~/server/mcp-proxy";

export const Route = createFileRoute("/api/internal/mcp/proxy/call")({
  server: {
    handlers: {
      POST: async ({ request }) => handleMcpProxyCallRequest(request),
    },
  },
});
