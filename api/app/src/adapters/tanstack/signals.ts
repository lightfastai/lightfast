import {
  getVisibleSignalByPublicId,
  listSignalEntityLinksForSignal,
  listSignals,
  listWorkspaceSignals,
} from "@db/app";
import { db } from "@db/app/client";
import { createServerFn } from "@tanstack/react-start";
import { getRequest, setResponseHeader } from "@tanstack/react-start/server";
import type { z } from "zod";
import { resolveAuthContextFromClerk } from "../../auth/identity";
import { actorFromAuthIdentity, isDomainError } from "../../domain";
import {
  createSignalCommand,
  getSignalCommand,
  listProcessingSignalsCommand,
  listProcessingSignalsInput,
  listWorkingSetSignalsCommand,
  type SignalCommandDeps,
} from "../../domain/signals";
import {
  createAndQueueSignal,
  isSignalCreateQueueError,
} from "../../signals/create-signal";

function requestId() {
  return crypto.randomUUID();
}

async function createTanStackSignalContext() {
  const request = getRequest();
  const auth = await resolveAuthContextFromClerk({
    db,
    headers: new Headers(request.headers),
  });
  return {
    actor: actorFromAuthIdentity(auth.identity, "web"),
    request: { id: requestId(), source: "tanstack" as const },
  };
}

function mapTanStackError(error: unknown): never {
  if (isDomainError(error)) {
    throw new Error(error.message, { cause: error });
  }
  throw error;
}

function noStore() {
  setResponseHeader("cache-control", "private, no-store");
}

function signalCommandDeps(): SignalCommandDeps {
  return {
    createAndQueueSignal: (input) => createAndQueueSignal(db, input),
    getVisibleSignalByPublicId: (input) =>
      getVisibleSignalByPublicId(db, input),
    isSignalCreateQueueError,
    listSignalEntityLinksForSignal: (input) =>
      listSignalEntityLinksForSignal(db, input),
    listSignals: (input) => listSignals(db, input),
    listWorkspaceSignals: (input) => listWorkspaceSignals(db, input),
  };
}

export const listProcessingSignals = createServerFn({ method: "GET" })
  .inputValidator(listProcessingSignalsInput)
  .handler(async ({ data }) => {
    noStore();
    try {
      return await listProcessingSignalsCommand.run({
        ctx: await createTanStackSignalContext(),
        deps: signalCommandDeps(),
        input: data,
      });
    } catch (error) {
      mapTanStackError(error);
    }
  });

export const listWorkingSetSignals = createServerFn({ method: "GET" }).handler(
  async () => {
    noStore();
    try {
      return await listWorkingSetSignalsCommand.run({
        ctx: await createTanStackSignalContext(),
        deps: signalCommandDeps(),
        input: {},
      });
    } catch (error) {
      mapTanStackError(error);
    }
  }
);

export const getSignal = createServerFn({ method: "GET" })
  .inputValidator(getSignalCommand.input)
  .handler(async ({ data }) => {
    noStore();
    try {
      return await getSignalCommand.run({
        ctx: await createTanStackSignalContext(),
        deps: signalCommandDeps(),
        input: data,
      });
    } catch (error) {
      mapTanStackError(error);
    }
  });

export const createSignal = createServerFn({ method: "POST" })
  .inputValidator(createSignalCommand.input)
  .handler(async ({ data }) => {
    noStore();
    try {
      return await createSignalCommand.run({
        ctx: await createTanStackSignalContext(),
        deps: signalCommandDeps(),
        input: data,
      });
    } catch (error) {
      mapTanStackError(error);
    }
  });

export type ListProcessingSignalsResult = Awaited<
  ReturnType<typeof listProcessingSignals>
>;
export type ListWorkingSetSignalsResult = Awaited<
  ReturnType<typeof listWorkingSetSignals>
>;
export type SignalDetailResult = Awaited<ReturnType<typeof getSignal>>;
export type CreateSignalInput = z.input<typeof createSignalCommand.input>;
export type CreateSignalResult = Awaited<ReturnType<typeof createSignal>>;
