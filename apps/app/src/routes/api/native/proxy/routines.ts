import { createFileRoute } from "@tanstack/react-router";

async function handleNativeProviderRoutineFindRouteRequest(request: Request) {
  const { handleNativeProviderRoutineFindRequest } = await import(
    "@api/app/native-provider-proxy"
  );

  return handleNativeProviderRoutineFindRequest(request);
}

export const Route = createFileRoute("/api/native/proxy/routines")({
  server: {
    handlers: {
      GET: ({ request }) =>
        handleNativeProviderRoutineFindRouteRequest(request),
    },
  },
});
