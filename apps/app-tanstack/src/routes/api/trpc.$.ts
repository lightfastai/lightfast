import { createFileRoute } from "@tanstack/react-router";

const handleTrpcRequest = async (request: Request) => {
  const [{ appRouter }, { fetchRequestHandler }, { createTanStackTRPCContext }, cors] =
    await Promise.all([
      import("@api/app"),
      import("@trpc/server/adapters/fetch"),
      import("~/trpc/context"),
      import("~/cors"),
    ]);

  const response = await fetchRequestHandler({
    endpoint: "/api/trpc",
    router: appRouter,
    req: request,
    createContext: () =>
      createTanStackTRPCContext({ headers: request.headers }),
  });

  return cors.setCorsHeaders(request, response);
};

export const Route = createFileRoute("/api/trpc/$")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) => {
        const { setCorsHeaders } = await import("~/cors");
        return setCorsHeaders(request, new Response(null, { status: 204 }));
      },
      GET: async ({ request }) => handleTrpcRequest(request),
      POST: async ({ request }) => handleTrpcRequest(request),
    },
  },
});
