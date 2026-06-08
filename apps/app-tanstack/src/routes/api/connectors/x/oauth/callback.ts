import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/connectors/x/oauth/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { completeXConnectorOAuth } = await import(
          "@api/app/services/connectors"
        );
        const result = await completeXConnectorOAuth({
          requestUrl: request.url,
        });
        return Response.redirect(result.redirectUrl);
      },
    },
  },
});
