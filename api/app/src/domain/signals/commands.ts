import {
  type CreateSignalOutput,
  createSignalInput,
  createSignalOutput,
  type McpScope,
  type SignalClassification,
  type SignalEntityLink,
  type SignalStatus,
  type SignalVisibilityScope,
  signalIdSchema,
  signalStatusSchema,
} from "@repo/api-contract";
import { z } from "zod";
import type { PublicApiKeyScope } from "../../auth/api-key";
import type { ExecutionContext } from "../actor";
import { type CommandRunArgs, defineCommand } from "../command";
import { AuthzError, InternalDomainError, NotFoundError } from "../errors";
import { requireBoundClerkOrgActor } from "../gates";

export interface SignalListCursor {
  createdAt: Date;
  id: number;
}

export interface SignalRecord {
  classification: SignalClassification | null;
  createdAt: Date;
  createdByApiKeyId: string | null;
  createdByMcpClientId?: string | null;
  createdByMcpGrantId?: string | null;
  createdByUserId: string;
  errorCode: string | null;
  errorMessage: string | null;
  id: number;
  input: string;
  publicId: string;
  status: SignalStatus;
  updatedAt: Date;
  visibilityScope: SignalVisibilityScope;
}

export interface ListProcessingSignalsResult {
  items: SignalRecord[];
  nextCursor: SignalListCursor | null;
}

export interface WorkingSetSignalRecord {
  classification: Omit<SignalClassification, "nextAction" | "rationale"> | null;
  createdAt: Date;
  createdByApiKeyId: string | null;
  createdByUserId: string;
  id: number;
  publicId: string;
  status: SignalStatus;
}

export interface ListWorkingSetSignalsResult {
  items: WorkingSetSignalRecord[];
  limit: number;
  totalCount: number;
  truncated: boolean;
  windowDays: number;
}

export type SignalDetailResult = SignalRecord & {
  entityLinks: SignalEntityLink[];
};

const workspaceListCursorInput = z
  .object({
    createdAt: z.date(),
    id: z.number().int().positive(),
  })
  .optional();

const workspaceListLimitInput = z.number().int().min(1).max(100).default(50);

export const listProcessingSignalsInput = z
  .object({
    cursor: workspaceListCursorInput,
    limit: workspaceListLimitInput,
    statuses: z.array(signalStatusSchema).max(4).optional(),
  })
  .strict();

const listWorkingSetSignalsInput = z.object({}).strict();

const getSignalInput = z
  .object({
    publicId: signalIdSchema,
  })
  .strict();

export interface SignalCreateCommandInput {
  clerkOrgId: string;
  createdByApiKeyId: string | null;
  createdByMcpClientId?: string | null;
  createdByMcpGrantId?: string | null;
  createdByUserId: string;
  input: string;
}

export interface SignalCreateCommandDeps {
  createAndQueueSignal: (
    input: SignalCreateCommandInput
  ) => Promise<CreateSignalOutput>;
  isSignalCreateQueueError: (error: unknown) => boolean;
}

export interface SignalGetCommandDeps {
  getVisibleSignalByPublicId: (input: {
    clerkOrgId: string;
    createdByUserId: string;
    publicId: string;
  }) => Promise<SignalRecord | undefined>;
  listSignalEntityLinksForSignal: (input: {
    clerkOrgId: string;
    signalId: string;
  }) => Promise<SignalEntityLink[]>;
}

export interface SignalListProcessingCommandDeps {
  listSignals: (input: {
    clerkOrgId: string;
    createdByUserId: string;
    cursor?: SignalListCursor | null;
    limit?: number;
    statuses?: SignalStatus[];
  }) => Promise<ListProcessingSignalsResult>;
}

export interface SignalListWorkingSetCommandDeps {
  listWorkspaceSignals: (input: {
    clerkOrgId: string;
    createdByUserId: string;
  }) => Promise<ListWorkingSetSignalsResult>;
}

export type SignalCommandDeps = SignalCreateCommandDeps &
  SignalGetCommandDeps &
  SignalListProcessingCommandDeps &
  SignalListWorkingSetCommandDeps;

const objectOutput = <T>() =>
  z.custom<T>((value) => typeof value === "object" && value !== null);

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Failed to queue signal for classification.";
}

type SignalCommandRunArgs<
  TInput,
  TOutput,
  TDeps extends object,
> = CommandRunArgs<TInput, TOutput, TDeps>;

type ResolvedSignalCommandAuthority = Omit<SignalCreateCommandInput, "input">;

