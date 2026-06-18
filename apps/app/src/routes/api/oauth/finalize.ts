import { createFileRoute } from "@tanstack/react-router";

async function handleNativeOAuthFinalizeRouteRequest(request: Request) {
  const { handleNativeOAuthFinalizeRequest } = await import(
    "@api/app/native-auth/server-routes"
  );

  return handleNativeOAuthFinalizeRequest(request);
}

export const Route = createFileRoute("/api/oauth/finalize")({
  server: {
    handlers: {
      POST: ({ request }) => handleNativeOAuthFinalizeRouteRequest(request),
    },
  },
});
