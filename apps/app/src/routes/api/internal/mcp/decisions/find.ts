import { createFileRoute } from "@tanstack/react-router";

async function handleMcpDecisionFindRouteRequest(request: Request) {
  const { handleMcpDecisionFindRequest } = await import(
    "@api/app/internal-api/mcp-decisions"
  );

  return handleMcpDecisionFindRequest(request);
}

export const Route = createFileRoute("/api/internal/mcp/decisions/find")({
  server: {
    handlers: {
      POST: async ({ request }) => handleMcpDecisionFindRouteRequest(request),
    },
  },
});
