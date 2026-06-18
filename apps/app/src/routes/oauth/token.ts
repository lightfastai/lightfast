import {
  exchangeMcpAuthorizationCode,
  McpOAuthError,
  rotateMcpRefreshTokenSecret,
} from "@api/app/mcp-oauth";
import { db } from "@db/app/client";
import { createFileRoute } from "@tanstack/react-router";
import {
  oauthError,
  oauthIssuer,
  oauthJson,
  readOAuthBody,
  requireOAuthServiceJwtSecret,
} from "~/server/oauth/mcp-response";

export const Route = createFileRoute("/oauth/token")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await readOAuthBody(request);
          if (body.grant_type === "authorization_code") {
            const result = await exchangeMcpAuthorizationCode(db, {
              clientId: requireField(body, "client_id"),
              code: requireField(body, "code"),
              codeVerifier: requireField(body, "code_verifier"),
              issuer: oauthIssuer(),
              jwtSecret: requireOAuthServiceJwtSecret(),
              redirectUri: requireField(body, "redirect_uri"),
            });
            return oauthJson(result);
          }
          if (body.grant_type === "refresh_token") {
            const result = await rotateMcpRefreshTokenSecret(db, {
              currentRefreshToken: requireField(body, "refresh_token"),
              expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
              issuer: oauthIssuer(),
              jwtSecret: requireOAuthServiceJwtSecret(),
            });
            return oauthJson(result);
          }
          throw new McpOAuthError(
            "unsupported_grant_type",
            "Unsupported grant type."
          );
        } catch (error) {
          return oauthError(error);
        }
      },
    },
  },
});

function requireField(body: Record<string, unknown>, key: string): string {
  const value = body[key];
  if (typeof value !== "string" || !value) {
    throw new McpOAuthError("invalid_request", `${key} is required.`);
  }
  return value;
}
