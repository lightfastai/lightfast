import type { Database, RecordMcpAuditEventInput, Signal } from "@db/app";
import {
  apiContract,
  type CreateSignalInput,
  type GetSignalInput,
  lightfastMcpToolPolicy,
  type McpScope,
} from "@repo/api-contract";
import {
  createLightfastMcpToolDefinitions,
  formatMcpError,
  formatMcpSuccess,
  type LightfastMcpToolDefinition,
} from "@repo/mcp-tools";
import { z } from "zod";

import {
  createMcpContextFromAuthInfo,
  type HostedMcpAuthInfo,
  type HostedMcpContext,
} from "../context";

const DEFAULT_VERSION = "0.1.0";

interface HostedMcpServerAdapter {
  registerTool: (
    name: string,
    config: Record<string, unknown>,
    callback: (...args: unknown[]) => Promise<unknown>
  ) => unknown;
}

export type HostedMcpToolErrorCode =
  | "insufficient_scope"
  | "invalid_input"
  | "not_found"
  | "org_access_denied"
  | "unsupported_tool";

export class HostedMcpToolError extends Error {
  constructor(
    readonly code: HostedMcpToolErrorCode,
    message: string,
    readonly status: number,
    readonly auditOutcome: RecordMcpAuditEventInput["outcome"] = "error",
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = "HostedMcpToolError";
  }
}

export interface ExecuteHostedMcpToolDependencies {
  assertOrgAccess: (
    db: Database,
    input: { orgId: string; userId: string }
  ) => Promise<void>;
  createSignalForActor: (
    db: Database,
    input: {
      actor: {
        clientId: string;
        grantId: string;
        kind: "mcp";
        orgId: string;
        userId: string;
      };
      input: string;
    }
  ) => Promise<unknown>;
  db: Database;
  getVisibleSignalByPublicId: (
    db: Database,
    input: {
      clerkOrgId: string;
      createdByUserId: string;
      publicId: string;
    }
  ) => Promise<Signal | undefined>;
  now: () => Date;
  recordMcpAuditEvent: (
    db: Database,
    input: RecordMcpAuditEventInput
  ) => Promise<void>;
  version: string;
}

export interface ExecuteHostedMcpToolInput {
  context: HostedMcpContext;
  contractPath: string;
  dependencies?: ExecuteHostedMcpToolDependencies;
  rawInput: unknown;
  tool?: LightfastMcpToolDefinition;
}

export function listHostedMcpTools(
  _context?: HostedMcpContext
): LightfastMcpToolDefinition[] {
  return createLightfastMcpToolDefinitions({
    contract: apiContract,
    policy: lightfastMcpToolPolicy,
  });
}

export function registerHostedMcpTools(server: unknown): void {
  const target = server as HostedMcpServerAdapter;
  for (const tool of listHostedMcpTools()) {
    const config: Record<string, unknown> = {
      description: tool.description,
    };
    if (tool.inputSchema) {
      config.inputSchema = tool.inputSchema;
    }
    if (tool.outputSchema) {
      config.outputSchema = tool.outputSchema;
    }

    target.registerTool(tool.name, config, async (...args: unknown[]) => {
      const rawInput = tool.inputSchema ? args[0] : undefined;
      const extra = (tool.inputSchema ? args[1] : args[0]) as
        | { authInfo?: HostedMcpAuthInfo }
        | undefined;
      const context = createMcpContextFromAuthInfo(extra?.authInfo);

      try {
        const result = await executeHostedMcpTool({
          context,
          contractPath: tool.contractPath,
          rawInput,
          tool,
        });
        return formatMcpSuccess(result);
      } catch (error) {
        return formatMcpError(error);
      }
    });
  }
}

export async function executeHostedMcpTool(
  input: ExecuteHostedMcpToolInput
): Promise<unknown> {
  const dependencies = input.dependencies ?? (await defaultDependencies());
  const tool = input.tool ?? toolForContractPath(input.contractPath);
  const startedAt = dependencies.now();

  try {
    ensureScope(input.context, tool.requiredScope);
    if (tool.requiresBoundOrg) {
      await dependencies.assertOrgAccess(dependencies.db, {
        orgId: input.context.orgId,
        userId: input.context.userId,
      });
    }

    const parsedInput = parseToolInput(tool, input.rawInput);
    const result = await executeParsedTool({
      context: input.context,
      dependencies,
      contractPath: tool.contractPath,
      parsedInput,
    });

    await recordAudit({
      context: input.context,
      dependencies,
      error: null,
      outcome: "success",
      startedAt,
      tool,
    });
    return result;
  } catch (error) {
    const normalized = normalizeToolError(error);
    await recordAudit({
      context: input.context,
      dependencies,
      error: normalized,
      outcome: normalized.auditOutcome,
      startedAt,
      tool,
    });
    throw normalized;
  }
}

