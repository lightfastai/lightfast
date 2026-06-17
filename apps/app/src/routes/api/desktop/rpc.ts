import { handleDesktopNativeRpcRequest } from "@api/app/desktop-api";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/desktop/rpc")({
  server: {
    handlers: {
      POST: async ({ request }) => handleDesktopNativeRpcRequest(request),
    },
  },
});
