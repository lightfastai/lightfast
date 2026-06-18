import type { Automation, AutomationRun, Database } from "@db/app";
import {
  createAutomation,
  createAutomationRun,
  deleteAutomation,
  getAutomationByPublicId,
  getAutomationRunByPublicId,
  listAutomationRuns,
  listAutomations,
  markAutomationRunFailed,
  setAutomationStatus,
  updateAutomation,
} from "@db/app";
import {
  createAutomationSchema,
  getAutomationRunSchema,
  getAutomationSchema,
  listAutomationRunsSchema,
  updateAutomationSchema,
} from "@repo/app-validation/schemas";
import { log } from "@vendor/observability/log/next";
import { z } from "zod";
import { defineCommand } from "../command";
import {
  AuthzError,
  InternalDomainError,
  NotFoundError,
  ValidationError,
} from "../errors";
import type { BoundClerkOrgActor, ClerkOrgAdminActor } from "../gates";
import { requireBoundClerkOrgActor } from "../gates";

interface AutomationRunRequestedEventData {
  automationId: string;
  clerkOrgId: string;
  runId: string;
  scheduleVersion: number;
}

interface AutomationCommandDeps {
  createAutomation: typeof createAutomation;
  createAutomationRun: typeof createAutomationRun;
  db: Database;
  deleteAutomation: typeof deleteAutomation;
  getAutomationByPublicId: typeof getAutomationByPublicId;
  getAutomationRunByPublicId: typeof getAutomationRunByPublicId;
  listAutomationRuns: typeof listAutomationRuns;
  listAutomations: typeof listAutomations;
  log: Pick<typeof log, "warn">;
  markAutomationRunFailed: typeof markAutomationRunFailed;
  now: () => Date;
  sendAutomationRunRequested: (
    data: AutomationRunRequestedEventData
  ) => Promise<void>;
  setAutomationStatus: typeof setAutomationStatus;
  updateAutomation: typeof updateAutomation;
}

export function createDefaultAutomationCommandDeps(
  input: { db: Database } & Partial<Omit<AutomationCommandDeps, "db">>
): AutomationCommandDeps {
  return {
    createAutomation: input.createAutomation ?? createAutomation,
    createAutomationRun: input.createAutomationRun ?? createAutomationRun,
    db: input.db,
    deleteAutomation: input.deleteAutomation ?? deleteAutomation,
    getAutomationByPublicId:
      input.getAutomationByPublicId ?? getAutomationByPublicId,
    getAutomationRunByPublicId:
      input.getAutomationRunByPublicId ?? getAutomationRunByPublicId,
    listAutomationRuns: input.listAutomationRuns ?? listAutomationRuns,
    listAutomations: input.listAutomations ?? listAutomations,
    log: input.log ?? log,
    markAutomationRunFailed:
      input.markAutomationRunFailed ?? markAutomationRunFailed,
    now: input.now ?? (() => new Date()),
    sendAutomationRunRequested:
      input.sendAutomationRunRequested ?? sendAutomationRunRequested,
    setAutomationStatus: input.setAutomationStatus ?? setAutomationStatus,
    updateAutomation: input.updateAutomation ?? updateAutomation,
  };
}

const emptyInput = z.object({}).strict();
const automationOutput = z.custom<Automation>(isRecord);
const automationListOutput = z.array(automationOutput);
const automationRunOutput = z.custom<AutomationRun>(isRecord);
const automationRunListOutput = z.array(automationRunOutput);
const deleteAutomationOutput = z.object({ deleted: z.literal(true) });

export const listAutomationsCommand = defineCommand<
  "automations.list",
  typeof emptyInput,
  typeof automationListOutput,
  AutomationCommandDeps
>({
  name: "automations.list",
  input: emptyInput,
  output: automationListOutput,
  run: async ({ ctx, deps }) => {
    const actor = requireBoundClerkOrgActor(ctx);
    return deps.listAutomations(deps.db, { clerkOrgId: actor.orgId });
  },
});

