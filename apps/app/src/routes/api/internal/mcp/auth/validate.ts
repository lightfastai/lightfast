import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/internal/mcp/auth/validate")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { handleValidateMcpGrantInternalRequest } = await import(
          "@api/app/internal-api/mcp-auth"
        );
        return handleValidateMcpGrantInternalRequest(request);
      },
    },
  },
});
