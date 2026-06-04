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
import {
  type ProviderRoutineCallInput,
  type ProviderRoutineCallSuccess,
  type ProviderRoutineFindInput,
  type ProviderRoutineFindOutput,
  type ProviderRoutineSourceSurface,
  providerRoutineCallInputSchema,
  providerRoutineFindInputSchema,
} from "@repo/provider-routine-contract";
import * as Sentry from "@sentry/tanstackstart-react";
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
  | "upstream_error"
  | "unsupported_tool";

export class HostedMcpToolError extends Error {
  constructor(
    readonly code: HostedMcpToolErrorCode,
    message: string,
    readonly status: number,
    readonly auditOutcome: RecordMcpAuditEventInput["outcome"] = "error",
    options?: ErrorOptions,
    readonly providerRoutineCallId?: string
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
  callProviderRoutine: CallProviderRoutineService;
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
  findProviderRoutines: FindProviderRoutinesService;
  getVisibleSignalByPublicId: (
    db: Database,
    input: {
      clerkOrgId: string;
      createdByUserId: string;
      publicId: string;
    }
  ) => Promise<Signal | undefined>;
  now: () => Date;
  providerRoutineLog?: ProviderRoutineServiceLog;
  recordMcpAuditEvent: (
    db: Database,
    input: RecordMcpAuditEventInput
  ) => Promise<void>;
  version: string;
}

interface ProviderRoutineServiceLog {
  error(message: string, metadata?: Record<string, unknown>): void;
  info(message: string, metadata?: Record<string, unknown>): void;
  warn(message: string, metadata?: Record<string, unknown>): void;
}

interface ProviderRoutineServiceContext {
  actor: {
    orgId: string;
    userId: string;
  };
  db: Database;
  log: ProviderRoutineServiceLog;
  now: () => Date;
  scopes: {
    providerRoutineRead: boolean;
    providerRoutineWrite: boolean;
  };
  source: {
    clientId?: string | null;
    ref?: string | null;
    surface: ProviderRoutineSourceSurface;
  };
}

type CallProviderRoutineService = (
  context: ProviderRoutineServiceContext,
  input: ProviderRoutineCallInput
) => Promise<ProviderRoutineCallSuccess>;

type FindProviderRoutinesService = (
  context: ProviderRoutineServiceContext,
  input: ProviderRoutineFindInput
) => Promise<ProviderRoutineFindOutput>;

interface ProviderRoutineServiceModule {
  callProviderRoutine: CallProviderRoutineService;
  findProviderRoutines: FindProviderRoutinesService;
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
  return [
    ...createLightfastMcpToolDefinitions({
      contract: apiContract,
      policy: lightfastMcpToolPolicy,
    }),
    ...PROXY_TOOLS,
  ];
}

const PROXY_TOOLS = [
  {
    auditEventName: "mcp.proxy.call",
    contractPath: "proxy.call",
    description:
      "Call one enabled provider routine through Lightfast using the current organization connection.",
    expose: true,
    inputSchema: providerRoutineCallInputSchema,
    kind: "write",
    name: "proxy_call",
    requiredScope: "mcp:provider_routines:read",
    requiresBoundOrg: true,
    scope: "mcp:provider_routines:read",
    toolName: "proxy_call",
  },
  {
    auditEventName: "mcp.proxy.find",
    contractPath: "proxy.find",
    description:
      "Find enabled provider routines available through Lightfast for the current organization.",
    expose: true,
    inputSchema: providerRoutineFindInputSchema,
    kind: "read",
    name: "proxy_find",
    requiredScope: "mcp:provider_routines:read",
    requiresBoundOrg: true,
    scope: "mcp:provider_routines:read",
    toolName: "proxy_find",
  },
] satisfies LightfastMcpToolDefinition[];

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
  const tool = input.tool ?? toolForContractPath(input.contractPath);
  const dependencies =
    input.dependencies ?? (await defaultDependencies(tool.contractPath));
  const startedAt = dependencies.now();
  let providerRoutineCallId: string | undefined;

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
    providerRoutineCallId = providerRoutineCallIdFromResult(result);

