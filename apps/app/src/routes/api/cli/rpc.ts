import { createFileRoute } from "@tanstack/react-router";

async function handleCliRpcRouteRequest(request: Request) {
  const { handleCliNativeRpcRequest } = await import("@api/app/cli-api");

  return handleCliNativeRpcRequest(request);
}

export const Route = createFileRoute("/api/cli/rpc")({
  server: {
    handlers: {
      POST: async ({ request }) => handleCliRpcRouteRequest(request),
    },
  },
});
