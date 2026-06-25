import { getMcpOauthGrantByPublicId } from "@db/app";
import { db } from "@db/app/client";
import { z } from "zod";

import {
  canonicalOAuthResource,
  McpOAuthError,
  requireHostedMcpResource,
} from "../../mcp-oauth";
import { verifyMcpServiceRequest } from "./mcp-service-auth";

const mcpGrantValidationInputSchema = z
  .object({
    clientId: z.string().min(1),
    grantId: z.string().min(1),
    orgId: z.string().min(1),
    resource: z.string().url(),
    userId: z.string().min(1),
  })
  .strict();

function json(data: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set("cache-control", "no-store");
  headers.set("content-type", "application/json");
  headers.set("pragma", "no-cache");
  return Response.json(data, { ...init, headers });
}

function jsonError(error: string, message: string, status: number): Response {
  return json({ error, message }, { status });
}

function invalidGrantResponse(): Response {
  return jsonError(
    "mcp_grant_invalid",
    "MCP authorization grant is invalid.",
    403
  );
}

export async function handleValidateMcpGrantInternalRequest(
  request: Request
): Promise<Response> {
  const verification = await verifyMcpServiceRequest(request);
  if (!verification.ok) {
    return verification.response;
  }

  const body = await request.json().catch(() => undefined);
  const parsed = mcpGrantValidationInputSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(
      "invalid_request",
      "MCP grant validation request is invalid.",
      400
    );
  }
  let resource: string;
  try {
    resource = requireHostedMcpResource(parsed.data.resource);
  } catch (error) {
    if (error instanceof McpOAuthError) {
      return jsonError("invalid_request", error.message, error.status);
    }
    throw error;
  }

  const grant = await getMcpOauthGrantByPublicId(db, {
    publicId: parsed.data.grantId,
  });
  if (!grant || grant.status !== "active") {
    return invalidGrantResponse();
  }
  if (
    grant.clientPublicId !== parsed.data.clientId ||
    grant.clerkOrgId !== parsed.data.orgId ||
    grant.clerkUserId !== parsed.data.userId ||
    !grantMatchesResource(grant.resource, resource)
  ) {
    return invalidGrantResponse();
  }

  return json({ active: true }, { status: 200 });
}

function grantMatchesResource(
  grantResource: string,
  resource: string
): boolean {
  try {
    return canonicalOAuthResource(grantResource) === resource;
  } catch {
    return false;
  }
}
