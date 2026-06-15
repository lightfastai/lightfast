import {
  exchangeMcpAuthorizationCode,
  McpOAuthError,
  rotateMcpRefreshTokenSecret,
} from "@api/app";
import { db } from "@db/app/client";

import { env } from "~/env";
import {
  oauthError,
  oauthIssuer,
  oauthJson,
  readOAuthBody,
} from "../_server/mcp-response";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await readOAuthBody(req);
    if (body.grant_type === "authorization_code") {
      const result = await exchangeMcpAuthorizationCode(db, {
        clientId: requireField(body, "client_id"),
        code: requireField(body, "code"),
        codeVerifier: requireField(body, "code_verifier"),
        issuer: oauthIssuer(),
        jwtSecret: env.SERVICE_JWT_SECRET,
        redirectUri: requireField(body, "redirect_uri"),
      });
      return oauthJson(result);
    }
    if (body.grant_type === "refresh_token") {
      const result = await rotateMcpRefreshTokenSecret(db, {
        currentRefreshToken: requireField(body, "refresh_token"),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        issuer: oauthIssuer(),
        jwtSecret: env.SERVICE_JWT_SECRET,
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
}

function requireField(body: Record<string, unknown>, key: string): string {
  const value = body[key];
  if (typeof value !== "string" || !value) {
    throw new McpOAuthError("invalid_request", `${key} is required.`);
  }
  return value;
}
