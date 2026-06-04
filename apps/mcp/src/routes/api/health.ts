import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: getHealth,
    },
  },
});

export function getHealth(): Response {
  return Response.json({
    service: "mcp",
    status: "ok",
  });
}