async function executeParsedTool(input: {
  context: HostedMcpContext;
  contractPath: string;
  dependencies: ExecuteHostedMcpToolDependencies;
  parsedInput: unknown;
}): Promise<unknown> {
  switch (input.contractPath) {
    case "system.health":
      return {
        status: "ok",
        timestamp: input.dependencies.now().toISOString(),
        version: input.dependencies.version,
      };

    case "signals.create": {
      const createInput = input.parsedInput as CreateSignalInput;
      return await input.dependencies.createSignalForActor(
        input.dependencies.db,
        {
          actor: {
            clientId: input.context.clientId,
            grantId: input.context.grantId,
            kind: "mcp",
            orgId: input.context.orgId,
            userId: input.context.userId,
          },
          input: createInput.input,
        }
      );
    }

    case "signals.get": {
      const getInput = input.parsedInput as GetSignalInput;
      const signal = await input.dependencies.getVisibleSignalByPublicId(
        input.dependencies.db,
        {
          publicId: getInput.id,
          clerkOrgId: input.context.orgId,
          createdByUserId: input.context.userId,
        }
      );
      if (!signal) {
        throw new HostedMcpToolError("not_found", "Signal not found.", 404);
      }
      return {
        id: signal.publicId,
        input: signal.input,
        status: signal.status,
        classification: signal.classification,
        visibilityScope: signal.visibilityScope,
        createdAt: signal.createdAt.toISOString(),
        updatedAt: signal.updatedAt.toISOString(),
      };
    }

    default:
      throw new HostedMcpToolError(
        "unsupported_tool",
        `Unsupported MCP contract path: ${input.contractPath}`,
        400,
        "denied"
      );
  }
}

function ensureScope(context: HostedMcpContext, requiredScope: McpScope): void {
  if (!context.scopes.includes(requiredScope)) {
    throw new HostedMcpToolError(
      "insufficient_scope",
      `MCP token is missing required scope ${requiredScope}.`,
      403,
      "denied"
    );
  }
}

function parseToolInput(
  tool: LightfastMcpToolDefinition,
  rawInput: unknown
): unknown {
  if (!tool.inputSchema) {
    return;
  }

  const schema = tool.inputSchema as { parse?: (input: unknown) => unknown };
  if (typeof schema.parse !== "function") {
    return rawInput;
  }

  try {
    return schema.parse(rawInput);
  } catch (error) {
    throw new HostedMcpToolError(
      "invalid_input",
      "MCP tool input is invalid.",
      400,
      "denied",
      { cause: error }
    );
  }
}

function toolForContractPath(contractPath: string): LightfastMcpToolDefinition {
  const tool = listHostedMcpTools().find(
    (candidate) => candidate.contractPath === contractPath
  );
  if (!tool) {
    throw new HostedMcpToolError(
      "unsupported_tool",
      `Unsupported MCP contract path: ${contractPath}`,
      400,
      "denied"
    );
  }
  return tool;
}

async function recordAudit(input: {
  context: HostedMcpContext;
  dependencies: ExecuteHostedMcpToolDependencies;
  error: HostedMcpToolError | null;
  outcome: RecordMcpAuditEventInput["outcome"];
  startedAt: Date;
  tool: LightfastMcpToolDefinition;
}): Promise<void> {
  const endedAt = input.dependencies.now();
  await input.dependencies.recordMcpAuditEvent(input.dependencies.db, {
    clientPublicId: input.context.clientId,
    clerkOrgId: input.context.orgId,
    clerkUserId: input.context.userId,
    eventName: input.tool.auditEventName,
    grantPublicId: input.context.grantId,
    outcome: input.outcome,
    metadata: {
      clientVerificationStatus: input.context.clientVerificationStatus,
      contractPath: input.tool.contractPath,
      error: input.error ? safeAuditError(input.error) : null,
      latencyMs: Math.max(0, endedAt.getTime() - input.startedAt.getTime()),
      requestId: input.context.requestId,
      requiredScope: input.tool.requiredScope,
      scopes: input.context.scopes,
      toolName: input.tool.name,
    },
  });
}

function safeAuditError(error: HostedMcpToolError): {
  code: HostedMcpToolErrorCode;
  message: string;
} {
  return {
    code: error.code,
    message: error.message,
  };
}

function normalizeToolError(error: unknown): HostedMcpToolError {
  if (error instanceof HostedMcpToolError) {
    return error;
  }

  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    "status" in error &&
    typeof (error as { status: unknown }).status === "number"
  ) {
    return new HostedMcpToolError(
      "org_access_denied",
      error instanceof Error
        ? error.message
        : "MCP organization access denied.",
      (error as { status: number }).status,
      "denied",
      { cause: error }
    );
  }

  if (error instanceof z.ZodError) {
    return new HostedMcpToolError(
      "invalid_input",
      "MCP tool input is invalid.",
      400,
      "denied",
      { cause: error }
    );
  }

  return new HostedMcpToolError(
    "unsupported_tool",
    error instanceof Error ? error.message : "MCP tool execution failed.",
    500,
    "error",
    { cause: error }
  );
}

async function defaultDependencies(): Promise<ExecuteHostedMcpToolDependencies> {
  const [dbApp, signalService, mcpOauth] = await Promise.all([
    import("@db/app"),
    import("@api/app/signals/service"),
    import("@api/app/mcp-oauth"),
  ]);

  return {
    assertOrgAccess: mcpOauth.assertHostedMcpOrgAccess,
    createSignalForActor: signalService.createSignalForActor,
    db: dbApp.db,
    getVisibleSignalByPublicId: dbApp.getVisibleSignalByPublicId,
    now: () => new Date(),
    recordMcpAuditEvent: dbApp.recordMcpAuditEvent,
    version: process.env.npm_package_version ?? DEFAULT_VERSION,
  };
}
