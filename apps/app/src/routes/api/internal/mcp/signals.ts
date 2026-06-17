import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/internal/mcp/signals")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { handleCreateMcpSignalInternalRequest } = await import(
          "@api/app/internal-api/mcp-signals"
        );
        return handleCreateMcpSignalInternalRequest(request);
      },
    },
  },
});
