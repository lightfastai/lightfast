import { handleNativeOAuthDesktopSessionRequest } from "@api/app/native-auth/server-routes";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/oauth/desktop/session")({
  server: {
    handlers: {
      GET: ({ request }) => handleNativeOAuthDesktopSessionRequest(request),
    },
  },
});
