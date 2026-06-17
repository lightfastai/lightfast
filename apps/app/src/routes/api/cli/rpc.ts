import { handleCliNativeRpcRequest } from "@api/app/cli-api";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/cli/rpc")({
  server: {
    handlers: {
      POST: async ({ request }) => handleCliNativeRpcRequest(request),
    },
  },
});
