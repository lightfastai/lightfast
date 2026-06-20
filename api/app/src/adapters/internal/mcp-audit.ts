import { recordMcpAuditEvent } from "@db/app";
import { db } from "@db/app/client";
import { z } from "zod";

import {
  type VerifiedMcpServiceRequest,
  verifyMcpServiceRequest,
} from "./mcp-service-auth";

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

function jsonError(error: string, message: string, status: number): Response {
  return Response.json({ error, message }, { status });
}

function metadataWithVerifiedCaller(
  metadata: Record<string, unknown> | null | undefined,
  verified: VerifiedMcpServiceRequest
): Record<string, unknown> {
  return {
    ...(metadata ?? {}),
    caller: {
      credential: {
        audience: verified.credential.audience,
        caller: verified.credential.caller,
        kind: "service_jwt",
      },
      kind: verified.caller.kind,
      service: verified.caller.service,
    },
  };
}

export async function handleRecordMcpAuditInternalRequest(
  request: Request
): Promise<Response> {
  const verification = await verifyMcpServiceRequest(request);
  if (!verification.ok) {
    return verification.response;
  }

  const body = await request.json().catch(() => undefined);
  const parsed = mcpAuditEventInputSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("invalid_request", "MCP audit request is invalid.", 400);
  }

  await recordMcpAuditEvent(db, {
    ...parsed.data,
    metadata: metadataWithVerifiedCaller(
      parsed.data.metadata,
      verification.value
    ),
  });
  return Response.json({ success: true }, { status: 200 });
}
