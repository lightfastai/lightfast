import { getVisibleSignalByPublicId } from "@db/app";
import { db } from "@db/app/client";
import {
  createMcpSignalCommandInput,
  getMcpSignalCommandInput,
  getSignalOutput,
} from "@repo/api-contract";

import { assertHostedMcpOrgAccess } from "../../mcp-oauth/resource-access";
import { verifyServiceJWT } from "../../service-jwt";
import { createSignalForActor } from "../../signals/service";

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

function isMcpOrgAccessDenied(error: unknown): error is {
  message?: unknown;
  status: 403;
} {
  return (
    error !== null &&
    typeof error === "object" &&
    "status" in error &&
    (error as { status: unknown }).status === 403
  );
}

function mcpOrgAccessDeniedMessage(error: { message?: unknown }): string {
  return typeof error.message === "string"
    ? error.message
    : "MCP organization access denied.";
}

function isSignalCreateQueueErrorLike(error: unknown): error is Error {
  return error instanceof Error && error.name === "SignalCreateQueueError";
}

export async function handleCreateMcpSignalInternalRequest(
  request: Request
): Promise<Response> {
  const authError = await verifyMcpServiceRequest(request);
  if (authError) {
    return authError;
  }

  const body = await request.json().catch(() => undefined);
  const parsed = createMcpSignalCommandInput.safeParse(body);
  if (!parsed.success) {
    return jsonError(
      "invalid_request",
      "MCP signal command request is invalid.",
      400
    );
  }

  try {
    await assertHostedMcpOrgAccess(db, {
      orgId: parsed.data.actor.orgId,
      userId: parsed.data.actor.userId,
    });
    const result = await createSignalForActor(db, parsed.data);
    return Response.json(result, { status: 200 });
  } catch (error) {
    if (isMcpOrgAccessDenied(error)) {
      return jsonError(
        "org_access_denied",
        mcpOrgAccessDeniedMessage(error),
        403
      );
    }
    if (isSignalCreateQueueErrorLike(error)) {
      return jsonError("signal_enqueue_failed", error.message, 500);
    }
    return jsonError("internal_error", "Failed to create signal.", 500);
  }
}

export async function handleGetMcpSignalInternalRequest(
  request: Request
): Promise<Response> {
  const authError = await verifyMcpServiceRequest(request);
  if (authError) {
    return authError;
  }

  const body = await request.json().catch(() => undefined);
  const parsed = getMcpSignalCommandInput.safeParse(body);
  if (!parsed.success) {
    return jsonError(
      "invalid_request",
      "MCP signal get request is invalid.",
      400
    );
  }

  try {
    await assertHostedMcpOrgAccess(db, {
      orgId: parsed.data.actor.orgId,
      userId: parsed.data.actor.userId,
    });
    const signal = await getVisibleSignalByPublicId(db, {
      publicId: parsed.data.id,
      clerkOrgId: parsed.data.actor.orgId,
      createdByUserId: parsed.data.actor.userId,
    });

    if (!signal) {
      return jsonError("not_found", "Signal not found.", 404);
    }

    const output = getSignalOutput.parse({
      id: signal.publicId,
      input: signal.input,
      status: signal.status,
      classification: signal.classification,
      visibilityScope: signal.visibilityScope,
      createdAt: signal.createdAt.toISOString(),
      updatedAt: signal.updatedAt.toISOString(),
    });
    return Response.json(output, { status: 200 });
  } catch (error) {
    if (isMcpOrgAccessDenied(error)) {
      return jsonError(
        "org_access_denied",
        mcpOrgAccessDeniedMessage(error),
        403
      );
    }
    return jsonError("internal_error", "Failed to get signal.", 500);
  }
}
