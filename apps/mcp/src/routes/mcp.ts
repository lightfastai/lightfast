import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/mcp")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { mcpHandler } = await import("~/server/mcp");
        return mcpHandler(request);
      },
      POST: async ({ request }) => {
        const { mcpHandler } = await import("~/server/mcp");
        return mcpHandler(request);
      },
    },
  },
});
