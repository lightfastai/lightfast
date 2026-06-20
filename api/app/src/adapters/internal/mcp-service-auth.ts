import {
  type ServiceJwtAudience,
  type ServiceJwtCaller,
  ServiceJwtError,
  verifyServiceJWT,
} from "@repo/service-jwt";

export interface AppsMcpServiceCaller {
  kind: "service";
  service: "apps-mcp";
}

export interface VerifiedMcpServiceRequest {
  caller: AppsMcpServiceCaller;
  credential: {
    audience: ServiceJwtAudience;
    caller: Extract<ServiceJwtCaller, "mcp">;
  };
}

export type McpServiceRequestVerification =
  | { ok: true; value: VerifiedMcpServiceRequest }
  | { ok: false; response: Response };

function bearerToken(request: Request): string | undefined {
  const authorization = request.headers.get("authorization");
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim();
}

function jsonError(error: string, message: string, status: number): Response {
  return Response.json({ error, message }, { status });
}

function serviceJwtSecret(): string | undefined {
  const secret = process.env.SERVICE_JWT_SECRET;
  return secret && secret.length >= 32 ? secret : undefined;
}

export async function verifyMcpServiceRequest(
  request: Request
): Promise<McpServiceRequestVerification> {
  const token = bearerToken(request);
  if (!token) {
    return {
      ok: false,
      response: jsonError(
        "missing_token",
        "Service bearer token is required.",
        401
      ),
    };
  }

  const jwtSecret = serviceJwtSecret();
  if (!jwtSecret) {
    return {
      ok: false,
      response: jsonError(
        "service_not_configured",
        "Service JWT verification is not configured.",
        500
      ),
    };
  }

  try {
    const credential = await verifyServiceJWT({
      allowedCallers: ["mcp"],
      audience: "lightfast-app",
      jwtSecret,
      token,
    });
    return {
      ok: true,
      value: {
        caller: { kind: "service", service: "apps-mcp" },
        credential: {
          audience: credential.audience,
          caller: "mcp",
        },
      },
    };
  } catch (error) {
    const status = error instanceof ServiceJwtError ? error.status : 401;
    return {
      ok: false,
      response: jsonError(
        status === 403 ? "disallowed_caller" : "invalid_token",
        status === 403
          ? "Service caller is not allowed for this command."
          : "Service token is invalid.",
        status === 403 ? 403 : 401
      ),
    };
  }
}