function requireSignalCommandAuthority(
  ctx: ExecutionContext,
  input: { apiKeyScope?: PublicApiKeyScope; mcpScope?: McpScope } = {}
): ResolvedSignalCommandAuthority {
  if (ctx.actor.kind === "clerkUser") {
    const actor = requireBoundClerkOrgActor(ctx);
    return {
      clerkOrgId: actor.orgId,
      createdByApiKeyId: null,
      createdByUserId: actor.userId,
    };
  }

  if (ctx.actor.kind === "apiKey") {
    if (input.apiKeyScope && !ctx.actor.scopes.includes(input.apiKeyScope)) {
      throw new AuthzError(
        "API_KEY_SCOPE_REQUIRED",
        `API key requires the ${input.apiKeyScope} scope.`,
        { requiredScope: input.apiKeyScope }
      );
    }

    if (ctx.actor.orgGate?.bindingStatus !== "bound") {
      throw new AuthzError(
        "ORG_SETUP_REQUIRED",
        "Organization setup required. Complete setup before using Lightfast features.",
        {
          nextSetupRequirement: ctx.actor.orgGate?.nextSetupRequirement,
        }
      );
    }

    return {
      clerkOrgId: ctx.actor.orgId,
      createdByApiKeyId: ctx.actor.keyId,
      createdByUserId: ctx.actor.createdByUserId,
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
        "MCP signal commands require the apps-mcp service caller."
      );
    }

    if (input.mcpScope && !ctx.actor.scopes.includes(input.mcpScope)) {
      throw new AuthzError(
        "MCP_SCOPE_REQUIRED",
        `MCP token requires the ${input.mcpScope} scope.`,
        { requiredScope: input.mcpScope }
      );
    }

    return {
      clerkOrgId: ctx.actor.orgId,
      createdByApiKeyId: null,
      createdByMcpClientId: ctx.actor.clientId,
      createdByMcpGrantId: ctx.actor.grantId,
      createdByUserId: ctx.actor.userId,
    };
  }

  throw new AuthzError(
    "SIGNAL_ACTOR_REQUIRED",
    "A Lightfast user, API key, or MCP client is required."
  );
}

export const listProcessingSignalsCommand = defineCommand({
  name: "signals.listProcessing",
  input: listProcessingSignalsInput,
  output: objectOutput<ListProcessingSignalsResult>(),
  run: async ({
    ctx,
    deps,
    input,
  }: SignalCommandRunArgs<
    z.infer<typeof listProcessingSignalsInput>,
    ListProcessingSignalsResult,
    SignalListProcessingCommandDeps
  >) => {
    const authority = requireSignalCommandAuthority(ctx, {
      apiKeyScope: "api.signals.read",
      mcpScope: "mcp:signals:read",
    });
    return deps.listSignals({
      clerkOrgId: authority.clerkOrgId,
      createdByUserId: authority.createdByUserId,
      cursor: input.cursor,
      limit: input.limit,
      statuses: input.statuses?.length ? input.statuses : undefined,
    });
  },
});

export const listWorkingSetSignalsCommand = defineCommand({
  name: "signals.workingSet",
  input: listWorkingSetSignalsInput,
  output: objectOutput<ListWorkingSetSignalsResult>(),
  run: async ({
    ctx,
    deps,
  }: SignalCommandRunArgs<
    z.infer<typeof listWorkingSetSignalsInput>,
    ListWorkingSetSignalsResult,
    SignalListWorkingSetCommandDeps
  >) => {
    const authority = requireSignalCommandAuthority(ctx, {
      apiKeyScope: "api.signals.read",
      mcpScope: "mcp:signals:read",
    });
    return deps.listWorkspaceSignals({
      clerkOrgId: authority.clerkOrgId,
      createdByUserId: authority.createdByUserId,
    });
  },
});

export const getSignalCommand = defineCommand({
  name: "signals.get",
  input: getSignalInput,
  output: objectOutput<SignalDetailResult>(),
  run: async ({
    ctx,
    deps,
    input,
  }: SignalCommandRunArgs<
    z.infer<typeof getSignalInput>,
    SignalDetailResult,
    SignalGetCommandDeps
  >) => {
    const authority = requireSignalCommandAuthority(ctx, {
      apiKeyScope: "api.signals.read",
      mcpScope: "mcp:signals:read",
    });
    const signal = await deps.getVisibleSignalByPublicId({
      clerkOrgId: authority.clerkOrgId,
      createdByUserId: authority.createdByUserId,
      publicId: input.publicId,
    });

    if (!signal) {
      throw new NotFoundError("SIGNAL_NOT_FOUND", "Signal not found.");
    }

    const entityLinks = await deps.listSignalEntityLinksForSignal({
      clerkOrgId: authority.clerkOrgId,
      signalId: signal.publicId,
    });

    return { ...signal, entityLinks };
  },
});

export const createSignalCommand = defineCommand({
  name: "signals.create",
  input: createSignalInput,
  output: createSignalOutput,
  run: async ({
    ctx,
    deps,
    input,
  }: SignalCommandRunArgs<
    z.infer<typeof createSignalInput>,
    z.infer<typeof createSignalOutput>,
    SignalCreateCommandDeps
  >) => {
    const authority = requireSignalCommandAuthority(ctx, {
      apiKeyScope: "api.signals.write",
      mcpScope: "mcp:signals:write",
    });
    try {
      return await deps.createAndQueueSignal({
        ...authority,
        input: input.input,
      });
    } catch (error) {
      if (deps.isSignalCreateQueueError(error)) {
        throw new InternalDomainError(
          "SIGNAL_QUEUE_FAILED",
          errorMessage(error),
          {},
          { cause: error }
        );
      }
      throw error;
    }
  },
});
