import {
  createAutomation,
  createAutomationRun,
  getAutomationByPublicId,
  listAutomationRuns,
  listAutomations,
  markAutomationRunFailed,
  setAutomationStatus,
  updateAutomation,
} from "@db/app";
import {
  createAutomationSchema,
  getAutomationSchema,
  listAutomationRunsSchema,
  updateAutomationSchema,
} from "@repo/app-validation/schemas";
import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { log } from "@vendor/observability/log/next";

import { boundOrgAdminProcedure, boundOrgProcedure } from "../../trpc";

function notFound(): never {
  throw new TRPCError({
    code: "NOT_FOUND",
    message: "Automation not found",
  });
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export const automationsRouter = {
  list: boundOrgProcedure.query(({ ctx }) =>
    listAutomations(ctx.db, { clerkOrgId: ctx.auth.identity.orgId })
  ),

  get: boundOrgProcedure
    .input(getAutomationSchema)
    .query(async ({ ctx, input }) => {
      const automation = await getAutomationByPublicId(ctx.db, {
        clerkOrgId: ctx.auth.identity.orgId,
        publicId: input.id,
      });
      return automation ?? notFound();
    }),

  create: boundOrgAdminProcedure
    .input(createAutomationSchema)
    .mutation(({ ctx, input }) =>
      createAutomation(ctx.db, {
        clerkOrgId: ctx.auth.identity.orgId,
        createdByUserId: ctx.auth.identity.userId,
        name: input.name,
        prompt: input.prompt,
        schedule: input.schedule,
        timezone: input.timezone,
      })
    ),

  update: boundOrgAdminProcedure
    .input(updateAutomationSchema)
    .mutation(async ({ ctx, input }) => {
      const automation = await updateAutomation(ctx.db, {
        clerkOrgId: ctx.auth.identity.orgId,
        publicId: input.id,
        name: input.name,
        prompt: input.prompt,
        schedule: input.schedule,
        timezone: input.timezone,
      });
      return automation ?? notFound();
    }),

  pause: boundOrgAdminProcedure
    .input(getAutomationSchema)
    .mutation(async ({ ctx, input }) => {
      const automation = await setAutomationStatus(ctx.db, {
        clerkOrgId: ctx.auth.identity.orgId,
        publicId: input.id,
        status: "paused",
      });
      return automation ?? notFound();
    }),

  resume: boundOrgAdminProcedure
    .input(getAutomationSchema)
    .mutation(async ({ ctx, input }) => {
      const automation = await setAutomationStatus(ctx.db, {
        clerkOrgId: ctx.auth.identity.orgId,
        publicId: input.id,
        status: "active",
      });
      return automation ?? notFound();
    }),

  runNow: boundOrgAdminProcedure
    .input(getAutomationSchema)
    .mutation(async ({ ctx, input }) => {
      const automation = await getAutomationByPublicId(ctx.db, {
        clerkOrgId: ctx.auth.identity.orgId,
        publicId: input.id,
      });
      if (!automation) {
        notFound();
      }
      if (automation.status !== "active") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Automation is paused.",
        });
      }

      const run = await createAutomationRun(ctx.db, {
        automation,
        dueAt: new Date(),
        trigger: "manual",
      });

      try {
        const { inngest } = await import("../../inngest/client");
        await inngest.send({
          name: "app/automation.run.requested",
          data: {
            automationId: automation.publicId,
            clerkOrgId: automation.clerkOrgId,
            runId: run.publicId,
            scheduleVersion: automation.scheduleVersion,
          },
        });
      } catch (error) {
        await markAutomationRunFailed(ctx.db, {
          clerkOrgId: automation.clerkOrgId,
          publicId: run.publicId,
          errorCode: "AUTOMATION_RUN_ENQUEUE_FAILED",
          errorMessage: getErrorMessage(error),
        });
        log.warn("[automations] manual run enqueue failed", {
          automationId: automation.publicId,
          clerkOrgId: automation.clerkOrgId,
          error,
          runId: run.publicId,
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to queue automation run.",
        });
      }

      return run;
    }),

  listRuns: boundOrgProcedure
    .input(listAutomationRunsSchema)
    .query(({ ctx, input }) =>
      listAutomationRuns(ctx.db, {
        automationPublicId: input.id,
        clerkOrgId: ctx.auth.identity.orgId,
        limit: input.limit,
      })
    ),
} satisfies TRPCRouterRecord;
