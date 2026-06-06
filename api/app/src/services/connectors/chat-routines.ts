import {
  getCurrentOrgConnectorConnection,
  listCurrentOrgConnectorConnections,
  type OrgConnectorConnection,
} from "@db/app";
import { db as appDb } from "@db/app/client";
import type {
  ConnectableConnectorProvider,
  FullConnectorToolManifestItem,
} from "@repo/connector-contract";
import {
  type ProviderRoutineCallInput,
  type ProviderRoutineCallSuccess,
  type ProviderRoutineClassification,
  type ProviderRoutineErrorCode,
  type ProviderRoutineFindInput,
  type ProviderRoutineFindOutput,
  type ProviderRoutineFindWarning,
  type ProviderRoutineId,
  type ProviderRoutineSummary,
  parseProviderRoutineId,
  providerRoutineCallInputSchema,
  providerRoutineFindInputSchema,
  providerRoutineId,
} from "@repo/provider-routine-contract";
import { classifyRoutine } from "@repo/provider-routines";
import { log } from "@vendor/observability/log/next";

import {
  ConnectorRuntimeToolCallError,
  loadChatConnectorRuntimeTools,
} from "./runtime";

const DEFAULT_FIND_LIMIT = 10;
const LINEAR_RECONNECT_WARNING: ProviderRoutineFindWarning = {
  code: "PROVIDER_ROUTINE_RECONNECT_REQUIRED",
  message: "Reconnect Linear to enable write access.",
  provider: "linear",
  requiredScopes: ["write"],
};

export interface ChatProviderRoutineContext {
  clerkOrgId: string;
  conversationId: string;
  userId: string;
  writeMode: boolean;
}

export class ChatProviderRoutineError extends Error {
  readonly code: ProviderRoutineErrorCode;
  readonly providerRoutineCallId: string | undefined;
  readonly routineId: string;

  constructor(input: {
    code: ProviderRoutineErrorCode;
    message: string;
    providerRoutineCallId?: string;
    routineId: string;
  }) {
    super(input.message);
    this.name = "ChatProviderRoutineError";
    this.code = input.code;
    this.providerRoutineCallId = input.providerRoutineCallId;
    this.routineId = input.routineId;
  }
}

export async function findChatProviderRoutines(
  context: ChatProviderRoutineContext,
  input: ProviderRoutineFindInput
): Promise<ProviderRoutineFindOutput> {
  const parsed = providerRoutineFindInputSchema.parse(input);
  const connections = await listCurrentOrgConnectorConnections(appDb, {
    clerkOrgId: context.clerkOrgId,
  });
  const enabledConnections = connections.filter(isActiveAgentConnection);
  const warnings = reconnectWarnings(enabledConnections, context);

  if (enabledConnections.length === 0) {
    return withWarnings(
      { reason: "no_enabled_providers", routines: [] },
      warnings
    );
  }

  const routines = enabledConnections
    .flatMap((connection) =>
      connection.toolManifest.flatMap((tool) =>
        summarizeTool({
          connection,
          includeSchema: parsed.includeSchema === true,
          tool,
        })
      )
    )
    .filter((routine) => isVisibleInChat(routine, enabledConnections, context))
    .filter((routine) => matchesFindFilters(routine, parsed))
    .slice(0, parsed.limit ?? DEFAULT_FIND_LIMIT);

  log.info("[workspace-assistant] provider routine discovery completed", {
    clerkOrgId: context.clerkOrgId,
    conversationId: context.conversationId,
    routineCount: routines.length,
    sourceSurface: "chat",
    warningCodes: warnings.map((warning) => warning.code),
    writeMode: context.writeMode,
  });

  if (routines.length === 0) {
    return withWarnings(
      { reason: "no_matching_routines", routines: [] },
      warnings
    );
  }

  return withWarnings({ routines }, warnings);
}

