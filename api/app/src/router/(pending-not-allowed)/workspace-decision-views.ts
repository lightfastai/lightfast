import {
  createDecisionView,
  deleteDecisionView,
  listDecisionViews,
  type ProviderRoutineCall,
} from "@db/app";
import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { boundOrgProcedure } from "../../trpc";

const DECISION_PROVIDERS = [
  "linear",
  "x",
] as const satisfies readonly ProviderRoutineCall["provider"][];
const DECISION_STATUSES = [
  "failed",
  "running",
  "succeeded",
] as const satisfies readonly ProviderRoutineCall["status"][];

const decisionViewConfigSchema = z.object({
  filters: z.object({
    providers: z
      .array(z.enum(DECISION_PROVIDERS))
      .max(DECISION_PROVIDERS.length),
    statuses: z.array(z.enum(DECISION_STATUSES)).max(DECISION_STATUSES.length),
  }),
});

const createDecisionViewInput = z.object({
  name: z.string().trim().min(1).max(120),
  config: decisionViewConfigSchema,
});

const deleteDecisionViewInput = z.object({
  publicId: z.string().min(1).max(64),
});

export const workspaceDecisionViewsRouter = {
  list: boundOrgProcedure.query(({ ctx }) =>
    listDecisionViews(ctx.db, {
      clerkOrgId: ctx.auth.identity.orgId,
      createdByUserId: ctx.auth.identity.userId,
    })
  ),
  create: boundOrgProcedure
    .input(createDecisionViewInput)
    .mutation(({ ctx, input }) =>
      createDecisionView(ctx.db, {
        clerkOrgId: ctx.auth.identity.orgId,
        createdByUserId: ctx.auth.identity.userId,
        name: input.name,
        config: input.config,
      })
    ),
  delete: boundOrgProcedure
    .input(deleteDecisionViewInput)
    .mutation(async ({ ctx, input }) => {
      const deleted = await deleteDecisionView(ctx.db, {
        clerkOrgId: ctx.auth.identity.orgId,
        createdByUserId: ctx.auth.identity.userId,
        publicId: input.publicId,
      });
      if (!deleted) {
        throw new TRPCError({ code: "NOT_FOUND", message: "View not found" });
      }
      return { success: true };
    }),
} satisfies TRPCRouterRecord;
