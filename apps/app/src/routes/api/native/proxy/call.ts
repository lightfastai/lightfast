import { createFileRoute } from "@tanstack/react-router";

async function handleNativeProviderRoutineCallRouteRequest(request: Request) {
  const { handleNativeProviderRoutineCallRequest } = await import(
    "@api/app/native-provider-proxy"
  );

  return handleNativeProviderRoutineCallRequest(request);
}

export const Route = createFileRoute("/api/native/proxy/call")({
  server: {
    handlers: {
      POST: ({ request }) =>
        handleNativeProviderRoutineCallRouteRequest(request),
    },
  },
});
