import { env } from "../env";

function bearerToken(request: Request): string | undefined {
  const authorization = request.headers.get("authorization");
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim();
}

export function jsonError(
  error: string,
  message: string,
  status: number
): Response {
  return Response.json({ error, message }, { status });
}

export async function verifyMcpServiceRequest(
  request: Request
): Promise<Response | null> {
  const token = bearerToken(request);
  if (!token) {
    return jsonError("missing_token", "Service bearer token is required.", 401);
  }
  if (!env.SERVICE_JWT_SECRET) {
    return jsonError(
      "service_not_configured",
      "Service JWT verification is not configured.",
      500
    );
  }

  try {
    const { verifyServiceJWT } = await import("@api/app/service-jwt");
    await verifyServiceJWT({
      allowedCallers: ["mcp"],
      audience: "lightfast-app",
      jwtSecret: env.SERVICE_JWT_SECRET,
      token,
    });
    return null;
  } catch (error) {
    const status =
      error instanceof Error && "status" in error
        ? Number((error as { status: unknown }).status)
        : 401;
    return jsonError(
      status === 403 ? "disallowed_caller" : "invalid_token",
      status === 403
        ? "Service caller is not allowed for this command."
        : "Service token is invalid.",
      status === 403 ? 403 : 401
    );
  }
}
