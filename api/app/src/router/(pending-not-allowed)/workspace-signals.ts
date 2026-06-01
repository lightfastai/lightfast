import {
  getVisibleSignalByPublicId,
  listSignals,
  listWorkspaceSignals,
} from "@db/app";
import {
  createSignalInput,
  signalIdSchema,
  signalStatusSchema,
} from "@repo/api-contract";
import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { isSignalCreateQueueError } from "../../signals/create-signal";
import { createSignalForActor } from "../../signals/service";
import { boundOrgProcedure } from "../../trpc";
import {
  workspaceListCursorInput,
  workspaceListLimitInput,
} from "./workspace-list-input";
import { workspaceSignalViewsRouter } from "./workspace-signal-views";

const listSignalsInput = z
  .object({
    cursor: workspaceListCursorInput,
    limit: workspaceListLimitInput,
    statuses: z.array(signalStatusSchema).max(2).optional(),
  })
  .strict();

export const workspaceSignalsRouter = {
  list: boundOrgProcedure.input(listSignalsInput).query(({ ctx, input }) =>
    listSignals(ctx.db, {
      clerkOrgId: ctx.auth.identity.orgId,
      createdByUserId: ctx.auth.identity.userId,
      cursor: input.cursor,
      limit: input.limit,
      statuses: input.statuses?.length ? input.statuses : undefined,
    })
  ),
  workingSet: boundOrgProcedure.query(({ ctx }) =>
    listWorkspaceSignals(ctx.db, {
      clerkOrgId: ctx.auth.identity.orgId,
      createdByUserId: ctx.auth.identity.userId,
    })
  ),
  get: boundOrgProcedure
    .input(z.object({ publicId: signalIdSchema }))
    .query(async ({ ctx, input }) => {
      const signal = await getVisibleSignalByPublicId(ctx.db, {
        publicId: input.publicId,
        clerkOrgId: ctx.auth.identity.orgId,
        createdByUserId: ctx.auth.identity.userId,
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
        return await createSignalForActor(ctx.db, {
          actor: {
            kind: "web",
            orgId: ctx.auth.identity.orgId,
            userId: ctx.auth.identity.userId,
          },
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
  views: workspaceSignalViewsRouter,
} satisfies TRPCRouterRecord;
