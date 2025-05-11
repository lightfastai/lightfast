import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { desc, eq } from "@vendor/db";
import { DBMessage, Session } from "@vendor/db/lightfast/schema";

import { publicProcedure } from "../../trpc";

export const sessionRouter = {
  get: publicProcedure
    .input(
      z.object({
        sessionId: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      // Use leftJoin to fetch session and related messages
      const [results] = await ctx.db.query.Session.findMany({
        with: {
          messages: true,
        },
        where: eq(Session.id, input.sessionId),
        orderBy: [desc(DBMessage.createdAt)],
      });

      if (!results) {
        // No session found at all
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Session not found",
        });
      }

      return results;
    }),

  list: publicProcedure.query(async ({ ctx }) => {
    const sessions = await ctx.db.query.Session.findMany({
      with: {
        messages: true,
      },
      orderBy: [desc(Session.updatedAt)],
    });

    return sessions;
  }),

  create: publicProcedure.mutation(async ({ ctx }) => {
    const [newSession] = await ctx.db
      .insert(Session)
      .values({
        title: "New Session",
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
};
