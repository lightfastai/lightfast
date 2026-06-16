// biome-ignore-all lint/style/useFilenamingConvention: TanStack splat route files use $.ts.

import { createFileRoute } from "@tanstack/react-router";

let handlerPromise:
  | Promise<InstanceType<typeof import("@orpc/openapi/fetch").OpenAPIHandler>>
  | undefined;

async function getHandler() {
  handlerPromise ??= Promise.all([
    import("@orpc/openapi/fetch"),
    import("@api/app"),
  ]).then(
    ([{ OpenAPIHandler }, { orpcRouter }]) => new OpenAPIHandler(orpcRouter)
  );
  return handlerPromise;
}

function setCorsHeaders(response: Response) {
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set(
    "Access-Control-Allow-Methods",
    "GET,POST,PUT,PATCH,DELETE,OPTIONS"
  );
  response.headers.set(
    "Access-Control-Allow-Headers",
    "authorization,content-type"
  );
  response.headers.set("Access-Control-Max-Age", "86400");
  return response;
}

async function dispatch(request: Request) {
  const handler = await getHandler();
  const { response } = await handler.handle(request, {
    prefix: "/api/v1",
    context: {
      headers: request.headers,
      requestId: crypto.randomUUID(),
    },
  });
  return setCorsHeaders(response ?? new Response(null, { status: 404 }));
}

export const Route = createFileRoute("/api/v1/$")({
  server: {
    handlers: {
      OPTIONS: async () => setCorsHeaders(new Response(null, { status: 204 })),
      DELETE: async ({ request }) => dispatch(request),
      GET: async ({ request }) => dispatch(request),
      PATCH: async ({ request }) => dispatch(request),
      POST: async ({ request }) => dispatch(request),
      PUT: async ({ request }) => dispatch(request),
    },
  },
});