export async function callChatProviderRoutine(
  context: ChatProviderRoutineContext,
  input: ProviderRoutineCallInput
): Promise<ProviderRoutineCallSuccess> {
  const parsed = providerRoutineCallInputSchema.parse(input);
  const { provider, providerToolName } = parseProviderRoutineId(
    parsed.routineId
  );
  const connection = await getCurrentOrgConnectorConnection(appDb, {
    clerkOrgId: context.clerkOrgId,
    provider,
  });

  if (!connection) {
    throw chatProviderRoutineError({
      code: "PROVIDER_ROUTINE_CONNECTION_REQUIRED",
      message: `${provider} connector is not connected.`,
      routineId: parsed.routineId,
    });
  }
  if (!isActiveAgentConnection(connection)) {
    throw chatProviderRoutineError({
      code: "PROVIDER_ROUTINE_NOT_ENABLED",
      message: `${provider} connector is not enabled for agents.`,
      routineId: parsed.routineId,
    });
  }

  const tool = connection.toolManifest.find(
    (manifestTool) => manifestTool.name === providerToolName
  );
  if (!tool) {
    throw chatProviderRoutineError({
      code: "PROVIDER_ROUTINE_NOT_FOUND",
      message: `Provider routine ${parsed.routineId} was not found.`,
      routineId: parsed.routineId,
    });
  }

  const classification = classifyRoutine({ provider, providerToolName });
  const decision = chatRoutineDecision({
    classification,
    connection,
    context,
    provider,
  });

  if (!decision.allowed) {
    log.warn("[workspace-assistant] provider routine call denied", {
      classification,
      clerkOrgId: context.clerkOrgId,
      conversationId: context.conversationId,
      denialReason: decision.denialReason,
      provider,
      providerToolName,
      requiredScopes: decision.requiredScopes,
      routineId: parsed.routineId,
      scopeDecision: decision.scopeDecision,
      sourceSurface: "chat",
      storedScopes: storedScopeSummary(connection),
      writeMode: context.writeMode,
    });
    throw chatProviderRoutineError({
      code: decision.code,
      message: decision.message,
      routineId: parsed.routineId,
    });
  }

  if (!validateJsonSchema(tool.inputSchema, parsed.input)) {
    throw chatProviderRoutineError({
      code: "PROVIDER_ROUTINE_INVALID_INPUT",
      message: `Invalid input for provider routine ${parsed.routineId}.`,
      routineId: parsed.routineId,
    });
  }

  const runtimeTools = await loadChatConnectorRuntimeTools({
    calledByUserId: context.userId,
    clerkOrgId: context.clerkOrgId,
    conversationId: context.conversationId,
  });
  const runtimeTool = runtimeTools.find(
    (candidate) =>
      candidate.provider === provider &&
      candidate.providerToolName === providerToolName
  );

  if (!runtimeTool) {
    throw chatProviderRoutineError({
      code: "PROVIDER_ROUTINE_NOT_FOUND",
      message: `Provider routine ${parsed.routineId} was not found.`,
      routineId: parsed.routineId,
    });
  }

  try {
    const result = await runtimeTool.callWithMetadata(parsed.input);
    if (!result.providerRoutineCallId) {
      throw chatProviderRoutineError({
        code: "PROVIDER_ROUTINE_PROVIDER_FAILED",
        message: publicMessageFor("PROVIDER_ROUTINE_PROVIDER_FAILED"),
        routineId: parsed.routineId,
      });
    }

    log.info("[workspace-assistant] provider routine call completed", {
      classification,
      clerkOrgId: context.clerkOrgId,
      conversationId: context.conversationId,
      provider,
      providerRoutineCallId: result.providerRoutineCallId,
      providerToolName,
      routineId: parsed.routineId,
      scopeDecision: decision.scopeDecision,
      sourceSurface: "chat",
      writeMode: context.writeMode,
    });
    return {
      provider,
      providerRoutineCallId: result.providerRoutineCallId,
      providerToolName,
      result: result.result,
      routineId: parsed.routineId,
      status: "succeeded",
    };
  } catch (error) {
    if (error instanceof ChatProviderRoutineError) {
      throw error;
    }
    if (error instanceof ConnectorRuntimeToolCallError) {
      const code = mapRuntimeErrorCode(error.code);
      throw chatProviderRoutineError({
        code,
        message: publicMessageFor(code),
        providerRoutineCallId: error.providerRoutineCallId ?? undefined,
        routineId: parsed.routineId,
      });
    }
    throw error;
  }
}

function chatProviderRoutineError(input: {
  code: ProviderRoutineErrorCode;
  message: string;
  providerRoutineCallId?: string;
  routineId: ProviderRoutineId | string;
}) {
  return new ChatProviderRoutineError({
    code: input.code,
    message: input.message,
    providerRoutineCallId: input.providerRoutineCallId,
    routineId: input.routineId,
  });
}

function isActiveAgentConnection(connection: OrgConnectorConnection) {
  return connection.status === "active" && connection.enabledForAgents;
}

function hasLinearWriteScope(connection: OrgConnectorConnection) {
  return connection.scopes.includes("write");
}

function isWriteClassification(
  classification: ProviderRoutineClassification
) {
  return classification !== "read";
}

