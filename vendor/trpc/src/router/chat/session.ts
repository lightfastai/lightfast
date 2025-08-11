import type { TRPCRouterRecord } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure } from "../../trpc";
import { db, LightfastChatSession, LightfastChatMessage } from "@vendor/db";
import { desc, eq } from "drizzle-orm";

export const sessionRouter = {
  /**
   * List user's chat sessions
   */
  list: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const sessions = await db
        .select({
          id: LightfastChatSession.id,
          createdAt: LightfastChatSession.createdAt,
          updatedAt: LightfastChatSession.updatedAt,
        })
        .from(LightfastChatSession)
        .where(eq(LightfastChatSession.clerkUserId, ctx.session.userId!))
        .orderBy(desc(LightfastChatSession.updatedAt))
        .limit(input.limit)
        .offset(input.offset);

      return sessions;
    }),

  /**
   * Get a specific session with its messages
   */
  get: protectedProcedure
    .input(
      z.object({
        sessionId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      // Get the session
      const session = await db
        .select()
        .from(LightfastChatSession)
        .where(eq(LightfastChatSession.id, input.sessionId))
        .limit(1);

      if (!session[0] || session[0].clerkUserId !== ctx.session.userId!) {
        throw new Error("Session not found");
      }

      // Get messages for the session
      const messages = await db
        .select()
        .from(LightfastChatMessage)
        .where(eq(LightfastChatMessage.sessionId, input.sessionId))
        .orderBy(LightfastChatMessage.createdAt);

      return {
        session: session[0],
        messages,
      };
    }),

  /**
   * Create a new session
   */
  create: protectedProcedure
    .mutation(async ({ ctx }) => {
      const result = await db
        .insert(LightfastChatSession)
        .values({
          clerkUserId: ctx.session.userId!,
        });

      return { id: result.insertId };
    }),

  /**
   * Delete a session and its messages
   */
  delete: protectedProcedure
    .input(
      z.object({
        sessionId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify ownership
      const session = await db
        .select()
        .from(LightfastChatSession)
        .where(eq(LightfastChatSession.id, input.sessionId))
        .limit(1);

      if (!session[0] || session[0].clerkUserId !== ctx.session.userId!) {
        throw new Error("Session not found");
      }

      // Delete messages first
      await db
        .delete(LightfastChatMessage)
        .where(eq(LightfastChatMessage.sessionId, input.sessionId));

      // Delete the session
      await db
        .delete(LightfastChatSession)
        .where(eq(LightfastChatSession.id, input.sessionId));

      return { success: true };
    }),
} satisfies TRPCRouterRecord;