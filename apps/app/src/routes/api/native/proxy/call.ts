import { handleNativeProviderRoutineCallRequest } from "@api/app/native-provider-proxy";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/native/proxy/call")({
  server: {
    handlers: {
      POST: ({ request }) => handleNativeProviderRoutineCallRequest(request),
    },
  },
});