function reconnectWarnings(
  connections: OrgConnectorConnection[],
  context: ChatProviderRoutineContext
): ProviderRoutineFindWarning[] {
  if (!context.writeMode) {
    return [];
  }
  const linearConnection = connections.find(
    (connection) => connection.provider === "linear"
  );
  if (!linearConnection || hasLinearWriteScope(linearConnection)) {
    return [];
  }
  const hasWriteRoutine = linearConnection.toolManifest.some((tool) =>
    isWriteClassification(
      classifyRoutine({ provider: "linear", providerToolName: tool.name })
    )
  );
  return hasWriteRoutine ? [LINEAR_RECONNECT_WARNING] : [];
}

function withWarnings(
  output: ProviderRoutineFindOutput,
  warnings: ProviderRoutineFindWarning[]
): ProviderRoutineFindOutput {
  return warnings.length > 0 ? { ...output, warnings } : output;
}

function summarizeTool(input: {
  connection: OrgConnectorConnection;
  includeSchema: boolean;
  tool: FullConnectorToolManifestItem;
}): ProviderRoutineSummary[] {
  try {
    const routineId = providerRoutineId(
      input.connection.provider,
      input.tool.name
    );
    const classification = classifyRoutine({
      provider: input.connection.provider,
      providerToolName: input.tool.name,
    });
    return [
      {
        classification,
        ...(input.tool.description
          ? { description: input.tool.description }
          : {}),
        ...(input.includeSchema && input.tool.inputSchema !== undefined
          ? { inputSchema: input.tool.inputSchema }
          : {}),
        ...(input.tool.inputSchema === undefined
          ? {}
          : { inputSummary: summarizeInputSchema(input.tool.inputSchema) }),
        provider: input.connection.provider,
        providerToolName: input.tool.name,
        routineId,
        title: titleFromToolName(input.tool.name),
      },
    ];
  } catch {
    return [];
  }
}

function isVisibleInChat(
  routine: ProviderRoutineSummary,
  connections: OrgConnectorConnection[],
  context: ChatProviderRoutineContext
) {
  const connection = connections.find(
    (candidate) => candidate.provider === routine.provider
  );
  if (!connection) {
    return false;
  }
  if (routine.provider === "x") {
    return routine.classification === "read";
  }
  if (routine.provider === "linear") {
    if (routine.classification === "read") {
      return true;
    }
    return context.writeMode && hasLinearWriteScope(connection);
  }
  return false;
}

function matchesFindFilters(
  routine: ProviderRoutineSummary,
  input: ReturnType<typeof providerRoutineFindInputSchema.parse>
) {
  if (input.provider && routine.provider !== input.provider) {
    return false;
  }
  if (input.routineId && routine.routineId !== input.routineId) {
    return false;
  }
  if (input.readOnly && routine.classification !== "read") {
    return false;
  }
  if (!input.query) {
    return true;
  }

  const query = input.query.toLowerCase();
  return [
    routine.description,
    routine.provider,
    routine.providerToolName,
    routine.routineId,
    routine.title,
  ]
    .filter((value): value is string => typeof value === "string")
    .some((value) => value.toLowerCase().includes(query));
}

function chatRoutineDecision(input: {
  classification: ProviderRoutineClassification;
  connection: OrgConnectorConnection;
  context: ChatProviderRoutineContext;
  provider: ConnectableConnectorProvider;
}):
  | { allowed: true; scopeDecision: string }
  | {
      allowed: false;
      code: ProviderRoutineErrorCode;
      denialReason: string;
      message: string;
      requiredScopes?: string[];
      scopeDecision: string;
    } {
  if (input.provider === "x") {
    if (input.classification === "read") {
      return { allowed: true, scopeDecision: "x_read_allowed" };
    }
    return {
      allowed: false,
      code: "PROVIDER_ROUTINE_INSUFFICIENT_SCOPE",
      denialReason: "x_write_unsupported",
      message: "X write routines are not available in chat.",
      scopeDecision: "x_write_blocked",
    };
  }

  if (
    input.provider === "linear" &&
    isWriteClassification(input.classification)
  ) {
    if (!input.context.writeMode) {
      return {
        allowed: false,
        code: "PROVIDER_ROUTINE_INSUFFICIENT_SCOPE",
        denialReason: "write_mode_disabled",
        message: "Enable write mode before calling Linear write routines.",
        scopeDecision: "write_mode_disabled",
      };
    }
    if (!hasLinearWriteScope(input.connection)) {
      return {
        allowed: false,
        code: "PROVIDER_ROUTINE_RECONNECT_REQUIRED",
        denialReason: "linear_write_scope_missing",
        message: "Reconnect Linear to enable write access.",
        requiredScopes: ["write"],
        scopeDecision: "linear_write_scope_missing",
      };
    }
    return { allowed: true, scopeDecision: "linear_write_scope_present" };
  }

  return { allowed: true, scopeDecision: "read_allowed" };
}

