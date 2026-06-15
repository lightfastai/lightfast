import { createFileRoute } from "@tanstack/react-router";

type InngestMethod = "GET" | "POST" | "PUT";

async function handleInngestRequest(request: Request, method: InngestMethod) {
  const { createInngestRouteContext } = await import("@api/app/inngest");
  const handlers = createInngestRouteContext();
  const handler = handlers[method] as (
    request: Request,
    context: unknown
  ) => Promise<Response>;
  return handler(request, {});
}

export const Route = createFileRoute("/api/inngest")({
  server: {
    handlers: {
      GET: async ({ request }) => handleInngestRequest(request, "GET"),
      POST: async ({ request }) => handleInngestRequest(request, "POST"),
      PUT: async ({ request }) => handleInngestRequest(request, "PUT"),
    },
  },
});
