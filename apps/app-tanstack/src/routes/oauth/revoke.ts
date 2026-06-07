import { revokeMcpRefreshTokenSecret } from "@api/app";
import { db } from "@db/app/client";
import { createFileRoute } from "@tanstack/react-router";
import {
  oauthError,
  oauthJson,
  readOAuthBody,
} from "~/server/oauth/mcp-response";

export const Route = createFileRoute("/oauth/revoke")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await readOAuthBody(request);
          await revokeMcpRefreshTokenSecret(db, {
            refreshToken: typeof body.token === "string" ? body.token : "",
          });
          return oauthJson({});
        } catch (error) {
          return oauthError(error);
        }
      },
    },
  },
});
