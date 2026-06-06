import type { ConnectableConnectorProvider } from "@repo/connector-contract";
import {
  parseProviderRoutineId,
  providerRoutineCallInputSchema,
  type ProviderRoutineCallFailure,
  type ProviderRoutineCallInput,
  type ProviderRoutineCallSuccess,
  type ProviderRoutineErrorCode,
  providerRoutineFindInputSchema,
  type ProviderRoutineFindInput,
  type ProviderRoutineFindOutput,
  providerRoutineId,
  type ProviderRoutineSummary,
} from "@repo/provider-routine-contract";
import { classifyRoutine, hasRoutineScope } from "@repo/provider-routines";
import {
  ConnectorRuntimeToolCallError,
  loadConnectorRuntimeTools,
  type ConnectorRuntimeToolSource,
} from "../connectors/runtime";

const DEFAULT_FIND_LIMIT = 10;

export interface AutomationProviderRoutineContext {
  automationPublicId: string;
  calledByUserId: string | null;
  clerkOrgId: string;
  runPublicId: string;
  selectedProvider: ConnectableConnectorProvider;
}

const AUTOMATION_SCOPES = {
  providerRoutineRead: true,
  providerRoutineWrite: true,
};

export class AutomationProviderRoutineError extends Error {
  readonly code: ProviderRoutineErrorCode;
  readonly routineId: string;

  constructor(input: {
    code: ProviderRoutineErrorCode;
    message: string;
    routineId: string;
  }) {
    super(input.message);
    this.name = "AutomationProviderRoutineError";
    this.code = input.code;
    this.routineId = input.routineId;
  }
}

export async function findAutomationProviderRoutines(
  context: AutomationProviderRoutineContext,
  input: ProviderRoutineFindInput
): Promise<ProviderRoutineFindOutput> {
  const parsed = providerRoutineFindInputSchema.parse({
    ...input,
    provider: context.selectedProvider,
  });
  const tools = await loadAutomationRuntimeTools(context);
  const selectedTools = tools.filter(
    (tool) => tool.provider === context.selectedProvider
  );

  if (selectedTools.length === 0) {
    return { reason: "no_enabled_providers", routines: [] };
  }

  const routines = selectedTools
    .flatMap((tool) => summarizeRuntimeTool(tool, parsed.includeSchema === true))
    .filter((routine) => matchesFindFilters(routine, parsed))
    .slice(0, parsed.limit ?? DEFAULT_FIND_LIMIT);

  if (routines.length === 0) {
    return { reason: "no_matching_routines", routines: [] };
  }

  return { routines };
}

export async function callAutomationProviderRoutine(
  context: AutomationProviderRoutineContext,
  input: ProviderRoutineCallInput
): Promise<ProviderRoutineCallSuccess | ProviderRoutineCallFailure> {
  const parsed = providerRoutineCallInputSchema.parse(input);
  const { provider, providerToolName } = parseProviderRoutineId(
    parsed.routineId
  );

  if (provider !== context.selectedProvider) {
    throw new AutomationProviderRoutineError({
      code: "PROVIDER_ROUTINE_NOT_ENABLED",
      message: `${provider} routines are not enabled for this automation.`,
      routineId: parsed.routineId,
    });
  }

  const tools = await loadAutomationRuntimeTools(context);
  const tool = tools.find(
    (candidate) =>
      candidate.provider === provider &&
      candidate.providerToolName === providerToolName
  );

  if (!tool) {
    throw new AutomationProviderRoutineError({
      code: "PROVIDER_ROUTINE_NOT_FOUND",
      message: `Provider routine ${parsed.routineId} was not found.`,
      routineId: parsed.routineId,
    });
  }

  const classification = classifyRoutine({ provider, providerToolName });
  if (!hasRoutineScope({ classification, scopes: AUTOMATION_SCOPES })) {
    throw new AutomationProviderRoutineError({
      code: "PROVIDER_ROUTINE_INSUFFICIENT_SCOPE",
      message: `Provider routine ${parsed.routineId} requires additional scope.`,
      routineId: parsed.routineId,
    });
  }

  if (!isValidToolInput(tool.inputSchema, parsed.input)) {
    throw new AutomationProviderRoutineError({
      code: "PROVIDER_ROUTINE_INVALID_INPUT",
      message: `Invalid input for provider routine ${parsed.routineId}.`,
      routineId: parsed.routineId,
    });
  }

  try {
    const result = await tool.callWithMetadata(parsed.input);
    if (!result.providerRoutineCallId) {
      throw new AutomationProviderRoutineError({
        code: "PROVIDER_ROUTINE_PROVIDER_FAILED",
        message: publicMessageFor("PROVIDER_ROUTINE_PROVIDER_FAILED"),
        routineId: parsed.routineId,
      });
    }
    return {
      provider,
      providerRoutineCallId: result.providerRoutineCallId,
      providerToolName,
      result: result.result,
      routineId: parsed.routineId,
      status: "succeeded",
    };
  } catch (error) {
    if (
      error instanceof ConnectorRuntimeToolCallError &&
      error.providerRoutineCallId
    ) {
      const code = mapRuntimeErrorCode(error.code);
      return {
        error: {
          code,
          message: publicMessageFor(code),
        },
        providerRoutineCallId: error.providerRoutineCallId,
        routineId: parsed.routineId,
        status: "failed",
      };
    }
    throw error;
  }
}

async function loadAutomationRuntimeTools(
  context: AutomationProviderRoutineContext
) {
  return await loadConnectorRuntimeTools({
    automationPublicId: context.automationPublicId,
    calledByUserId: context.calledByUserId,
    clerkOrgId: context.clerkOrgId,
    runPublicId: context.runPublicId,
  });
}

function summarizeRuntimeTool(
  tool: ConnectorRuntimeToolSource,
  includeSchema: boolean
): ProviderRoutineSummary[] {
  try {
    const routineId = providerRoutineId(tool.provider, tool.providerToolName);
    const classification = classifyRoutine({
      provider: tool.provider,
      providerToolName: tool.providerToolName,
    });
    return [
      {
        classification,
        ...(tool.description ? { description: tool.description } : {}),
        ...(includeSchema && tool.inputSchema !== undefined
          ? { inputSchema: tool.inputSchema }
          : {}),
        ...(tool.inputSchema === undefined
          ? {}
          : { inputSummary: summarizeInputSchema(tool.inputSchema) }),
        provider: tool.provider,
        providerToolName: tool.providerToolName,
        routineId,
        title: titleFromToolName(tool.providerToolName),
      },
    ];
  } catch {
    return [];
  }
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
  if (
    !hasRoutineScope({
      classification: routine.classification,
      scopes: AUTOMATION_SCOPES,
    })
  ) {
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
  const schema = inputSchema as { required?: unknown; properties?: unknown };
  const required = Array.isArray(schema.required)
    ? schema.required.filter(
        (value): value is string => typeof value === "string"
      )
    : [];
  return required.length > 0
    ? `Required: ${required.join(", ")}`
    : "JSON object";
}

function isValidToolInput(
  inputSchema: unknown,
  input: Record<string, unknown>
) {
  return validateJsonSchema(inputSchema, input);
}

function validateJsonSchema(schema: unknown, value: unknown): boolean {
  if (!isJsonSchemaObject(schema)) {
    return true;
  }

  if (
    schema.type !== undefined &&
    !matchesJsonSchemaType(value, schema.type)
  ) {
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

function mapRuntimeErrorCode(code: string | undefined): ProviderRoutineErrorCode {
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
    default:
      return "Provider routine failed.";
  }
}
