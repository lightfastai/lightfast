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
import { isSignalCreateQueueError } from "../../signals/create-signal";
import { createSignalForActor } from "../../signals/service";
import { type CommandRunArgs, defineCommand } from "../command";
import { InternalDomainError, NotFoundError } from "../errors";
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
    statuses: z.array(signalStatusSchema).max(2).optional(),
  })
  .strict();

const listWorkingSetSignalsInput = z.object({}).strict();

const getSignalInput = z
  .object({
    publicId: signalIdSchema,
  })
  .strict();

export interface SignalCommandDeps {
  createSignalForActor: typeof createSignalForActor;
  db: Database;
  getVisibleSignalByPublicId: typeof getVisibleSignalByPublicId;
  listSignalEntityLinksForSignal: typeof listSignalEntityLinksForSignal;
  listSignals: typeof listSignals;
  listWorkspaceSignals: typeof listWorkspaceSignals;
}

export function createDefaultSignalCommandDeps(input: {
  db: Database;
}): SignalCommandDeps {
  return {
    db: input.db,
    createSignalForActor,
    getVisibleSignalByPublicId,
    listSignalEntityLinksForSignal,
    listSignals,
    listWorkspaceSignals,
  };
}

const objectOutput = <T>() =>
  z.custom<T>((value) => typeof value === "object" && value !== null);

type SignalCommandRunArgs<TInput, TOutput> = CommandRunArgs<
  TInput,
  TOutput,
  SignalCommandDeps
>;

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
    ListProcessingSignalsResult
  >) => {
    const actor = requireBoundClerkOrgActor(ctx);
    return deps.listSignals(deps.db, {
      clerkOrgId: actor.orgId,
      createdByUserId: actor.userId,
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
    ListWorkingSetSignalsResult
  >) => {
    const actor = requireBoundClerkOrgActor(ctx);
    return deps.listWorkspaceSignals(deps.db, {
      clerkOrgId: actor.orgId,
      createdByUserId: actor.userId,
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
    SignalDetailResult
  >) => {
    const actor = requireBoundClerkOrgActor(ctx);
    const signal = await deps.getVisibleSignalByPublicId(deps.db, {
      clerkOrgId: actor.orgId,
      createdByUserId: actor.userId,
      publicId: input.publicId,
    });

    if (!signal) {
      throw new NotFoundError("SIGNAL_NOT_FOUND", "Signal not found.");
    }

    const entityLinks = await deps.listSignalEntityLinksForSignal(deps.db, {
      clerkOrgId: actor.orgId,
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
    z.infer<typeof createSignalOutput>
  >) => {
    const actor = requireBoundClerkOrgActor(ctx);
    try {
      return await deps.createSignalForActor(deps.db, {
        actor: { kind: "web", orgId: actor.orgId, userId: actor.userId },
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
