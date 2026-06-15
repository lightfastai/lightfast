// biome-ignore-all lint/style/useFilenamingConvention: TanStack route params must be valid JavaScript identifiers.
import { getRegisteredMcpOAuthClient, McpOAuthError } from "@api/app";
import { db } from "@db/app/client";
import { createFileRoute } from "@tanstack/react-router";
import {
  bearerToken,
  oauthError,
  oauthJson,
} from "~/server/oauth/mcp-response";

export const Route = createFileRoute("/oauth/register/$clientId")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        try {
          const registrationAccessToken = bearerToken(request);
          if (!registrationAccessToken) {
            throw new McpOAuthError(
              "invalid_client",
              "Registration access token is required.",
              401
            );
          }

          const client = await getRegisteredMcpOAuthClient(db, {
            registrationAccessToken,
          });
          if (client.client_id !== params.clientId) {
            throw new McpOAuthError(
              "invalid_client",
              "Client id mismatch.",
              401
            );
          }
          return oauthJson(client);
        } catch (error) {
          return oauthError(error);
        }
      },
    },
  },
});
