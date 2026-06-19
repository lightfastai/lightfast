import { db } from "@db/app/client";
import {
  type McpProviderRoutineCallCommandInput,
  type McpProviderRoutineFindCommandInput,
  mcpProviderRoutineCallCommandInputSchema,
  mcpProviderRoutineFindCommandInputSchema,
  providerRoutineCallSuccessSchema,
  providerRoutineFindOutputSchema,
} from "@repo/api-contract";
import { verifyServiceJWT } from "@repo/service-jwt";

const noopProviderRoutineLog = {
  error: () => undefined,
  info: () => undefined,
  warn: () => undefined,
};

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
    adapters: {
      connectors: {
        loadTools: async () => {
          const { loadAgentConnectorRuntimeTools } = await import(
            "@api/app/services/connectors/runtime"
          );
          return await loadAgentConnectorRuntimeTools({
            calledByUserId: command.actor.userId,
            clerkOrgId: command.actor.orgId,
            sourceClientId: command.actor.clientId,
            sourceRef: command.actor.grantId,
            sourceSurface: "hosted_mcp",
          });
        },
      },
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
