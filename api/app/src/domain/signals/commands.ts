import {
  type Database,
  getVisibleSignalByPublicId,
  listSignalEntityLinksForSignal,
  listSignals,
  listWorkspaceSignals,
} from "@db/app";
import {
  createSignalInput,
  createSignalOutput,
  signalIdSchema,
  signalStatusSchema,
} from "@repo/api-contract";
import { z } from "zod";
import type { PublicApiKeyScope } from "../../auth/api-key";
import {
  type CreateAndQueueSignalInput,
  createAndQueueSignal,
  isSignalCreateQueueError,
} from "../../signals/create-signal";
import type { ExecutionContext } from "../actor";
import { type CommandRunArgs, defineCommand } from "../command";
import { AuthzError, InternalDomainError, NotFoundError } from "../errors";
import { requireBoundClerkOrgActor } from "../gates";

export type ListProcessingSignalsResult = Awaited<
  ReturnType<typeof listSignals>
>;
export type ListWorkingSetSignalsResult = Awaited<
  ReturnType<typeof listWorkspaceSignals>
>;
export type SignalDetailResult = NonNullable<
  Awaited<ReturnType<typeof getVisibleSignalByPublicId>>
> & {
  entityLinks: Awaited<ReturnType<typeof listSignalEntityLinksForSignal>>;
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

interface SignalCommandBaseDeps {
  db: Database;
}

export interface SignalCreateCommandDeps extends SignalCommandBaseDeps {
  createAndQueueSignal: typeof createAndQueueSignal;
}

export interface SignalGetCommandDeps extends SignalCommandBaseDeps {
  getVisibleSignalByPublicId: typeof getVisibleSignalByPublicId;
  listSignalEntityLinksForSignal: typeof listSignalEntityLinksForSignal;
}

export interface SignalListProcessingCommandDeps extends SignalCommandBaseDeps {
  listSignals: typeof listSignals;
}

export interface SignalListWorkingSetCommandDeps extends SignalCommandBaseDeps {
  listWorkspaceSignals: typeof listWorkspaceSignals;
}

export type SignalCommandDeps = SignalCreateCommandDeps &
  SignalGetCommandDeps &
  SignalListProcessingCommandDeps &
  SignalListWorkingSetCommandDeps;

export function createSignalCommandDeps(input: {
  db: Database;
}): SignalCreateCommandDeps {
  return {
    db: input.db,
    createAndQueueSignal,
  };
}

export function getSignalCommandDeps(input: {
  db: Database;
}): SignalGetCommandDeps {
  return {
    db: input.db,
    getVisibleSignalByPublicId,
    listSignalEntityLinksForSignal,
  };
}

export function listProcessingSignalsCommandDeps(input: {
  db: Database;
}): SignalListProcessingCommandDeps {
  return {
    db: input.db,
    listSignals,
  };
}

export function createDefaultSignalCommandDeps(input: {
  db: Database;
}): SignalCommandDeps {
  return {
    db: input.db,
    createAndQueueSignal,
    getVisibleSignalByPublicId,
    listSignalEntityLinksForSignal,
    listSignals,
    listWorkspaceSignals,
  };
}

const objectOutput = <T>() =>
  z.custom<T>((value) => typeof value === "object" && value !== null);

type SignalCommandRunArgs<
  TInput,
  TOutput,
  TDeps extends object,
> = CommandRunArgs<TInput, TOutput, TDeps>;

type ResolvedSignalCommandAuthority = Pick<
  CreateAndQueueSignalInput,
  | "clerkOrgId"
  | "createdByApiKeyId"
  | "createdByMcpClientId"
  | "createdByMcpGrantId"
  | "createdByUserId"
>;

function requireSignalCommandAuthority(
  ctx: ExecutionContext,
  input: { apiKeyScope?: PublicApiKeyScope } = {}
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
    });
    return deps.listSignals(deps.db, {
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
    });
    return deps.listWorkspaceSignals(deps.db, {
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
    });
    const signal = await deps.getVisibleSignalByPublicId(deps.db, {
      clerkOrgId: authority.clerkOrgId,
      createdByUserId: authority.createdByUserId,
      publicId: input.publicId,
    });

    if (!signal) {
      throw new NotFoundError("SIGNAL_NOT_FOUND", "Signal not found.");
    }

    const entityLinks = await deps.listSignalEntityLinksForSignal(deps.db, {
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
    });
    try {
      return await deps.createAndQueueSignal(deps.db, {
        ...authority,
        input: input.input,
      });
    } catch (error) {
      if (isSignalCreateQueueError(error)) {
        throw new InternalDomainError(
          "SIGNAL_QUEUE_FAILED",
          error.message,
          {},
          { cause: error }
        );
      }
      throw error;
    }
  },
});
