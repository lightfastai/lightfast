import { createFileRoute } from "@tanstack/react-router";
import { handleMcpProxyFindRequest } from "~/server/mcp-proxy";

export const Route = createFileRoute("/api/internal/mcp/proxy/find")({
  server: {
    handlers: {
      POST: async ({ request }) => handleMcpProxyFindRequest(request),
    },
  },
});
