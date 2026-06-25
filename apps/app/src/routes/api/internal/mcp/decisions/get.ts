import { createFileRoute } from "@tanstack/react-router";

async function handleMcpDecisionGetRouteRequest(request: Request) {
  const { handleMcpDecisionGetRequest } = await import(
    "@api/app/internal-api/mcp-decisions"
  );

  return handleMcpDecisionGetRequest(request);
}

export const Route = createFileRoute("/api/internal/mcp/decisions/get")({
  server: {
    handlers: {
      POST: async ({ request }) => handleMcpDecisionGetRouteRequest(request),
    },
  },
});
