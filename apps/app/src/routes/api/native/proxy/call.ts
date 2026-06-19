import { createFileRoute } from "@tanstack/react-router";

async function handleCliProviderRoutineCallRouteRequest(request: Request) {
  const { handleCliProviderRoutineCallRequest } = await import(
    "@api/app/cli-api"
  );

  return handleCliProviderRoutineCallRequest(request);
}

export const Route = createFileRoute("/api/native/proxy/call")({
  server: {
    handlers: {
      POST: ({ request }) => handleCliProviderRoutineCallRouteRequest(request),
    },
  },
});
