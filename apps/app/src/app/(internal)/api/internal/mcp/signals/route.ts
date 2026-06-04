import { verifyServiceJWT } from "@api/app/service-jwt";
import { assertHostedMcpOrgAccess } from "@api/app/mcp-oauth/resource-access";
import { createSignalForActor } from "@api/app/signals/service";
import { db } from "@db/app/client";
import { createMcpSignalCommandInput } from "@repo/api-contract";

import { env } from "~/env";

export const runtime = "nodejs";

function bearerToken(request: Request): string | undefined {
  const authorization = request.headers.get("authorization");
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim();
}

function jsonError(error: string, message: string, status: number): Response {
  return Response.json({ error, message }, { status });
}

function isSignalCreateQueueErrorLike(error: unknown): error is Error {
  return error instanceof Error && error.name === "SignalCreateQueueError";
}

export async function POST(request: Request): Promise<Response> {
  const token = bearerToken(request);
  if (!token) {
    return jsonError("missing_token", "Service bearer token is required.", 401);
  }

  try {
    await verifyServiceJWT({
      allowedCallers: ["mcp"],
      audience: "lightfast-app",
      jwtSecret: env.SERVICE_JWT_SECRET,
      token,
    });
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
    if (
      error &&
      typeof error === "object" &&
      "status" in error &&
      (error as { status: unknown }).status === 403
    ) {
      return jsonError(
        "org_access_denied",
        error instanceof Error
          ? error.message
          : "MCP organization access denied.",
        403
      );
    }
    if (isSignalCreateQueueErrorLike(error)) {
      return jsonError("signal_enqueue_failed", error.message, 500);
    }
    return jsonError("internal_error", "Failed to create signal.", 500);
  }
}
