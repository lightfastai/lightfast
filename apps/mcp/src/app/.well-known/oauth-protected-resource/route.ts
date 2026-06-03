import { env } from "../../../env";

export const dynamic = "force-dynamic";

export function GET(): Response {
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
