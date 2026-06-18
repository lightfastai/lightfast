import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/internal/mcp/audit")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { handleRecordMcpAuditInternalRequest } = await import(
          "@api/app/internal-api/mcp-audit"
        );
        return handleRecordMcpAuditInternalRequest(request);
      },
    },
  },
});
