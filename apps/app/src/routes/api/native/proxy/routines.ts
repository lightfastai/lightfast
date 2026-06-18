import { handleNativeProviderRoutineFindRequest } from "@api/app/native-provider-proxy";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/native/proxy/routines")({
  server: {
    handlers: {
      GET: ({ request }) => handleNativeProviderRoutineFindRequest(request),
    },
  },
});
