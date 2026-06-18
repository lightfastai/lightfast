import type { AutomationRun } from "@db/app";
import { db } from "@db/app/client";
import { createServerFn } from "@tanstack/react-start";
import { getRequest, setResponseHeader } from "@tanstack/react-start/server";

import { resolveAuthContextFromClerk } from "../../auth/identity";
import type { Actor } from "../../domain";
import { actorFromAuthIdentity, isDomainError } from "../../domain";
import {
  createAutomationCommand,
  createDefaultAutomationCommandDeps,
  deleteAutomationCommand,
  getAutomationCommand,
  getAutomationRunCommand,
  listAutomationRunsCommand,
  listAutomationsCommand,
  pauseAutomationCommand,
  resumeAutomationCommand,
  runAutomationNowCommand,
  updateAutomationCommand,
} from "../../domain/automations";

type SerializableValue =
  | SerializableValue[]
  | boolean
  | null
  | number
  | string
  | { [key: string]: SerializableValue };

export type AutomationRunResult = Omit<AutomationRun, "output"> & {
  output: SerializableValue | null;
};
export type ListAutomationRunsResult = AutomationRunResult[];

function requestId() {
  return crypto.randomUUID();
}

function maybeMarkOrgAdmin(input: {
  actor: Actor;
  auth: Awaited<ReturnType<typeof resolveAuthContextFromClerk>>;
}): Actor {
  if (
    input.actor.kind === "clerkUser" &&
    input.auth.identity.type === "active" &&
    input.auth.access?.kind === "clerk-session" &&
    input.auth.access.userId === input.auth.identity.userId &&
    input.auth.access.orgId === input.auth.identity.orgId &&
    input.auth.access.has({ role: "org:admin" })
  ) {
    return { ...input.actor, orgRole: "admin" };
  }

  return input.actor;
}

async function createTanStackAutomationContext() {
  const request = getRequest();
  const auth = await resolveAuthContextFromClerk({
    db,
    headers: new Headers(request.headers),
  });
  const actor = actorFromAuthIdentity(auth.identity, "web");

  return {
    actor: maybeMarkOrgAdmin({ actor, auth }),
    request: { id: requestId(), source: "tanstack" as const },
  };
}

function deps() {
  return createDefaultAutomationCommandDeps({ db });
}

function mapTanStackError(error: unknown): never {
  if (isDomainError(error)) {
    throw new Error(error.message, { cause: error });
  }
  throw error;
}

function noStore() {
  setResponseHeader("cache-control", "private, no-store");
  setResponseHeader("vary", "Cookie, Authorization");
}

export const listAutomations = createServerFn({ method: "GET" }).handler(
  async () => {
    noStore();
    try {
      return await listAutomationsCommand.run({
        ctx: await createTanStackAutomationContext(),
        deps: deps(),
        input: {},
      });
    } catch (error) {
      mapTanStackError(error);
    }
  }
);

export const getAutomation = createServerFn({ method: "GET" })
  .inputValidator(getAutomationCommand.input)
  .handler(async ({ data }) => {
    noStore();
    try {
      return await getAutomationCommand.run({
        ctx: await createTanStackAutomationContext(),
        deps: deps(),
        input: data,
      });
    } catch (error) {
      mapTanStackError(error);
    }
  });

export const createAutomation = createServerFn({ method: "POST" })
  .inputValidator(createAutomationCommand.input)
  .handler(async ({ data }) => {
    noStore();
    try {
      return await createAutomationCommand.run({
        ctx: await createTanStackAutomationContext(),
        deps: deps(),
        input: data,
      });
    } catch (error) {
      mapTanStackError(error);
    }
  });

export const updateAutomation = createServerFn({ method: "POST" })
  .inputValidator(updateAutomationCommand.input)
  .handler(async ({ data }) => {
    noStore();
    try {
      return await updateAutomationCommand.run({
        ctx: await createTanStackAutomationContext(),
        deps: deps(),
        input: data,
      });
    } catch (error) {
      mapTanStackError(error);
    }
  });

export const pauseAutomation = createServerFn({ method: "POST" })
  .inputValidator(pauseAutomationCommand.input)
  .handler(async ({ data }) => {
    noStore();
    try {
      return await pauseAutomationCommand.run({
        ctx: await createTanStackAutomationContext(),
        deps: deps(),
        input: data,
      });
    } catch (error) {
      mapTanStackError(error);
    }
  });

export const resumeAutomation = createServerFn({ method: "POST" })
  .inputValidator(resumeAutomationCommand.input)
  .handler(async ({ data }) => {
    noStore();
    try {
      return await resumeAutomationCommand.run({
        ctx: await createTanStackAutomationContext(),
        deps: deps(),
        input: data,
      });
    } catch (error) {
      mapTanStackError(error);
    }
  });

export const deleteAutomation = createServerFn({ method: "POST" })
  .inputValidator(deleteAutomationCommand.input)
  .handler(async ({ data }) => {
    noStore();
    try {
      return await deleteAutomationCommand.run({
        ctx: await createTanStackAutomationContext(),
        deps: deps(),
        input: data,
      });
    } catch (error) {
      mapTanStackError(error);
    }
  });

export const runAutomationNow = createServerFn({ method: "POST" })
  .inputValidator(runAutomationNowCommand.input)
  .handler(async ({ data }) => {
    noStore();
    try {
      return serializeAutomationRun(
        await runAutomationNowCommand.run({
          ctx: await createTanStackAutomationContext(),
          deps: deps(),
          input: data,
        })
      );
    } catch (error) {
      mapTanStackError(error);
    }
  });

export const listAutomationRuns = createServerFn({ method: "GET" })
  .inputValidator(listAutomationRunsCommand.input)
  .handler(async ({ data }) => {
    noStore();
    try {
      const runs = await listAutomationRunsCommand.run({
        ctx: await createTanStackAutomationContext(),
        deps: deps(),
        input: data,
      });
      return runs.map(serializeAutomationRun);
    } catch (error) {
      mapTanStackError(error);
    }
  });

export const getAutomationRun = createServerFn({ method: "GET" })
  .inputValidator(getAutomationRunCommand.input)
  .handler(async ({ data }) => {
    noStore();
    try {
      return serializeAutomationRun(
        await getAutomationRunCommand.run({
          ctx: await createTanStackAutomationContext(),
          deps: deps(),
          input: data,
        })
      );
    } catch (error) {
      mapTanStackError(error);
    }
  });

export type ListAutomationsResult = Awaited<ReturnType<typeof listAutomations>>;
export type AutomationDetailResult = Awaited<ReturnType<typeof getAutomation>>;
export type CreateAutomationResult = Awaited<
  ReturnType<typeof createAutomation>
>;
export type AutomationRunDetailResult = AutomationRunResult;

function serializeAutomationRun(run: AutomationRun): AutomationRunResult {
  return {
    ...run,
    output:
      run.output === null || run.output === undefined
        ? null
        : toSerializableValue(run.output),
  };
}

function toSerializableValue(value: unknown): SerializableValue {
  if (value === null) {
    return null;
  }

  if (typeof value === "string" || typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (Array.isArray(value)) {
    return value.map(toSerializableValue);
  }

  if (typeof value === "object") {
    if (value instanceof Date) {
      return value.toISOString();
    }

    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [
        key,
        toSerializableValue(child),
      ])
    );
  }

  return null;
}
