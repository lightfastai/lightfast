import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { eq } from "@vendor/db";
import { Session } from "@vendor/db/lightfast/schema";

import { inngest } from "../../inngest/client/client";
import { publicProcedure } from "../../trpc";

export const sessionRouter = {
  get: publicProcedure
    .input(
      z.object({
        sessionId: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const session = await ctx.db.query.Session.findFirst({
        where: (table, { eq }) => eq(table.id, input.sessionId),
      });

      if (!session) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Session not found",
        });
      }

      return session;
    }),

  list: publicProcedure
    .input(
      z.object({
        workspaceId: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const sessions = await ctx.db.query.Session.findMany({
        where: (table, { eq }) => eq(table.workspaceId, input.workspaceId),
        orderBy: (table, { desc }) => [desc(table.updatedAt)],
      });

      return sessions;
    }),

  create: publicProcedure
    .input(
      z.object({
        workspaceId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [newSession] = await ctx.db
        .insert(Session)
        .values({
          workspaceId: input.workspaceId,
          messages: [],
        })
        .returning({ id: Session.id, title: Session.title });

      if (!newSession) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Failed to create session",
        });
      }

      return newSession;
    }),

  update: publicProcedure
    .input(
      z.object({
        sessionId: z.string(),
        title: z.string().optional(),
        messages: z.array(z.any()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { sessionId, ...updateData } = input;

      const [updatedSession] = await ctx.db
        .update(Session)
        .set(updateData)
        .where(eq(Session.id, sessionId))
        .returning();

      if (!updatedSession) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Session not found",
        });
      }

      return updatedSession;
    }),

  blenderAgent: publicProcedure.mutation(async ({ ctx }) => {
    await inngest.send({
      name: "blender-agent/run",
      data: {
        input:
          "Hello, I would like to create a new Blender project. Tell me what I need to do.",
      },
    });
  }),
};
