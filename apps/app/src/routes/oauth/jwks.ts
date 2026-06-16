import { getMcpOAuthJwks } from "@api/app";
import { createFileRoute } from "@tanstack/react-router";
import { oauthJson } from "~/server/oauth/mcp-response";

export const Route = createFileRoute("/oauth/jwks")({
  server: {
    handlers: {
      GET: async () => oauthJson(getMcpOAuthJwks()),
    },
  },
});
