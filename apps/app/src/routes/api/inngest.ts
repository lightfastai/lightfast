import { createFileRoute } from "@tanstack/react-router";

type InngestMethod = "GET" | "POST" | "PUT";

async function handleInngestRouteRequest(
  request: Request,
  method: InngestMethod
) {
  const { handleInngestRequest } = await import(
    "@api/app/internal-api/inngest"
  );

  return handleInngestRequest(request, method);
}

export const Route = createFileRoute("/api/inngest")({
  server: {
    handlers: {
      GET: async ({ request }) => handleInngestRouteRequest(request, "GET"),
      POST: async ({ request }) => handleInngestRouteRequest(request, "POST"),
      PUT: async ({ request }) => handleInngestRouteRequest(request, "PUT"),
    },
  },
});
