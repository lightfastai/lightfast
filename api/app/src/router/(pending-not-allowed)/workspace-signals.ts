import { getSignalByPublicId, listSignals, listWorkspaceSignals } from "@db/app";
import {
  createSignalInput,
  signalDispositionSchema,
  signalIdSchema,
  signalKindSchema,
  signalPrioritySchema,
  signalStatusSchema,
} from "@repo/api-contract";
import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  createAndQueueSignal,
  isSignalCreateQueueError,
} from "../../signals/create-signal";
import { boundOrgProcedure } from "../../trpc";
import {
  workspaceListCursorInput,
  workspaceListLimitInput,
  workspaceListSearchInput,
} from "./workspace-list-input";

const listSignalsInput = z.object({
  cursor: workspaceListCursorInput,
  dispositions: z.array(signalDispositionSchema).max(3).optional(),
  kinds: z.array(signalKindSchema).max(7).optional(),
  limit: workspaceListLimitInput,
  peopleRouted: z.boolean().optional(),
  priorities: z.array(signalPrioritySchema).max(4).optional(),
  search: workspaceListSearchInput,
  status: signalStatusSchema.optional(),
  statuses: z.array(signalStatusSchema).max(4).optional(),
});

export const workspaceSignalsRouter = {
  list: boundOrgProcedure.input(listSignalsInput).query(({ ctx, input }) => {
    const statuses = input.statuses?.length ? input.statuses : undefined;

    return listSignals(ctx.db, {
      clerkOrgId: ctx.auth.identity.orgId,
      cursor: input.cursor,
      dispositions: input.dispositions?.length ? input.dispositions : undefined,
      kinds: input.kinds?.length ? input.kinds : undefined,
      limit: input.limit,
      peopleRouted: input.peopleRouted,
      priorities: input.priorities?.length ? input.priorities : undefined,
      search: input.search,
      status: input.status,
      ...(statuses ? { statuses } : {}),
    });
  }),
  workingSet: boundOrgProcedure.query(({ ctx }) =>
    listWorkspaceSignals(ctx.db, {
      clerkOrgId: ctx.auth.identity.orgId,
    })
  ),
  get: boundOrgProcedure
    .input(z.object({ publicId: signalIdSchema }))
    .query(async ({ ctx, input }) => {
      const signal = await getSignalByPublicId(ctx.db, {
        publicId: input.publicId,
        clerkOrgId: ctx.auth.identity.orgId,
      });

      if (!signal) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Signal not found",
        });
      }

      return signal;
    }),
  create: boundOrgProcedure
    .input(createSignalInput)
    .mutation(async ({ ctx, input }) => {
      try {
        return await createAndQueueSignal(ctx.db, {
          clerkOrgId: ctx.auth.identity.orgId,
          createdByApiKeyId: null,
          createdByUserId: ctx.auth.identity.userId,
          input: input.input,
        });
      } catch (error) {
        if (isSignalCreateQueueError(error)) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: error.message,
            cause: error,
          });
        }
        throw error;
      }
    }),
} satisfies TRPCRouterRecord;