export const getAutomationCommand = defineCommand<
  "automations.get",
  typeof getAutomationSchema,
  typeof automationOutput,
  AutomationCommandDeps
>({
  name: "automations.get",
  input: getAutomationSchema,
  output: automationOutput,
  run: async ({ ctx, deps, input }) => {
    const actor = requireBoundClerkOrgActor(ctx);
    return (
      (await deps.getAutomationByPublicId(deps.db, {
        clerkOrgId: actor.orgId,
        publicId: input.id,
      })) ?? automationNotFound()
    );
  },
});

export const createAutomationCommand = defineCommand<
  "automations.create",
  typeof createAutomationSchema,
  typeof automationOutput,
  AutomationCommandDeps
>({
  name: "automations.create",
  input: createAutomationSchema,
  output: automationOutput,
  run: async ({ ctx, deps, input }) => {
    const actor = requireBoundClerkOrgAdminActor(ctx);
    return deps.createAutomation(deps.db, {
      clerkOrgId: actor.orgId,
      connectorProvider: input.connectorProvider,
      createdByUserId: actor.userId,
      name: input.name,
      prompt: input.prompt,
      schedule: input.schedule,
      timezone: input.timezone,
    });
  },
});

export const updateAutomationCommand = defineCommand<
  "automations.update",
  typeof updateAutomationSchema,
  typeof automationOutput,
  AutomationCommandDeps
>({
  name: "automations.update",
  input: updateAutomationSchema,
  output: automationOutput,
  run: async ({ ctx, deps, input }) => {
    const actor = requireBoundClerkOrgAdminActor(ctx);
    return (
      (await deps.updateAutomation(deps.db, {
        clerkOrgId: actor.orgId,
        publicId: input.id,
        name: input.name,
        prompt: input.prompt,
        schedule: input.schedule,
        timezone: input.timezone,
      })) ?? automationNotFound()
    );
  },
});

export const pauseAutomationCommand = defineCommand<
  "automations.pause",
  typeof getAutomationSchema,
  typeof automationOutput,
  AutomationCommandDeps
>({
  name: "automations.pause",
  input: getAutomationSchema,
  output: automationOutput,
  run: async ({ ctx, deps, input }) =>
    setAutomationStatusForActor(ctx, deps, input.id, "paused"),
});

export const resumeAutomationCommand = defineCommand<
  "automations.resume",
  typeof getAutomationSchema,
  typeof automationOutput,
  AutomationCommandDeps
>({
  name: "automations.resume",
  input: getAutomationSchema,
  output: automationOutput,
  run: async ({ ctx, deps, input }) =>
    setAutomationStatusForActor(ctx, deps, input.id, "active"),
});

export const deleteAutomationCommand = defineCommand<
  "automations.delete",
  typeof getAutomationSchema,
  typeof deleteAutomationOutput,
  AutomationCommandDeps
>({
  name: "automations.delete",
  input: getAutomationSchema,
  output: deleteAutomationOutput,
  run: async ({ ctx, deps, input }) => {
    const actor = requireBoundClerkOrgAdminActor(ctx);
    const deleted = await deps.deleteAutomation(deps.db, {
      clerkOrgId: actor.orgId,
      publicId: input.id,
    });
    if (!deleted) {
      automationNotFound();
    }
    return { deleted: true as const };
  },
});

export const runAutomationNowCommand = defineCommand<
  "automations.runNow",
  typeof getAutomationSchema,
  typeof automationRunOutput,
  AutomationCommandDeps
