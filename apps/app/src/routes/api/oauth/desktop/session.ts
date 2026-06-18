import { createFileRoute } from "@tanstack/react-router";

async function handleNativeOAuthDesktopSessionRouteRequest(request: Request) {
  const { handleNativeOAuthDesktopSessionRequest } = await import(
    "@api/app/native-auth/server-routes"
  );

  return handleNativeOAuthDesktopSessionRequest(request);
}

export const Route = createFileRoute("/api/oauth/desktop/session")({
  server: {
    handlers: {
      GET: ({ request }) =>
        handleNativeOAuthDesktopSessionRouteRequest(request),
    },
  },
});
