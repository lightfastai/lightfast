import { db } from "@db/app/client";
import { createServerFn } from "@tanstack/react-start";
import { getRequest, setResponseHeader } from "@tanstack/react-start/server";
import { resolveAuthContextFromClerk } from "../../auth/identity";
import { actorFromAuthIdentity, isDomainError } from "../../domain";
import {
  createDefaultSignalCommandDeps,
  createSignalCommand,
  getSignalCommand,
  listProcessingSignalsCommand,
  listProcessingSignalsInput,
  listWorkingSetSignalsCommand,
} from "../../domain/signals";

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

export const listProcessingSignals = createServerFn({ method: "GET" })
  .inputValidator(listProcessingSignalsInput)
  .handler(async ({ data }) => {
    noStore();
    try {
      return await listProcessingSignalsCommand.run({
        ctx: await createTanStackSignalContext(),
        deps: createDefaultSignalCommandDeps({ db }),
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
        deps: createDefaultSignalCommandDeps({ db }),
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
        deps: createDefaultSignalCommandDeps({ db }),
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
        deps: createDefaultSignalCommandDeps({ db }),
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
export type CreateSignalResult = Awaited<ReturnType<typeof createSignal>>;
