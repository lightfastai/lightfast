import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/v1/signals/$id")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const { handleGetSignalPublicApiRequest } = await import(
          "@api/app/public-api/signals"
        );
        return handleGetSignalPublicApiRequest(request, { id: params.id });
      },
      OPTIONS: async () => {
        const { handlePublicApiOptionsRequest } = await import(
          "@api/app/public-api/signals"
        );
        return handlePublicApiOptionsRequest();
      },
    },
  },
});
