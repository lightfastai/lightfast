import { db } from "@db/app/client";
import {
  decisionFindOutputSchema,
  decisionGetOutputSchema,
  mcpDecisionFindCommandInputSchema,
  mcpDecisionGetCommandInputSchema,
} from "@repo/api-contract";

import { assertHostedMcpOrgAccess } from "../../mcp-oauth/resource-access";
import { findDecisions, getDecision } from "../../services/decisions";
import { verifyMcpServiceRequest } from "./mcp-service-auth";

function jsonError(error: string, message: string, status: number): Response {
  return Response.json({ error, message }, { status });
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

function ensureDecisionReadScope(input: {
  decisionRead: boolean;
}): Response | null {
  if (input.decisionRead) {
    return null;
  }

  return jsonError(
    "insufficient_scope",
    "MCP token is missing required scope mcp:decisions:read.",
    403
  );
}

export async function handleMcpDecisionFindRequest(
  request: Request
): Promise<Response> {
  const verification = await verifyMcpServiceRequest(request);
  if (!verification.ok) {
    return verification.response;
  }

  const body = await request.json().catch(() => undefined);
  const parsed = mcpDecisionFindCommandInputSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(
      "invalid_request",
      "MCP decision find request is invalid.",
      400
    );
  }

  const scopeError = ensureDecisionReadScope(parsed.data.scopes);
  if (scopeError) {
    return scopeError;
  }

  try {
    await assertHostedMcpOrgAccess(db, {
      orgId: parsed.data.actor.orgId,
      userId: parsed.data.actor.userId,
    });
    const result = await findDecisions(db, {
      clerkOrgId: parsed.data.actor.orgId,
      ...parsed.data.input,
    });
    return Response.json(decisionFindOutputSchema.parse(result), {
      status: 200,
    });
  } catch (error) {
    if (isMcpOrgAccessDenied(error)) {
      return jsonError(
        "org_access_denied",
        mcpOrgAccessDeniedMessage(error),
        403
      );
    }
    return jsonError("internal_error", "Failed to find decisions.", 500);
  }
}

export async function handleMcpDecisionGetRequest(
  request: Request
): Promise<Response> {
  const verification = await verifyMcpServiceRequest(request);
  if (!verification.ok) {
    return verification.response;
  }

  const body = await request.json().catch(() => undefined);
  const parsed = mcpDecisionGetCommandInputSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(
      "invalid_request",
      "MCP decision get request is invalid.",
      400
    );
  }

  const scopeError = ensureDecisionReadScope(parsed.data.scopes);
  if (scopeError) {
    return scopeError;
  }

  try {
    await assertHostedMcpOrgAccess(db, {
      orgId: parsed.data.actor.orgId,
      userId: parsed.data.actor.userId,
    });
    const result = await getDecision(db, {
      clerkOrgId: parsed.data.actor.orgId,
      id: parsed.data.input.id,
    });
    if (!result) {
      return jsonError("not_found", "Decision not found.", 404);
    }

    return Response.json(decisionGetOutputSchema.parse(result), {
      status: 200,
    });
  } catch (error) {
    if (isMcpOrgAccessDenied(error)) {
      return jsonError(
        "org_access_denied",
        mcpOrgAccessDeniedMessage(error),
        403
      );
    }
    return jsonError("internal_error", "Failed to get decision.", 500);
  }
}
