import { handleNativeOAuthClientConfigRequest } from "@api/app/native-auth/server-routes";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/oauth/$client/config")({
  server: {
    handlers: {
      GET: ({ params }) => handleNativeOAuthClientConfigRequest(params.client),
    },
  },
});
