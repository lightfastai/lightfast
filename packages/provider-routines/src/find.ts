import {
  listCurrentOrgConnectorConnections,
  type OrgConnectorConnection,
} from "@db/app";
import type { FullConnectorToolManifestItem } from "@repo/connector-contract";
import {
  type ProviderRoutineFindInput,
  type ProviderRoutineFindOutput,
  type ProviderRoutineSummary,
  providerRoutineFindInputSchema,
  providerRoutineId,
} from "@repo/provider-routine-contract";
import type {
  ConnectorProviderRoutineTool,
  ProviderRoutineServiceContext,
} from "./context";
import { classifyRoutine, hasRoutineScope } from "./policy";

const DEFAULT_FIND_LIMIT = 10;

export async function findProviderRoutines(
  context: ProviderRoutineServiceContext,
  input: ProviderRoutineFindInput
): Promise<ProviderRoutineFindOutput> {
  const parsed = providerRoutineFindInputSchema.parse(input);
  if (context.adapters?.connectors) {
    const tools = await context.adapters.connectors.loadTools();
    if (tools.length === 0) {
      return { reason: "no_enabled_providers", routines: [] };
    }

    const routines = tools
      .flatMap((tool) =>
        summarizeConnectorTool({
          includeSchema: parsed.includeSchema === true,
          tool,
        })
      )
      .filter((routine) => matchesFilters(routine, parsed, context))
      .slice(0, parsed.limit ?? DEFAULT_FIND_LIMIT);

    if (routines.length === 0) {
      return { reason: "no_matching_routines", routines: [] };
    }

    return { routines };
  }

  const connections = await listCurrentOrgConnectorConnections(context.db, {
    clerkOrgId: context.actor.orgId,
  });
  const enabledConnections = connections.filter(isAgentEnabledConnection);

  if (enabledConnections.length === 0) {
    return { reason: "no_enabled_providers", routines: [] };
  }

  const routines = enabledConnections
    .flatMap((connection) =>
      connection.toolManifest.flatMap((tool) =>
        summarizeTool({
          includeSchema: parsed.includeSchema === true,
          provider: connection.provider,
          tool,
        })
      )
    )
    .filter((routine) => matchesFilters(routine, parsed, context))
    .slice(0, parsed.limit ?? DEFAULT_FIND_LIMIT);

  if (routines.length === 0) {
    return { reason: "no_matching_routines", routines: [] };
  }

  return { routines };
}

function isAgentEnabledConnection(connection: OrgConnectorConnection) {
  return (
    connection.provider === "linear" &&
    connection.status === "active" &&
    connection.enabledForAgents
  );
}

function summarizeTool(input: {
  includeSchema: boolean;
  provider: import("@repo/connector-contract").ConnectableConnectorProvider;
  tool: FullConnectorToolManifestItem;
}): ProviderRoutineSummary[] {
  const routineId = safeRoutineId(input.provider, input.tool.name);
  if (!routineId) {
    return [];
  }

  const classification = classifyRoutine({
    provider: input.provider,
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
      provider: input.provider,
      providerToolName: input.tool.name,
      routineId,
      title: titleFromToolName(input.tool.name),
    },
  ];
}

function summarizeConnectorTool(input: {
  includeSchema: boolean;
  tool: ConnectorProviderRoutineTool;
}): ProviderRoutineSummary[] {
  return summarizeTool({
    includeSchema: input.includeSchema,
    provider: input.tool.provider,
    tool: {
      ...(input.tool.description
        ? { description: input.tool.description }
        : {}),
      ...(input.tool.inputSchema === undefined
        ? {}
        : { inputSchema: input.tool.inputSchema }),
      name: input.tool.providerToolName,
    },
  });
}

function matchesFilters(
  routine: ProviderRoutineSummary,
  input: ReturnType<typeof providerRoutineFindInputSchema.parse>,
  context: ProviderRoutineServiceContext
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
      scopes: context.scopes,
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

function safeRoutineId(
  provider: import("@repo/connector-contract").ConnectableConnectorProvider,
  providerToolName: string
) {
  try {
    return providerRoutineId(provider, providerToolName);
  } catch {
    return null;
  }
}

function titleFromToolName(providerToolName: string) {
  return providerToolName
    .split(/[_-]+/)
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
  if (required.length > 0) {
    return `Required: ${required.join(", ")}`;
  }
  return "JSON object";
}