    await recordAudit({
      context: input.context,
      dependencies,
      error: null,
      outcome: "success",
      providerRoutineCallId,
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
      providerRoutineCallId: normalized.providerRoutineCallId,
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

    case "proxy.find": {
      const findInput = input.parsedInput as ProviderRoutineFindInput;
      return await input.dependencies.findProviderRoutines(
        providerRoutineContext(input.context, input.dependencies),
        findInput
      );
    }

    case "proxy.call": {
      const callInput = input.parsedInput as ProviderRoutineCallInput;
      return await input.dependencies.callProviderRoutine(
        providerRoutineContext(input.context, input.dependencies),
        callInput
      );
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
  const hasScope =
    context.scopes.includes(requiredScope) ||
    (requiredScope === "mcp:provider_routines:read" &&
      context.scopes.includes("mcp:provider_routines:write"));
  if (!hasScope) {
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
  providerRoutineCallId?: string;
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
      ...(input.providerRoutineCallId
        ? { providerRoutineCallId: input.providerRoutineCallId }
        : {}),
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
    const status = (error as { status: number }).status;
    if (status !== 401 && status !== 403) {
      return new HostedMcpToolError(
        "upstream_error",
        error instanceof Error ? error.message : "MCP upstream error.",
        status,
        "error",
        { cause: error }
      );
    }

    return new HostedMcpToolError(
      "org_access_denied",
      error instanceof Error
        ? error.message
        : "MCP organization access denied.",
      status,
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

  if (isProviderRoutineErrorLike(error)) {
    const mapped = mapProviderRoutineError(error);
    return new HostedMcpToolError(
      mapped.code,
      error instanceof Error ? error.message : mapped.message,
      mapped.status,
      mapped.outcome,
      { cause: error },
      error.providerRoutineCallId
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

async function defaultDependencies(
  contractPath: string
): Promise<ExecuteHostedMcpToolDependencies> {
  const dbApp = await import("@db/app");
  const base = {
    db: dbApp.db,
    now: () => new Date(),
    providerRoutineLog: sentryProviderRoutineLog,
    recordMcpAuditEvent: dbApp.recordMcpAuditEvent,
    version: process.env.npm_package_version ?? DEFAULT_VERSION,
  };

  if (contractPath === "system.health") {
    return {
      ...base,
      assertOrgAccess: unavailableAssertOrgAccess,
      callProviderRoutine: unavailableCallProviderRoutine,
      createSignalForActor: unavailableCreateSignalForActor,
      findProviderRoutines: unavailableFindProviderRoutines,
      getVisibleSignalByPublicId: dbApp.getVisibleSignalByPublicId,
    };
  }

  if (contractPath === "signals.create") {
    const appSignalIntake = await import("./app-signal-intake");
    return {
      ...base,
      assertOrgAccess: signalOrgAccessHandledDownstream,
      callProviderRoutine: unavailableCallProviderRoutine,
      createSignalForActor: appSignalIntake.createSignalForActorViaApp,
      findProviderRoutines: unavailableFindProviderRoutines,
      getVisibleSignalByPublicId: dbApp.getVisibleSignalByPublicId,
    };
  }

  if (contractPath === "signals.get") {
    return {
      ...base,
      assertOrgAccess: signalOrgAccessHandledDownstream,
      callProviderRoutine: unavailableCallProviderRoutine,
      createSignalForActor: unavailableCreateSignalForActor,
      findProviderRoutines: unavailableFindProviderRoutines,
      getVisibleSignalByPublicId: dbApp.getVisibleSignalByPublicId,
    };
  }

  if (contractPath === "proxy.find" || contractPath === "proxy.call") {
    const [mcpOauth, providerRoutines] = await Promise.all([
      import("@api/app/mcp-oauth"),
      import(
        "@repo/provider-routines"
      ) as Promise<ProviderRoutineServiceModule>,
    ]);
    return {
      ...base,
      assertOrgAccess: mcpOauth.assertHostedMcpOrgAccess,
      callProviderRoutine: providerRoutines.callProviderRoutine,
      createSignalForActor: unavailableCreateSignalForActor,
      findProviderRoutines: providerRoutines.findProviderRoutines,
      getVisibleSignalByPublicId: dbApp.getVisibleSignalByPublicId,
    };
  }

  return {
    ...base,
    assertOrgAccess: unavailableAssertOrgAccess,
    callProviderRoutine: unavailableCallProviderRoutine,
    createSignalForActor: unavailableCreateSignalForActor,
    findProviderRoutines: unavailableFindProviderRoutines,
    getVisibleSignalByPublicId: dbApp.getVisibleSignalByPublicId,
  };
}

async function unavailableAssertOrgAccess(): Promise<void> {
  throw unavailableDependencyError();
}

async function signalOrgAccessHandledDownstream(): Promise<void> {
  return;
}

async function unavailableCreateSignalForActor(): Promise<never> {
  throw unavailableDependencyError();
}

async function unavailableFindProviderRoutines(): Promise<never> {
  throw unavailableDependencyError();
}

async function unavailableCallProviderRoutine(): Promise<never> {
  throw unavailableDependencyError();
}

function unavailableDependencyError() {
  return new HostedMcpToolError(
    "unsupported_tool",
    "MCP tool dependency is unavailable for this tool.",
    500
  );
}

function providerRoutineContext(
  context: HostedMcpContext,
  dependencies: ExecuteHostedMcpToolDependencies
): ProviderRoutineServiceContext {
  const hasWrite = context.scopes.includes("mcp:provider_routines:write");
  return {
    actor: {
      orgId: context.orgId,
      userId: context.userId,
    },
    db: dependencies.db,
    log: dependencies.providerRoutineLog ?? noopProviderRoutineLog,
    now: dependencies.now,
    scopes: {
      providerRoutineRead:
        context.scopes.includes("mcp:provider_routines:read") || hasWrite,
      providerRoutineWrite: hasWrite,
    },
    source: {
      clientId: context.clientId,
      ref: context.grantId,
      surface: "hosted_mcp",
    },
  };
}

const noopProviderRoutineLog: ProviderRoutineServiceLog = {
  error: () => undefined,
  info: () => undefined,
  warn: () => undefined,
};

const sentryProviderRoutineLog: ProviderRoutineServiceLog = {
  error: (message, metadata) => {
    console.error(message, metadata);
    Sentry.logger.error(message, metadata);
  },
  info: (message, metadata) => {
    console.info(message, metadata);
    Sentry.logger.info(message, metadata);
  },
  warn: (message, metadata) => {
    console.warn(message, metadata);
    Sentry.logger.warn(message, metadata);
  },
};

function providerRoutineCallIdFromResult(result: unknown) {
  if (
    result &&
    typeof result === "object" &&
    "providerRoutineCallId" in result &&
    typeof (result as ProviderRoutineCallSuccess).providerRoutineCallId ===
      "string"
  ) {
    return (result as ProviderRoutineCallSuccess).providerRoutineCallId;
  }
  return;
}

function isProviderRoutineErrorLike(
  error: unknown
): error is Error & { code: string; providerRoutineCallId?: string } {
  return (
    error instanceof Error &&
    "code" in error &&
    typeof error.code === "string" &&
    error.code.startsWith("PROVIDER_ROUTINE_")
  );
}

function mapProviderRoutineError(error: { code: string }): {
  code: HostedMcpToolErrorCode;
  message: string;
  outcome: RecordMcpAuditEventInput["outcome"];
  status: number;
} {
  switch (error.code) {
    case "PROVIDER_ROUTINE_INSUFFICIENT_SCOPE":
      return {
        code: "insufficient_scope",
        message: "Provider routine requires additional scope.",
        outcome: "denied",
        status: 403,
      };
    case "PROVIDER_ROUTINE_INVALID_INPUT":
      return {
        code: "invalid_input",
        message: "MCP tool input is invalid.",
        outcome: "denied",
        status: 400,
      };
    case "PROVIDER_ROUTINE_CONNECTION_REQUIRED":
    case "PROVIDER_ROUTINE_NOT_ENABLED":
    case "PROVIDER_ROUTINE_NOT_FOUND":
      return {
        code: "not_found",
        message: "Provider routine was not found.",
        outcome: "denied",
        status: 404,
      };
    default:
      return {
        code: "upstream_error",
        message: "Provider routine failed.",
        outcome: "error",
        status: 502,
      };
  }
}