>({
  name: "automations.runNow",
  input: getAutomationSchema,
  output: automationRunOutput,
  run: async ({ ctx, deps, input }) => {
    const actor = requireBoundClerkOrgAdminActor(ctx);
    const automation =
      (await deps.getAutomationByPublicId(deps.db, {
        clerkOrgId: actor.orgId,
        publicId: input.id,
      })) ?? automationNotFound();

    if (automation.status !== "active") {
      throw new ValidationError("AUTOMATION_PAUSED", "Automation is paused.");
    }

    const run = await deps.createAutomationRun(deps.db, {
      automation,
      dueAt: deps.now(),
      trigger: "manual",
    });

    try {
      await deps.sendAutomationRunRequested({
        automationId: automation.publicId,
        clerkOrgId: automation.clerkOrgId,
        runId: run.publicId,
        scheduleVersion: automation.scheduleVersion,
      });
    } catch (error) {
      await deps.markAutomationRunFailed(deps.db, {
        clerkOrgId: automation.clerkOrgId,
        publicId: run.publicId,
        errorCode: "AUTOMATION_RUN_ENQUEUE_FAILED",
        errorMessage: getErrorMessage(error),
      });
      deps.log.warn("[automations] manual run enqueue failed", {
        automationId: automation.publicId,
        clerkOrgId: automation.clerkOrgId,
        error,
        runId: run.publicId,
      });
      throw new InternalDomainError(
        "AUTOMATION_RUN_ENQUEUE_FAILED",
        "Failed to queue automation run.",
        {},
        { cause: error }
      );
    }

    return run;
  },
});

export const listAutomationRunsCommand = defineCommand<
  "automations.listRuns",
  typeof listAutomationRunsSchema,
  typeof automationRunListOutput,
  AutomationCommandDeps
>({
  name: "automations.listRuns",
  input: listAutomationRunsSchema,
  output: automationRunListOutput,
  run: async ({ ctx, deps, input }) => {
    const actor = requireBoundClerkOrgActor(ctx);
    return deps.listAutomationRuns(deps.db, {
      automationPublicId: input.id,
      clerkOrgId: actor.orgId,
      limit: input.limit,
    });
  },
});

export const getAutomationRunCommand = defineCommand<
  "automations.getRun",
  typeof getAutomationRunSchema,
  typeof automationRunOutput,
  AutomationCommandDeps
>({
  name: "automations.getRun",
  input: getAutomationRunSchema,
  output: automationRunOutput,
  run: async ({ ctx, deps, input }) => {
    const actor = requireBoundClerkOrgActor(ctx);
    return (
      (await deps.getAutomationRunByPublicId(deps.db, {
        clerkOrgId: actor.orgId,
        publicId: input.id,
      })) ?? automationRunNotFound()
    );
  },
});

function requireBoundClerkOrgAdminActor(
  ctx: Parameters<typeof requireBoundClerkOrgActor>[0]
): ClerkOrgAdminActor & BoundClerkOrgActor {
  const actor = requireBoundClerkOrgActor(ctx);
  if (actor.orgRole !== "admin") {
    throw new AuthzError(
      "PERMISSION_REQUIRED",
      "Only organization administrators can perform this action."
    );
  }
  return actor as ClerkOrgAdminActor & BoundClerkOrgActor;
}

async function setAutomationStatusForActor(
  ctx: Parameters<typeof requireBoundClerkOrgActor>[0],
  deps: AutomationCommandDeps,
  publicId: string,
  status: "active" | "paused"
) {
  const actor = requireBoundClerkOrgAdminActor(ctx);
  return (
    (await deps.setAutomationStatus(deps.db, {
      clerkOrgId: actor.orgId,
      publicId,
      status,
    })) ?? automationNotFound()
  );
}

function automationNotFound(): never {
  throw new NotFoundError("AUTOMATION_NOT_FOUND", "Automation not found");
}

function automationRunNotFound(): never {
  throw new NotFoundError(
    "AUTOMATION_RUN_NOT_FOUND",
    "Automation run not found"
  );
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

async function sendAutomationRunRequested(
  data: AutomationRunRequestedEventData
) {
  const { inngest } = await import("../../inngest/client");
  await inngest.send({
    name: "app/automation.run.requested",
    data,
  });
}
