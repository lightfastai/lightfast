import { createFileRoute } from "@tanstack/react-router";

async function handleMcpProxyCallRouteRequest(request: Request) {
  const { handleMcpProxyCallRequest } = await import(
    "@api/app/internal-api/mcp-proxy"
  );

  return handleMcpProxyCallRequest(request);
}

export const Route = createFileRoute("/api/internal/mcp/proxy/call")({
  server: {
    handlers: {
      POST: async ({ request }) => handleMcpProxyCallRouteRequest(request),
    },
  },
});
