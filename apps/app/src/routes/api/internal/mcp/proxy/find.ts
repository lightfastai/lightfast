import { createFileRoute } from "@tanstack/react-router";

async function handleMcpProxyFindRouteRequest(request: Request) {
  const { handleMcpProxyFindRequest } = await import(
    "@api/app/internal-api/mcp-proxy"
  );

  return handleMcpProxyFindRequest(request);
}

export const Route = createFileRoute("/api/internal/mcp/proxy/find")({
  server: {
    handlers: {
      POST: async ({ request }) => handleMcpProxyFindRouteRequest(request),
    },
  },
});
