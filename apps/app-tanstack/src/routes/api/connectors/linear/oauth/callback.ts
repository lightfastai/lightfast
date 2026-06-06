import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/connectors/linear/oauth/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { completeLinearConnectorOAuth } = await import(
          "@api/app/services/connectors"
        );
        const result = await completeLinearConnectorOAuth({
          requestUrl: request.url,
        });
        return Response.redirect(result.redirectUrl);
      },
    },
  },
});
