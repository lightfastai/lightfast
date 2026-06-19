import {
  createProviderRoutineCall,
  getCurrentOrgConnectorConnection,
  markCurrentOrgConnectorConnectionError,
  markProviderRoutineCallFailed,
  markProviderRoutineCallProviderAttempted,
  markProviderRoutineCallSucceeded,
  type OrgConnectorConnection,
  type ProviderRoutineCallRedactedPayload,
} from "@db/app";
import type { FullConnectorToolManifestItem } from "@lightfast/connector-core";
import {
  type ProviderRoutineCallInput,
  type ProviderRoutineCallSuccess,
  type ProviderRoutineErrorCode,
  type ProviderRoutineId,
  parseProviderRoutineId,
  providerRoutineCallInputSchema,
} from "@repo/api-contract";
import type {
  ConnectorProviderRoutineTool,
  LinearProviderRoutineAdapter,
  ProviderRoutineServiceContext,
} from "./context";
import { ProviderRoutineError, providerRoutineError } from "./errors";
import { defaultLinearProviderRoutineAdapter } from "./linear";
import { classifyRoutine, hasRoutineScope } from "./policy";

export async function callProviderRoutine(
  context: ProviderRoutineServiceContext,
  input: ProviderRoutineCallInput
): Promise<ProviderRoutineCallSuccess> {
  const parsed = providerRoutineCallInputSchema.parse(input);
  const { provider, providerToolName } = parseProviderRoutineId(
    parsed.routineId
  );

  if (context.adapters?.connectors) {
    return await callConnectorAdapterProviderRoutine(context, parsed);
  }

  const connection = await getCurrentOrgConnectorConnection(context.db, {
    clerkOrgId: context.actor.orgId,
    provider,
  });

  if (!connection) {
    throw providerRoutineError({
      code: "PROVIDER_ROUTINE_CONNECTION_REQUIRED",
      message: `${provider} connector is not connected.`,
      routineId: parsed.routineId,
    });
  }
  if (!isAgentEnabledConnection(connection)) {
    throw providerRoutineError({
      code: "PROVIDER_ROUTINE_NOT_ENABLED",
      message: `${provider} connector is not enabled for agents.`,
      routineId: parsed.routineId,
    });
  }

  const tool = connection.toolManifest.find(
    (manifestTool) => manifestTool.name === providerToolName
  );
  if (!tool) {
    throw providerRoutineError({
      code: "PROVIDER_ROUTINE_NOT_FOUND",
      message: `Provider routine ${parsed.routineId} was not found.`,
      routineId: parsed.routineId,
    });
  }

  const classification = classifyRoutine({ provider, providerToolName });
  if (!hasRoutineScope({ classification, scopes: context.scopes })) {
    throw providerRoutineError({
      code: "PROVIDER_ROUTINE_INSUFFICIENT_SCOPE",
      message: `Provider routine ${parsed.routineId} requires additional scope.`,
      routineId: parsed.routineId,
    });
  }

  if (!isValidToolInput(tool, parsed.input)) {
    throw providerRoutineError({
      code: "PROVIDER_ROUTINE_INVALID_INPUT",
      message: `Invalid input for provider routine ${parsed.routineId}.`,
      routineId: parsed.routineId,
    });
  }

  const providerRoutineCall = await createProviderRoutineCall(context.db, {
    calledById: context.actor.userId,
    calledByKind: "user",
    calledByUserId: context.actor.userId,
    clerkOrgId: context.actor.orgId,
    inputRedacted: redactedPresence(parsed.input),
    provider,
    providerActorId: connection.providerActorId,
    providerConnectionId: connection.id,
    providerToolName,
    providerWorkspaceId: connection.providerWorkspaceId,
    routineId: parsed.routineId,
    sourceClientId: context.source.clientId ?? null,
    sourceRef: context.source.ref ?? null,
    sourceSurface: context.source.surface,
    startedAt: context.now(),
  });

  const adapter = linearAdapter(context);
  let accessToken: string;
  try {
    accessToken = await adapter.getAccessToken({
      connection,
      db: context.db,
      log: context.log,
      now: context.now,
    });
  } catch (error) {
    const mapped = mapProviderError(error, {
      providerRoutineCallId: providerRoutineCall.publicId,
      routineId: parsed.routineId,
    });
    await markProviderRoutineCallFailed(context.db, {
      clerkOrgId: context.actor.orgId,
      errorCode: mapped.code,
      errorMessage: mapped.publicMessage,
      finishedAt: context.now(),
      publicId: providerRoutineCall.publicId,
    });
    if (mapped.code === "PROVIDER_ROUTINE_AUTH_REQUIRED") {
      await markCurrentOrgConnectorConnectionError(context.db, {
        clerkOrgId: context.actor.orgId,
        provider,
      });
    }
    throw mapped;
  }

  await markProviderRoutineCallProviderAttempted(context.db, {
    clerkOrgId: context.actor.orgId,
    publicId: providerRoutineCall.publicId,
  });

  let result: unknown;
  try {
    result = await adapter.callTool({
      accessToken,
      connection,
      input: parsed.input,
      providerToolName,
    });
  } catch (error) {
    const mapped = mapProviderError(error, {
      providerRoutineCallId: providerRoutineCall.publicId,
      routineId: parsed.routineId,
    });
    await markProviderRoutineCallFailed(context.db, {
      clerkOrgId: context.actor.orgId,
      errorCode: mapped.code,
      errorMessage: mapped.publicMessage,
      finishedAt: context.now(),
      publicId: providerRoutineCall.publicId,
    });
    throw mapped;
  }

  await markProviderRoutineCallSucceeded(context.db, {
    clerkOrgId: context.actor.orgId,
    finishedAt: context.now(),
    outputRedacted: redactedPresence(result),
    publicId: providerRoutineCall.publicId,
  });

  return {
    provider,
    providerRoutineCallId: providerRoutineCall.publicId,
    providerToolName,
    result,
    routineId: parsed.routineId,
    status: "succeeded",
  };
}

