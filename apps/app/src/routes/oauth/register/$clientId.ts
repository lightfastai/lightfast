// biome-ignore-all lint/style/useFilenamingConvention: TanStack route params must be valid JavaScript identifiers.
import { createFileRoute } from "@tanstack/react-router";

async function handleGetRegisteredMcpOAuthClientRouteRequest(
  request: Request,
  input: { clientId: string }
) {
  const { handleGetRegisteredMcpOAuthClientRequest } = await import(
    "@api/app/mcp-oauth/server-routes"
  );

  return handleGetRegisteredMcpOAuthClientRequest(request, input);
}

export const Route = createFileRoute("/oauth/register/$clientId")({
  server: {
    handlers: {
      GET: ({ params, request }) =>
        handleGetRegisteredMcpOAuthClientRouteRequest(request, {
          clientId: params.clientId,
        }),
    },
  },
});