function titleFromToolName(providerToolName: string) {
  return providerToolName
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[_\s.-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function summarizeInputSchema(inputSchema: unknown) {
  if (!inputSchema || typeof inputSchema !== "object") {
    return "JSON object";
  }
  const schema = inputSchema as { required?: unknown };
  const required = Array.isArray(schema.required)
    ? schema.required.filter(
        (value): value is string => typeof value === "string"
      )
    : [];
  return required.length > 0
    ? `Required: ${required.join(", ")}`
    : "JSON object";
}

function storedScopeSummary(connection: OrgConnectorConnection) {
  if (connection.provider === "linear") {
    return {
      read: connection.scopes.includes("read"),
      write: connection.scopes.includes("write"),
    };
  }
  return {
    read: connection.scopes.some((scope) => scope.endsWith(".read")),
    write: false,
  };
}

function validateJsonSchema(schema: unknown, value: unknown): boolean {
  if (!isJsonSchemaObject(schema)) {
    return true;
  }

  if (schema.type !== undefined && !matchesJsonSchemaType(value, schema.type)) {
    return false;
  }

  if (!matchesNumericBounds(value, schema)) {
    return false;
  }

  if (Array.isArray(value) && schema.items !== undefined) {
    return value.every((item) => validateJsonSchema(schema.items, item));
  }

  if (!hasObjectValidation(schema)) {
    return true;
  }

  if (!isJsonObject(value)) {
    return false;
  }

  for (const field of requiredFields(schema.required)) {
    if (!(field in value)) {
      return false;
    }
  }

  if (!isJsonObject(schema.properties)) {
    return true;
  }

  for (const [field, propertySchema] of Object.entries(schema.properties)) {
    if (!(field in value)) {
      continue;
    }
    if (!validateJsonSchema(propertySchema, value[field])) {
      return false;
    }
  }

  return true;
}

function isJsonSchemaObject(value: unknown): value is {
  items?: unknown;
  maximum?: unknown;
  minimum?: unknown;
  properties?: unknown;
  required?: unknown;
  type?: unknown;
} {
  return isJsonObject(value);
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasObjectValidation(schema: {
  properties?: unknown;
  required?: unknown;
}) {
  return schema.properties !== undefined || schema.required !== undefined;
}

function requiredFields(required: unknown) {
  return Array.isArray(required)
    ? required.filter((value): value is string => typeof value === "string")
    : [];
}

function matchesJsonSchemaType(value: unknown, type: unknown) {
  const allowedTypes = Array.isArray(type) ? type : [type];
  return allowedTypes.some((allowedType) => {
    switch (allowedType) {
      case "array":
        return Array.isArray(value);
      case "boolean":
        return typeof value === "boolean";
      case "integer":
        return Number.isInteger(value);
      case "number":
        return typeof value === "number" && Number.isFinite(value);
      case "object":
        return (
          value !== null && typeof value === "object" && !Array.isArray(value)
        );
      case "string":
        return typeof value === "string";
      case "null":
        return value === null;
      default:
        return true;
    }
  });
}

function matchesNumericBounds(
  value: unknown,
  schema: { maximum?: unknown; minimum?: unknown }
) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return true;
  }
  if (typeof schema.minimum === "number" && value < schema.minimum) {
    return false;
  }
  if (typeof schema.maximum === "number" && value > schema.maximum) {
    return false;
  }
  return true;
}

function mapRuntimeErrorCode(
  code: string | undefined
): ProviderRoutineErrorCode {
  switch (code) {
    case "LINEAR_TOKEN_REFRESH_FAILED":
    case "X_TOKEN_REFRESH_FAILED":
      return "PROVIDER_ROUTINE_AUTH_REQUIRED";
    case "LINEAR_MCP_TIMEOUT":
    case "X_MCP_TIMEOUT":
      return "PROVIDER_ROUTINE_TIMEOUT";
    default:
      return "PROVIDER_ROUTINE_PROVIDER_FAILED";
  }
}

function publicMessageFor(code: ProviderRoutineErrorCode) {
  switch (code) {
    case "PROVIDER_ROUTINE_AUTH_REQUIRED":
      return "Provider authorization is required.";
    case "PROVIDER_ROUTINE_TIMEOUT":
      return "Provider routine timed out.";
    case "PROVIDER_ROUTINE_RECONNECT_REQUIRED":
      return "Reconnect Linear to enable write access.";
    default:
      return "Provider routine failed.";
  }
}