async function callConnectorAdapterProviderRoutine(
  context: ProviderRoutineServiceContext,
  parsed: ReturnType<typeof providerRoutineCallInputSchema.parse>
): Promise<ProviderRoutineCallSuccess> {
  const { provider, providerToolName } = parseProviderRoutineId(
    parsed.routineId
  );
  const tools = await context.adapters!.connectors!.loadTools();
  const tool = tools.find(
    (candidate) =>
      candidate.provider === provider &&
      candidate.providerToolName === providerToolName
  );

  if (!tool) {
    throw providerRoutineError({
      code: "PROVIDER_ROUTINE_NOT_FOUND",
      message: `Provider routine ${parsed.routineId} was not found.`,
      routineId: parsed.routineId,
    });
  }

  const classification = classifyRoutine({ provider, providerToolName });
  if (!hasRoutineScope({ classification, scopes: context.scopes })) {
    throw providerRoutineError({
      code: "PROVIDER_ROUTINE_INSUFFICIENT_SCOPE",
      message: `Provider routine ${parsed.routineId} requires additional scope.`,
      routineId: parsed.routineId,
    });
  }

  if (!isValidConnectorToolInput(tool, parsed.input)) {
    throw providerRoutineError({
      code: "PROVIDER_ROUTINE_INVALID_INPUT",
      message: `Invalid input for provider routine ${parsed.routineId}.`,
      routineId: parsed.routineId,
    });
  }

  let result: Awaited<
    ReturnType<ConnectorProviderRoutineTool["callWithMetadata"]>
  >;
  try {
    result = await tool.callWithMetadata(parsed.input);
  } catch (error) {
    if (error instanceof ProviderRoutineError) {
      throw error;
    }
    throw providerRoutineError({
      cause: error,
      code: "PROVIDER_ROUTINE_PROVIDER_FAILED",
      message: `Provider routine ${parsed.routineId} failed.`,
      providerRoutineCallId: providerRoutineCallIdFromError(error),
      routineId: parsed.routineId,
    });
  }

  if (!result.providerRoutineCallId) {
    throw providerRoutineError({
      code: "PROVIDER_ROUTINE_PROVIDER_FAILED",
      message: `Provider routine ${parsed.routineId} was not recorded.`,
      routineId: parsed.routineId,
    });
  }

  if (
    result.provider !== provider ||
    result.providerToolName !== providerToolName
  ) {
    throw providerRoutineError({
      code: "PROVIDER_ROUTINE_PROVIDER_FAILED",
      message: `Provider routine ${parsed.routineId} returned mismatched metadata.`,
      providerRoutineCallId: result.providerRoutineCallId,
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
}

function isAgentEnabledConnection(connection: OrgConnectorConnection) {
  return (
    connection.provider === "linear" &&
    connection.status === "active" &&
    connection.enabledForAgents
  );
}

function linearAdapter(
  context: ProviderRoutineServiceContext
): LinearProviderRoutineAdapter {
  return context.adapters?.linear ?? defaultLinearProviderRoutineAdapter;
}

function redactedPresence(value: unknown): ProviderRoutineCallRedactedPayload {
  if (value === undefined) {
    return null;
  }
  return { present: true };
}

function isValidConnectorToolInput(
  tool: ConnectorProviderRoutineTool,
  input: Record<string, unknown>
) {
  return isValidToolInput(
    {
      ...(tool.description ? { description: tool.description } : {}),
      ...(tool.inputSchema === undefined
        ? {}
        : { inputSchema: tool.inputSchema }),
      name: tool.providerToolName,
    },
    input
  );
}

function providerRoutineCallIdFromError(error: unknown) {
  if (
    error &&
    typeof error === "object" &&
    "providerRoutineCallId" in error &&
    typeof error.providerRoutineCallId === "string"
  ) {
    return error.providerRoutineCallId;
  }
  return;
}

function isValidToolInput(
  tool: FullConnectorToolManifestItem,
  input: Record<string, unknown>
) {
  const schema = tool.inputSchema;
  if (!schema || typeof schema !== "object") {
    return true;
  }
  const objectSchema = schema as {
    properties?: Record<string, { type?: unknown }>;
    required?: unknown;
    type?: unknown;
  };
  if (objectSchema.type && objectSchema.type !== "object") {
    return true;
  }

  const required = Array.isArray(objectSchema.required)
    ? objectSchema.required.filter(
        (value): value is string => typeof value === "string"
      )
    : [];
  for (const field of required) {
    if (!(field in input)) {
      return false;
    }
  }

  const properties = objectSchema.properties ?? {};
  for (const [field, propertySchema] of Object.entries(properties)) {
    if (!(field in input && propertySchema.type)) {
      continue;
    }
    if (!matchesJsonSchemaType(input[field], propertySchema.type)) {
      return false;
    }
  }
  return true;
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

function mapProviderError(
  error: unknown,
  input: { providerRoutineCallId: string; routineId: ProviderRoutineId }
) {
  if (error instanceof ProviderRoutineError) {
    return error;
  }

  const code = getErrorCode(error);
  const mappedCode: ProviderRoutineErrorCode =
    code === "LINEAR_TOKEN_REFRESH_FAILED"
      ? "PROVIDER_ROUTINE_AUTH_REQUIRED"
      : code === "LINEAR_MCP_TIMEOUT"
        ? "PROVIDER_ROUTINE_TIMEOUT"
        : "PROVIDER_ROUTINE_PROVIDER_FAILED";

  return providerRoutineError({
    cause: error,
    code: mappedCode,
    message: publicMessageFor(mappedCode),
    providerRoutineCallId: input.providerRoutineCallId,
    routineId: input.routineId,
  });
}

function getErrorCode(error: unknown) {
  return error && typeof error === "object" && "code" in error
    ? String(error.code)
    : undefined;
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
