import { createSignalView, deleteSignalView, listSignalViews } from "@db/app";
import {
  signalDispositionSchema,
  signalKindSchema,
  signalPrioritySchema,
} from "@repo/api-contract";
import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { boundOrgProcedure } from "../../trpc";

const signalViewConfigSchema = z.object({
  filters: z.object({
    kinds: z.array(signalKindSchema).max(7),
    priorities: z.array(signalPrioritySchema).max(4),
    dispositions: z.array(signalDispositionSchema).max(3),
    peopleRouted: z.boolean(),
  }),
  layout: z.enum(["list", "board"]),
});

const createSignalViewInput = z.object({
  name: z.string().trim().min(1).max(120),
  config: signalViewConfigSchema,
});

const deleteSignalViewInput = z.object({
  publicId: z.string().min(1).max(64),
});

export const workspaceSignalViewsRouter = {
  list: boundOrgProcedure.query(({ ctx }) =>
    listSignalViews(ctx.db, {
      clerkOrgId: ctx.auth.identity.orgId,
      createdByUserId: ctx.auth.identity.userId,
    })
  ),
  create: boundOrgProcedure
    .input(createSignalViewInput)
    .mutation(({ ctx, input }) =>
      createSignalView(ctx.db, {
        clerkOrgId: ctx.auth.identity.orgId,
        createdByUserId: ctx.auth.identity.userId,
        name: input.name,
        config: input.config,
      })
    ),
  delete: boundOrgProcedure
    .input(deleteSignalViewInput)
    .mutation(async ({ ctx, input }) => {
      const deleted = await deleteSignalView(ctx.db, {
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
