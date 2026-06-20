import { db } from "@db/app/client";
import {
  type McpProviderRoutineCallCommandInput,
  type McpProviderRoutineFindCommandInput,
  mcpProviderRoutineCallCommandInputSchema,
  mcpProviderRoutineFindCommandInputSchema,
  providerRoutineCallSuccessSchema,
  providerRoutineFindOutputSchema,
} from "@repo/api-contract";
import {
  type ProviderRoutineCommandDeps,
  providerRoutineCallCommand,
  providerRoutineFindCommand,
} from "../../domain/provider-routines";
import { createProviderRoutineCommandDeps } from "../../services/provider-routines/command-deps";
import { verifyMcpServiceRequest } from "./mcp-service-auth";

const noopProviderRoutineLog = {
  error: () => undefined,
  info: () => undefined,
  warn: () => undefined,
};

function jsonError(error: string, message: string, status: number): Response {
  return Response.json({ error, message }, { status });
}

export async function handleMcpProxyFindRequest(
  request: Request
): Promise<Response> {
  const verification = await verifyMcpServiceRequest(request);
  if (!verification.ok) {
    return verification.response;
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
    const { assertHostedMcpOrgAccess } = await import(
      "../../mcp-oauth/resource-access"
    );
    await assertHostedMcpOrgAccess(db, {
      orgId: parsed.data.actor.orgId,
      userId: parsed.data.actor.userId,
    });
    const result = await providerRoutineFindCommand.run({
      ctx: providerRoutineContext(parsed.data, verification.value.caller),
      deps: providerRoutineDeps(),
      input: {
        input: parsed.data.input,
        scopes: parsed.data.scopes,
      },
    });
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
  const verification = await verifyMcpServiceRequest(request);
  if (!verification.ok) {
    return verification.response;
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
    const { assertHostedMcpOrgAccess } = await import(
      "../../mcp-oauth/resource-access"
    );
    await assertHostedMcpOrgAccess(db, {
      orgId: parsed.data.actor.orgId,
      userId: parsed.data.actor.userId,
    });
    const result = await providerRoutineCallCommand.run({
      ctx: providerRoutineContext(parsed.data, verification.value.caller),
      deps: providerRoutineDeps(),
      input: {
        input: parsed.data.input,
        scopes: parsed.data.scopes,
      },
    });
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
    | McpProviderRoutineFindCommandInput,
  caller: { kind: "service"; service: "apps-mcp" }
) {
  return {
    actor: {
      clientId: command.actor.clientId,
      grantId: command.actor.grantId,
      kind: "mcpClient" as const,
      orgId: command.actor.orgId,
      scopes: command.actor.scopes,
      userId: command.actor.userId,
    },
    caller,
    request: { id: crypto.randomUUID(), source: "mcp" as const },
  };
}

function providerRoutineDeps() {
  const adapters: Pick<
    ProviderRoutineCommandDeps,
    "loadConnectorRuntimeTools"
  > = {
    loadConnectorRuntimeTools: async (input) => {
      const { loadAgentConnectorRuntimeTools } = await import(
        "../../services/connectors/runtime"
      );
      return await loadAgentConnectorRuntimeTools({
        ...input,
        sourceSurface: "hosted_mcp",
      });
    },
  };

  return createProviderRoutineCommandDeps({
    db,
    ...adapters,
    log: noopProviderRoutineLog,
    now: () => new Date(),
  });
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
