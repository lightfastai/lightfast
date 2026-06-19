import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/v1/signals")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { handleListSignalsPublicApiRequest } = await import(
          "@api/app/public-api/signals"
        );
        return handleListSignalsPublicApiRequest(request);
      },
      OPTIONS: async () => {
        const { handlePublicApiOptionsRequest } = await import(
          "@api/app/public-api/signals"
        );
        return handlePublicApiOptionsRequest();
      },
      POST: async ({ request }) => {
        const { handleCreateSignalPublicApiRequest } = await import(
          "@api/app/public-api/signals"
        );
        return handleCreateSignalPublicApiRequest(request);
      },
    },
  },
});
