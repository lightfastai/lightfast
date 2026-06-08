import { createFileRoute } from "@tanstack/react-router";

function accountSettingsRedirect(requestUrl: string, error: string) {
  const url = new URL("/account/settings", requestUrl);
  url.searchParams.set("connector", "granola");
  url.searchParams.set("error", error);
  return Response.redirect(url.toString());
}

export const Route = createFileRoute("/api/connectors/granola/oauth/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const error = url.searchParams.get("error");

        if (error) {
          return accountSettingsRedirect(request.url, error);
        }

        if (!(code && state)) {
          return accountSettingsRedirect(request.url, "missing_oauth_code");
        }

        const { completeGranolaUserConnectorOAuth } = await import(
          "@api/app/services/user-connectors"
        );
        const result = await completeGranolaUserConnectorOAuth({
          code,
          requestUrl: request.url,
          state,
        });
        return Response.redirect(result.redirectUrl);
      },
    },
  },
});
