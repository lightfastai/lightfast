import { createFileRoute } from "@tanstack/react-router";

async function handleDesktopRpcRouteRequest(request: Request) {
  const { handleDesktopNativeRpcRequest } = await import(
    "@api/app/desktop-api"
  );

  return handleDesktopNativeRpcRequest(request);
}

export const Route = createFileRoute("/api/desktop/rpc")({
  server: {
    handlers: {
      POST: async ({ request }) => handleDesktopRpcRouteRequest(request),
    },
  },
});
