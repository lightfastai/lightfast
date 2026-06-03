import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/.well-known/oauth-protected-resource")({
  server: {
    handlers: {
      GET: getProtectedResourceMetadata,
    },
  },
});

export async function getProtectedResourceMetadata(): Promise<Response> {
  const { env } = await import("~/env");

  return Response.json(
    {
      authorization_servers: [env.MCP_AUTH_ISSUER],
      resource: env.MCP_RESOURCE_URL,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
