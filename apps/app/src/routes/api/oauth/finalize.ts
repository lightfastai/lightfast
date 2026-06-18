import { handleNativeOAuthFinalizeRequest } from "@api/app/native-auth/server-routes";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/oauth/finalize")({
  server: {
    handlers: {
      POST: ({ request }) => handleNativeOAuthFinalizeRequest(request),
    },
  },
});
