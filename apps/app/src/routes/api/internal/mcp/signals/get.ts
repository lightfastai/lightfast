import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/internal/mcp/signals/get")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { handleGetMcpSignalInternalRequest } = await import(
          "@api/app/internal-api/mcp-signals"
        );
        return handleGetMcpSignalInternalRequest(request);
      },
    },
  },
});
