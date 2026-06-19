import { db } from "@db/app/client";
import {
  type CreateMcpSignalCommandInput,
  createMcpSignalCommandInput,
  type GetMcpSignalCommandInput,
  getMcpSignalCommandInput,
  getSignalOutput,
} from "@repo/api-contract";
import { verifyServiceJWT } from "@repo/service-jwt";

import { type ExecutionContext, isDomainError } from "../../domain";
import {
  createSignalCommand,
  createSignalCommandDeps,
  getSignalCommand,
  getSignalCommandDeps,
} from "../../domain/signals";
import { assertHostedMcpOrgAccess } from "../../mcp-oauth/resource-access";

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

function requestId() {
  return crypto.randomUUID();
}

type McpSignalActor =
  | CreateMcpSignalCommandInput["actor"]
  | GetMcpSignalCommandInput["actor"];

function mcpSignalContext(actor: McpSignalActor): ExecutionContext {
  return {
    actor: {
      clientId: actor.clientId,
      grantId: actor.grantId,
      kind: "mcpClient",
      orgId: actor.orgId,
      scopes: [],
      userId: actor.userId,
    },
    caller: { kind: "service", service: "apps-mcp" },
    request: { id: requestId(), source: "mcp" },
  };
}

function domainErrorResponse(
  error: unknown,
  fallbackMessage: string
): Response {
  if (!isDomainError(error)) {
    return jsonError("internal_error", fallbackMessage, 500);
  }

  if (error.code === "SIGNAL_NOT_FOUND") {
    return jsonError("not_found", "Signal not found.", 404);
  }

  if (error.code === "SIGNAL_QUEUE_FAILED") {
    return jsonError("signal_enqueue_failed", error.message, 500);
  }

  if (error.kind === "authz") {
    return jsonError("forbidden", error.message, 403);
  }

  if (error.kind === "validation") {
    return jsonError("invalid_request", error.message, 400);
  }

  return jsonError("internal_error", fallbackMessage, 500);
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
    const result = await createSignalCommand.run({
      ctx: mcpSignalContext(parsed.data.actor),
      deps: createSignalCommandDeps({ db }),
      input: { input: parsed.data.input },
    });
    return Response.json(result, { status: 200 });
  } catch (error) {
    if (isMcpOrgAccessDenied(error)) {
      return jsonError(
        "org_access_denied",
        mcpOrgAccessDeniedMessage(error),
        403
      );
    }
    return domainErrorResponse(error, "Failed to create signal.");
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
    const signal = await getSignalCommand.run({
      ctx: mcpSignalContext(parsed.data.actor),
      deps: getSignalCommandDeps({ db }),
      input: { publicId: parsed.data.id },
    });

    const output = getSignalOutput.parse({
      id: signal.publicId,
      input: signal.input,
      status: signal.status,
      classification: signal.classification,
      entityLinks: signal.entityLinks,
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
    return domainErrorResponse(error, "Failed to get signal.");
  }
}
