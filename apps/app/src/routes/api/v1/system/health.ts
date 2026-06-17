import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/v1/system/health")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { handleSystemHealthPublicApiRequest } = await import(
          "@api/app/public-api/system"
        );
        return handleSystemHealthPublicApiRequest(request);
      },
      OPTIONS: async () => {
        const { handlePublicApiOptionsRequest } = await import(
          "@api/app/public-api/system"
        );
        return handlePublicApiOptionsRequest();
      },
    },
  },
});
