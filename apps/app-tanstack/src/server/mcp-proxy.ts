import { db } from "@db/app/client";
import {
  type McpProviderRoutineCallCommandInput,
  type McpProviderRoutineFindCommandInput,
  mcpProviderRoutineCallCommandInputSchema,
  mcpProviderRoutineFindCommandInputSchema,
  providerRoutineCallSuccessSchema,
  providerRoutineFindOutputSchema,
} from "@repo/provider-routine-contract";

import { jsonError, verifyMcpServiceRequest } from "./mcp-service-auth";

const noopProviderRoutineLog = {
  error: () => undefined,
  info: () => undefined,
  warn: () => undefined,
};

export async function handleMcpProxyFindRequest(
  request: Request
): Promise<Response> {
  const authError = await verifyMcpServiceRequest(request);
  if (authError) {
    return authError;
  }

  const body = await request.json().catch(() => undefined);
  const parsed = mcpProviderRoutineFindCommandInputSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(
      "invalid_request",
      "MCP provider routine find request is invalid.",
      400
    );
  }

  try {
    const [{ assertHostedMcpOrgAccess }, { findProviderRoutines }] =
      await Promise.all([
        import("@api/app/mcp-oauth/resource-access"),
        import("@repo/provider-routines"),
      ]);
    await assertHostedMcpOrgAccess(db, {
      orgId: parsed.data.actor.orgId,
      userId: parsed.data.actor.userId,
    });
    const result = await findProviderRoutines(
      providerRoutineContext(parsed.data),
      parsed.data.input
    );
    return Response.json(providerRoutineFindOutputSchema.parse(result), {
      status: 200,
    });
  } catch (error) {
    return errorResponse(error, "Failed to find provider routines.");
  }
}

export async function handleMcpProxyCallRequest(
  request: Request
): Promise<Response> {
  const authError = await verifyMcpServiceRequest(request);
  if (authError) {
    return authError;
  }

  const body = await request.json().catch(() => undefined);
  const parsed = mcpProviderRoutineCallCommandInputSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(
      "invalid_request",
      "MCP provider routine call request is invalid.",
      400
    );
  }

  try {
    const [{ assertHostedMcpOrgAccess }, { callProviderRoutine }] =
      await Promise.all([
        import("@api/app/mcp-oauth/resource-access"),
        import("@repo/provider-routines"),
      ]);
    await assertHostedMcpOrgAccess(db, {
      orgId: parsed.data.actor.orgId,
      userId: parsed.data.actor.userId,
    });
    const result = await callProviderRoutine(
      providerRoutineContext(parsed.data),
      parsed.data.input
    );
    return Response.json(providerRoutineCallSuccessSchema.parse(result), {
      status: 200,
    });
  } catch (error) {
    return errorResponse(error, "Failed to call provider routine.");
  }
}

function providerRoutineContext(
  command:
    | McpProviderRoutineCallCommandInput
    | McpProviderRoutineFindCommandInput
) {
  return {
    actor: {
      orgId: command.actor.orgId,
      userId: command.actor.userId,
    },
    db,
    log: noopProviderRoutineLog,
    now: () => new Date(),
    scopes: command.scopes,
    source: {
      clientId: command.actor.clientId,
      ref: command.actor.grantId,
      surface: "hosted_mcp" as const,
    },
  };
}

function errorResponse(error: unknown, fallbackMessage: string): Response {
  if (isOrgAccessError(error)) {
    return jsonError(
      "org_access_denied",
      error instanceof Error
        ? error.message
        : "MCP organization access denied.",
      403
    );
  }

  const providerRoutineError = providerRoutineErrorResponse(error);
  if (providerRoutineError) {
    return providerRoutineError;
  }

  return jsonError("internal_error", fallbackMessage, 500);
}

function isOrgAccessError(error: unknown): boolean {
  return (
    error !== null &&
    typeof error === "object" &&
    "status" in error &&
    (error as { status: unknown }).status === 403
  );
}

function providerRoutineErrorResponse(error: unknown): Response | null {
  if (!isProviderRoutineErrorLike(error)) {
    return null;
  }

  const body = {
    error: error.code,
    message: providerRoutineErrorMessage(error),
    ...(typeof error.providerRoutineCallId === "string"
      ? { providerRoutineCallId: error.providerRoutineCallId }
      : {}),
    ...(typeof error.routineId === "string"
      ? { routineId: error.routineId }
      : {}),
  };
  return Response.json(body, {
    status: statusFromProviderRoutineError(error.code),
  });
}

function isProviderRoutineErrorLike(error: unknown): error is Error & {
  code: string;
  providerRoutineCallId?: unknown;
  publicMessage?: unknown;
  routineId?: unknown;
} {
  return (
    error instanceof Error &&
    "code" in error &&
    typeof error.code === "string" &&
    error.code.startsWith("PROVIDER_ROUTINE_")
  );
}

function providerRoutineErrorMessage(error: {
  message: string;
  publicMessage?: unknown;
}) {
  return typeof error.publicMessage === "string"
    ? error.publicMessage
    : error.message;
}

function statusFromProviderRoutineError(code: string): number {
  switch (code) {
    case "PROVIDER_ROUTINE_INSUFFICIENT_SCOPE":
      return 403;
    case "PROVIDER_ROUTINE_INVALID_INPUT":
      return 400;
    case "PROVIDER_ROUTINE_CONNECTION_REQUIRED":
    case "PROVIDER_ROUTINE_NOT_ENABLED":
    case "PROVIDER_ROUTINE_NOT_FOUND":
      return 404;
    default:
      return 502;
  }
}
