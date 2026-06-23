import type { Database } from "@db/app";
import {
  type ConnectableConnectorProvider,
  type ProviderRoutineCallInput,
  type ProviderRoutineCallSuccess,
  type ProviderRoutineFindInput,
  type ProviderRoutineFindOutput,
  type ProviderRoutineScopeContext,
  type ProviderRoutineSourceSurface,
  providerRoutineCallInputSchema,
  providerRoutineCallSuccessSchema,
  providerRoutineFindInputSchema,
  providerRoutineFindOutputSchema,
  providerRoutineScopeContextSchema,
} from "@repo/api-contract";
import { z } from "zod";
import type { ExecutionContext } from "../actor";
import { type CommandRunArgs, defineCommand } from "../command";
import { AuthzError } from "../errors";

const providerRoutineFindCommandInput = z
  .object({
    input: providerRoutineFindInputSchema,
    scopes: providerRoutineScopeContextSchema.optional(),
  })
  .strict();

const providerRoutineCallCommandInput = z
  .object({
    input: providerRoutineCallInputSchema,
    scopes: providerRoutineScopeContextSchema.optional(),
  })
  .strict();

export interface ProviderRoutineCommandServiceLog {
  error(message: string, metadata?: Record<string, unknown>): void;
  info(message: string, metadata?: Record<string, unknown>): void;
  warn(message: string, metadata?: Record<string, unknown>): void;
}

export interface ProviderRoutineCommandConnectorTool {
  callWithMetadata(input: unknown): Promise<{
    provider: ConnectableConnectorProvider;
    providerRoutineCallId: string | null;
    providerToolName: string;
    result: unknown;
    routineId: string;
    runtimeToolName: string;
  }>;
  description?: string;
  inputSchema?: unknown;
  provider: ConnectableConnectorProvider;
  providerToolName: string;
  runtimeToolName: string;
}

export interface ProviderRoutineCommandServiceContext {
  actor: {
    orgId: string;
    userId: string;
  };
  adapters: {
    connectors: {
      loadTools(): Promise<ProviderRoutineCommandConnectorTool[]>;
    };
  };
  db: Database;
  log: ProviderRoutineCommandServiceLog;
  now: () => Date;
  scopes: ProviderRoutineScopeContext;
  source: {
    clientId?: string | null;
    ref?: string | null;
    surface: ProviderRoutineSourceSurface;
  };
}

export interface ProviderRoutineCommandDeps {
  callProviderRoutine: (
    context: ProviderRoutineCommandServiceContext,
    input: ProviderRoutineCallInput
  ) => Promise<ProviderRoutineCallSuccess>;
  db: Database;
  findProviderRoutines: (
    context: ProviderRoutineCommandServiceContext,
    input: ProviderRoutineFindInput
  ) => Promise<ProviderRoutineFindOutput>;
  loadConnectorRuntimeTools: (input: {
    calledByUserId: string;
    clerkOrgId: string;
    sourceClientId?: string | null;
    sourceRef?: string | null;
    sourceSurface: "hosted_mcp" | "native_cli";
  }) => Promise<ProviderRoutineCommandConnectorTool[]>;
  log: ProviderRoutineCommandServiceLog;
  now: () => Date;
}

type ProviderRoutineCommandRunArgs<TInput, TOutput> = CommandRunArgs<
  TInput,
  TOutput,
  ProviderRoutineCommandDeps
>;

interface ProviderRoutineCommandAuthority
  extends Pick<ProviderRoutineCommandServiceContext, "actor" | "scopes"> {
  source: ProviderRoutineCommandServiceContext["source"] & {
    surface: "hosted_mcp" | "native_cli";
  };
}

export const providerRoutineFindCommand = defineCommand({
  name: "providerRoutines.find",
  input: providerRoutineFindCommandInput,
  output: providerRoutineFindOutputSchema,
  run: async ({
    ctx,
    deps,
    input,
  }: ProviderRoutineCommandRunArgs<
    z.infer<typeof providerRoutineFindCommandInput>,
    ProviderRoutineFindOutput
  >) =>
    await deps.findProviderRoutines(
      providerRoutineServiceContext({
        ctx,
        deps,
        scopes: input.scopes,
      }),
      input.input
    ),
});

