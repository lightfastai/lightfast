import { McpOAuthError } from "@api/app";
import { env } from "~/env";

export function oauthIssuer(): string {
  return env.VITE_LIGHTFAST_APP_URL.replace(/\/$/, "");
}

export function oauthUrl(path: string): string {
  return `${oauthIssuer()}${path}`;
}

export function oauthJson(data: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set("cache-control", "no-store");
  headers.set("content-type", "application/json");
  return Response.json(data, { ...init, headers });
}

export function oauthError(error: unknown): Response {
  if (error instanceof McpOAuthError) {
    return oauthJson(
      {
        error: error.error,
        error_description: error.message,
      },
      { status: error.status }
    );
  }

  console.error("[mcp-oauth] Unexpected route error", error);
  return oauthJson(
    {
      error: "server_error",
      error_description: "Unexpected OAuth error.",
    },
    { status: 500 }
  );
}

export async function readOAuthBody(
  request: Request
): Promise<Record<string, unknown>> {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/x-www-form-urlencoded")) {
    return Object.fromEntries((await request.formData()).entries());
  }
  return (await request.json().catch(() => ({}))) as Record<string, unknown>;
}

export function bearerToken(request: Request): string | null {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }
  return authorization.slice("Bearer ".length).trim() || null;
}

export function requireOAuthServiceJwtSecret(): string {
  if (!env.SERVICE_JWT_SECRET) {
    throw new Error("OAuth service signing secret is not configured.");
  }
  return env.SERVICE_JWT_SECRET;
}
