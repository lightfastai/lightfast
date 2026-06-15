import { assertHostedMcpOrgAccess } from "@api/app/mcp-oauth/resource-access";
import {
  getVisibleSignalByPublicId,
  listSignalEntityLinksForSignal,
} from "@db/app";
import { db } from "@db/app/client";
import { getMcpSignalCommandInput, getSignalOutput } from "@repo/api-contract";

import { jsonError, verifyMcpServiceRequest } from "../service-auth";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
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

    const entityLinks = await listSignalEntityLinksForSignal(db, {
      clerkOrgId: parsed.data.actor.orgId,
      signalId: signal.publicId,
    });

    const output = getSignalOutput.parse({
      id: signal.publicId,
      input: signal.input,
      status: signal.status,
      classification: signal.classification,
      entityLinks,
      visibilityScope: signal.visibilityScope,
      createdAt: signal.createdAt.toISOString(),
      updatedAt: signal.updatedAt.toISOString(),
    });
    return Response.json(output, { status: 200 });
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
    return jsonError("internal_error", "Failed to get signal.", 500);
  }
}