export const providerRoutineCallCommand = defineCommand({
  name: "providerRoutines.call",
  input: providerRoutineCallCommandInput,
  output: providerRoutineCallSuccessSchema,
  run: async ({
    ctx,
    deps,
    input,
  }: ProviderRoutineCommandRunArgs<
    z.infer<typeof providerRoutineCallCommandInput>,
    ProviderRoutineCallSuccess
  >) =>
    await deps.callProviderRoutine(
      providerRoutineServiceContext({
        ctx,
        deps,
        scopes: input.scopes,
      }),
      input.input
    ),
});

function providerRoutineServiceContext(input: {
  ctx: ExecutionContext;
  deps: ProviderRoutineCommandDeps;
  scopes?: ProviderRoutineScopeContext;
}): ProviderRoutineCommandServiceContext {
  const authority = requireProviderRoutineAuthority(input.ctx, input.scopes);
  return {
    actor: authority.actor,
    adapters: {
      connectors: {
        loadTools: async () =>
          await input.deps.loadConnectorRuntimeTools({
            calledByUserId: authority.actor.userId,
            clerkOrgId: authority.actor.orgId,
            sourceClientId: authority.source.clientId,
            sourceRef: authority.source.ref,
            sourceSurface: authority.source.surface,
          }),
      },
    },
    db: input.deps.db,
    log: input.deps.log,
    now: input.deps.now,
    scopes: authority.scopes,
    source: authority.source,
  };
}

function requireProviderRoutineAuthority(
  ctx: ExecutionContext,
  scopes?: ProviderRoutineScopeContext
): ProviderRoutineCommandAuthority {
  if (ctx.actor.kind === "nativeClient") {
    if (
      ctx.actor.client !== "cli" ||
      ctx.caller?.kind !== "firstPartyClient" ||
      ctx.caller.client !== "cli" ||
      ctx.request?.source !== "cli-rpc"
    ) {
      throw new AuthzError(
        "NATIVE_CLI_AUTHORITY_REQUIRED",
        "CLI provider routine commands require native CLI authority."
      );
    }

    return {
      actor: {
        orgId: ctx.actor.orgId,
        userId: ctx.actor.userId,
      },
      scopes: {
        providerRoutineRead: true,
        providerRoutineWrite: true,
      },
      source: {
        clientId: ctx.actor.clientId,
        ref: ctx.actor.orgId,
        surface: "native_cli",
      },
    };
  }

  if (ctx.actor.kind === "mcpClient") {
    if (
      ctx.caller?.kind !== "service" ||
      ctx.caller.service !== "apps-mcp" ||
      ctx.request?.source !== "mcp"
    ) {
      throw new AuthzError(
        "MCP_SERVICE_CALLER_REQUIRED",
        "MCP provider routine commands require the apps-mcp service caller."
      );
    }

    if (!scopes) {
      throw new AuthzError(
        "PROVIDER_ROUTINE_SCOPE_CONTEXT_REQUIRED",
        "MCP provider routine commands require delegated provider routine scopes."
      );
    }

    assertMcpProviderRoutineScopes(ctx.actor.scopes, scopes);

    return {
      actor: {
        orgId: ctx.actor.orgId,
        userId: ctx.actor.userId,
      },
      scopes,
      source: {
        clientId: ctx.actor.clientId,
        ref: ctx.actor.grantId,
        surface: "hosted_mcp",
      },
    };
  }

  throw new AuthzError(
    "PROVIDER_ROUTINE_ACTOR_REQUIRED",
    "A native CLI client or MCP client is required for provider routines."
  );
}

function assertMcpProviderRoutineScopes(
  actorScopes: readonly string[],
  requestedScopes: ProviderRoutineScopeContext
): void {
  const missingScope =
    (requestedScopes.providerRoutineRead &&
      !actorScopes.includes("mcp:provider_routines:read") &&
      !actorScopes.includes("mcp:provider_routines:write") &&
      "mcp:provider_routines:read") ||
    (requestedScopes.providerRoutineWrite &&
      !actorScopes.includes("mcp:provider_routines:write") &&
      "mcp:provider_routines:write");

  if (!missingScope) {
    return;
  }

  throw new AuthzError(
    "MCP_PROVIDER_ROUTINE_SCOPE_REQUIRED",
    `MCP token requires the ${missingScope} scope.`,
    { requiredScope: missingScope }
  );
}
