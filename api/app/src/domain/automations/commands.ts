import type { Automation, AutomationRun } from "@db/app";
import {
  createAutomationSchema,
  getAutomationRunSchema,
  getAutomationSchema,
  listAutomationRunsSchema,
  updateAutomationSchema,
} from "@repo/app-validation/schemas";
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

export type AutomationRecord = Automation;
export type AutomationRunRecord = AutomationRun;

export interface AutomationCommandDeps {
  createAutomation(input: {
    clerkOrgId: string;
    connectorProvider: z.infer<
      typeof createAutomationSchema
    >["connectorProvider"];
    createdByUserId: string;
    name: string;
    prompt: string;
    schedule: z.infer<typeof createAutomationSchema>["schedule"];
    targetKind: z.infer<typeof createAutomationSchema>["targetKind"];
    timezone: string;
  }): Promise<AutomationRecord>;
  createAutomationRun(input: {
    automation: AutomationRecord;
    dueAt: Date;
    trigger: "manual";
  }): Promise<AutomationRunRecord>;
  deleteAutomation(input: {
    clerkOrgId: string;
    publicId: string;
  }): Promise<boolean>;
  getAutomationByPublicId(input: {
    clerkOrgId: string;
    publicId: string;
  }): Promise<AutomationRecord | undefined>;
  getAutomationRunByPublicId(input: {
    clerkOrgId: string;
    publicId: string;
  }): Promise<AutomationRunRecord | undefined>;
  listAutomationRuns(input: {
    automationPublicId: string;
    clerkOrgId: string;
    limit?: number;
  }): Promise<AutomationRunRecord[]>;
  listAutomations(input: { clerkOrgId: string }): Promise<AutomationRecord[]>;
  log: { warn(message: string, context?: Record<string, unknown>): void };
  markAutomationRunFailed(input: {
    clerkOrgId: string;
    errorCode: string;
    errorMessage: string;
    publicId: string;
  }): Promise<unknown>;
  now: () => Date;
  sendAutomationRunRequested: (
    data: AutomationRunRequestedEventData
  ) => Promise<void>;
  sendAutomationRunRequestedTimeoutMs: number;
  setAutomationStatus(input: {
    clerkOrgId: string;
    publicId: string;
    status: "active" | "paused";
  }): Promise<AutomationRecord | undefined>;
  updateAutomation(input: {
    clerkOrgId: string;
    connectorProvider?: z.infer<
      typeof updateAutomationSchema
    >["connectorProvider"];
    name?: string;
    prompt?: string;
    publicId: string;
    schedule?: z.infer<typeof updateAutomationSchema>["schedule"];
    targetKind?: z.infer<typeof updateAutomationSchema>["targetKind"];
    timezone?: string;
  }): Promise<AutomationRecord | undefined>;
}

const emptyInput = z.object({}).strict();
const automationOutput = z.custom<AutomationRecord>(isRecord);
const automationListOutput = z.array(automationOutput);
const automationRunOutput = z.custom<AutomationRunRecord>(isRecord);
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
    return deps.listAutomations({ clerkOrgId: actor.orgId });
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
    const automation =
      (await deps.getAutomationByPublicId({
        clerkOrgId: actor.orgId,
        publicId: input.id,
      })) ?? automationNotFound();
    return requireAutomationVisibleToActor(automation, actor);
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
    return deps.createAutomation({
      clerkOrgId: actor.orgId,
      connectorProvider: input.connectorProvider,
      createdByUserId: actor.userId,
      name: input.name,
      prompt: input.prompt,
      schedule: input.schedule,
      targetKind: input.targetKind,
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
    const automation =
      (await deps.updateAutomation({
        clerkOrgId: actor.orgId,
        publicId: input.id,
        connectorProvider: input.connectorProvider,
        name: input.name,
        prompt: input.prompt,
        schedule: input.schedule,
        targetKind: input.targetKind,
        timezone: input.timezone,
      })) ?? automationNotFound();
    return requireAutomationVisibleToActor(automation, actor);
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
    const deleted = await deps.deleteAutomation({
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
    const automation = requireAutomationVisibleToActor(
      (await deps.getAutomationByPublicId({
        clerkOrgId: actor.orgId,
        publicId: input.id,
      })) ?? automationNotFound(),
      actor
    );

    if (automation.status !== "active") {
      throw new ValidationError("AUTOMATION_PAUSED", "Automation is paused.");
    }

    const run = await deps.createAutomationRun({
      automation,
      dueAt: deps.now(),
      trigger: "manual",
    });

    try {
      await withTimeout(
        deps.sendAutomationRunRequested({
          automationId: automation.publicId,
          clerkOrgId: automation.clerkOrgId,
          runId: run.publicId,
          scheduleVersion: automation.scheduleVersion,
        }),
        deps.sendAutomationRunRequestedTimeoutMs
      );
    } catch (error) {
      try {
        await deps.markAutomationRunFailed({
          clerkOrgId: automation.clerkOrgId,
          publicId: run.publicId,
          errorCode: "AUTOMATION_RUN_ENQUEUE_FAILED",
          errorMessage: getErrorMessage(error),
        });
      } catch (markError) {
        deps.log.warn("[automations] failed to mark manual run failed", {
          automationId: automation.publicId,
          clerkOrgId: automation.clerkOrgId,
          error: markError,
          originalError: error,
          runId: run.publicId,
        });
      }
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
    return deps.listAutomationRuns({
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
      (await deps.getAutomationRunByPublicId({
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
  const automation =
    (await deps.setAutomationStatus({
      clerkOrgId: actor.orgId,
      publicId,
      status,
    })) ?? automationNotFound();
  return requireAutomationVisibleToActor(automation, actor);
}

function automationNotFound(): never {
  throw new NotFoundError("AUTOMATION_NOT_FOUND", "Automation not found");
}

function requireAutomationVisibleToActor(
  automation: AutomationRecord,
  actor: BoundClerkOrgActor
): AutomationRecord {
  if (automation.clerkOrgId !== actor.orgId) {
    automationNotFound();
  }
  return automation;
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

async function withTimeout<T>(
  operation: Promise<T>,
  timeoutMs: number
): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => {
          reject(
            new Error(`Automation run enqueue timed out after ${timeoutMs}ms.`)
          );
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
