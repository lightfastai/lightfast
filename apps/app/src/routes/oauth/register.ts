import { registerMcpOAuthClient } from "@api/app";
import { db } from "@db/app/client";
import { createFileRoute } from "@tanstack/react-router";
import {
  oauthError,
  oauthJson,
  readOAuthBody,
} from "~/server/oauth/mcp-response";

export const Route = createFileRoute("/oauth/register")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await readOAuthBody(request)) as Parameters<
            typeof registerMcpOAuthClient
          >[1];
          const result = await registerMcpOAuthClient(db, body);
          return oauthJson(result, { status: 201 });
        } catch (error) {
          return oauthError(error);
        }
      },
    },
  },
});
