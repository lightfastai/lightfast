import { createFileRoute } from "@tanstack/react-router";

async function handleAppHealthRouteRequest(request: Request) {
  const { handleAppHealthRequest } = await import(
    "@api/app/internal-api/health"
  );

  return handleAppHealthRequest(request);
}

export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: ({ request }) => handleAppHealthRouteRequest(request),
    },
  },
});
