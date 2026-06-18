import { recordMcpAuditEvent } from "@db/app";
import { db } from "@db/app/client";
import { z } from "zod";
import { verifyServiceJWT } from "../../service-jwt";

const mcpAuditEventInputSchema = z
  .object({
    clientPublicId: z.string().min(1).nullable().optional(),
    clerkOrgId: z.string().min(1).nullable().optional(),
    clerkUserId: z.string().min(1).nullable().optional(),
    eventName: z.string().min(1),
    grantPublicId: z.string().min(1).nullable().optional(),
    metadata: z.record(z.string(), z.unknown()).nullable().optional(),
    outcome: z.enum(["denied", "error", "success"]),
  })
  .strict();

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

async function verifyMcpServiceRequest(
  request: Request
): Promise<Response | null> {
  const token = bearerToken(request);
  if (!token) {
    return jsonError("missing_token", "Service bearer token is required.", 401);
  }

  const jwtSecret = serviceJwtSecret();
  if (!jwtSecret) {
    return jsonError(
      "service_not_configured",
      "Service JWT verification is not configured.",
      500
    );
  }

  try {
    await verifyServiceJWT({
      allowedCallers: ["mcp"],
      audience: "lightfast-app",
      jwtSecret,
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

export async function handleRecordMcpAuditInternalRequest(
  request: Request
): Promise<Response> {
  const authError = await verifyMcpServiceRequest(request);
  if (authError) {
    return authError;
  }

  const body = await request.json().catch(() => undefined);
  const parsed = mcpAuditEventInputSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("invalid_request", "MCP audit request is invalid.", 400);
  }

  await recordMcpAuditEvent(db, parsed.data);
  return Response.json({ success: true }, { status: 200 });
}
