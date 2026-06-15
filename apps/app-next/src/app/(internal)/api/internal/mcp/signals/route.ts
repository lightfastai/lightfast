import { assertHostedMcpOrgAccess } from "@api/app/mcp-oauth/resource-access";
import { createSignalForActor } from "@api/app/signals/service";
import { db } from "@db/app/client";
import { createMcpSignalCommandInput } from "@repo/api-contract";

import { jsonError, verifyMcpServiceRequest } from "./service-auth";

export const runtime = "nodejs";

function isSignalCreateQueueErrorLike(error: unknown): error is Error {
  return error instanceof Error && error.name === "SignalCreateQueueError";
}

export async function POST(request: Request): Promise<Response> {
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
