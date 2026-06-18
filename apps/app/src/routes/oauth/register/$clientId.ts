// biome-ignore-all lint/style/useFilenamingConvention: TanStack route params must be valid JavaScript identifiers.
import { handleGetRegisteredMcpOAuthClientRequest } from "@api/app/mcp-oauth/server-routes";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/oauth/register/$clientId")({
  server: {
    handlers: {
      GET: ({ params, request }) =>
        handleGetRegisteredMcpOAuthClientRequest(request, {
          clientId: params.clientId,
        }),
    },
  },
});
