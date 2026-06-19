import { createFileRoute } from "@tanstack/react-router";

async function handleCliProviderRoutineFindRouteRequest(request: Request) {
  const { handleCliProviderRoutineFindRequest } = await import(
    "@api/app/cli-api"
  );

  return handleCliProviderRoutineFindRequest(request);
}

export const Route = createFileRoute("/api/native/proxy/routines")({
  server: {
    handlers: {
      GET: ({ request }) => handleCliProviderRoutineFindRouteRequest(request),
    },
  },
});
