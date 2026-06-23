import {
  getVisibleSignalByPublicId,
  listSignalEntityLinksForSignal,
} from "@db/app";
import { db } from "@db/app/client";
import {
  type CreateMcpSignalCommandInput,
  createMcpSignalCommandInput,
  type GetMcpSignalCommandInput,
  getMcpSignalCommandInput,
  getSignalOutput,
} from "@repo/api-contract";

import { type ExecutionContext, isDomainError } from "../../domain";
import {
  createSignalCommand,
  getSignalCommand,
  type SignalCreateCommandDeps,
  type SignalGetCommandDeps,
} from "../../domain/signals";
import { assertHostedMcpOrgAccess } from "../../mcp-oauth/resource-access";
import {
  createAndQueueSignal,
  isSignalCreateQueueError,
} from "../../signals/create-signal";
import {
  type AppsMcpServiceCaller,
  verifyMcpServiceRequest,
} from "./mcp-service-auth";

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

function requestId() {
  return crypto.randomUUID();
}

type McpSignalCommand = CreateMcpSignalCommandInput | GetMcpSignalCommandInput;

function mcpSignalContext(
  command: McpSignalCommand,
  caller: AppsMcpServiceCaller
): ExecutionContext {
  return {
    actor: {
      clientId: command.actor.clientId,
      grantId: command.actor.grantId,
      kind: "mcpClient",
      orgId: command.actor.orgId,
      scopes: command.scopes,
      userId: command.actor.userId,
    },
    caller,
    request: { id: requestId(), source: "mcp" },
  };
}

function createSignalDeps(): SignalCreateCommandDeps {
  return {
    createAndQueueSignal: (input) => createAndQueueSignal(db, input),
    isSignalCreateQueueError,
  };
}

function getSignalDeps(): SignalGetCommandDeps {
  return {
    getVisibleSignalByPublicId: (input) =>
      getVisibleSignalByPublicId(db, input),
    listSignalEntityLinksForSignal: (input) =>
      listSignalEntityLinksForSignal(db, input),
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
  const verification = await verifyMcpServiceRequest(request);
  if (!verification.ok) {
    return verification.response;
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
      ctx: mcpSignalContext(parsed.data, verification.value.caller),
      deps: createSignalDeps(),
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
  const verification = await verifyMcpServiceRequest(request);
  if (!verification.ok) {
    return verification.response;
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
      ctx: mcpSignalContext(parsed.data, verification.value.caller),
      deps: getSignalDeps(),
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
