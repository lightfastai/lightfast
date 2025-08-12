import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure } from "../../trpc";
import { 
  db, 
  LightfastChatSession, 
  LightfastChatMessage, 
  LightfastChatStream,
  insertLightfastChatMessageSchema,
  insertLightfastChatStreamSchema
} from "@vendor/db";
import { eq, desc, and, inArray, sql } from "drizzle-orm";
import type { UIMessage } from "ai";

export const messageRouter = {
  /**
   * Append a message to a session
   */
  append: protectedProcedure
    .input(
      z.object({
        sessionId: z.string(),
        message: insertLightfastChatMessageSchema.pick({
          id: true,
          role: true,
          parts: true,
          modelId: true,
        }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify session ownership
      const session = await db
        .select({ id: LightfastChatSession.id })
        .from(LightfastChatSession)
        .where(
          and(
            eq(LightfastChatSession.id, input.sessionId),
            eq(LightfastChatSession.clerkUserId, ctx.session.userId!)
          )
        )
        .limit(1);

      if (!session[0]) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Session not found or access denied",
        });
      }

      // Insert the message
      await db.insert(LightfastChatMessage).values({
        sessionId: input.sessionId,
        role: input.message.role as "system" | "user" | "assistant",
        parts: input.message.parts,
        id: input.message.id,
        modelId: input.message.modelId,
      });

      // Update session's updatedAt timestamp using MySQL's CURRENT_TIMESTAMP
      await db
        .update(LightfastChatSession)
        .set({ updatedAt: sql`CURRENT_TIMESTAMP` })
        .where(eq(LightfastChatSession.id, input.sessionId));

      return { success: true };
    }),

  /**
   * Get messages for a session
   */
  list: protectedProcedure
    .input(
      z.object({
        sessionId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      // Verify session ownership
      const session = await db
        .select({ id: LightfastChatSession.id })
        .from(LightfastChatSession)
        .where(
          and(
            eq(LightfastChatSession.id, input.sessionId),
            eq(LightfastChatSession.clerkUserId, ctx.session.userId!)
          )
        )
        .limit(1);

      if (!session[0]) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Session not found or access denied",
        });
      }

      // Get messages
      const messages = await db
        .select()
        .from(LightfastChatMessage)
        .where(eq(LightfastChatMessage.sessionId, input.sessionId))
        .orderBy(LightfastChatMessage.createdAt);

      return messages.map((msg) => ({
        id: msg.id,
        role: msg.role,
        parts: msg.parts,
        modelId: msg.modelId,
      }));
    }),


  /**
   * Create a stream ID for a session
   */
  createStream: protectedProcedure
    .input(
      z.object({
        sessionId: z.string(),
        streamId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify session ownership
      const session = await db
        .select({ id: LightfastChatSession.id })
        .from(LightfastChatSession)
        .where(
          and(
            eq(LightfastChatSession.id, input.sessionId),
            eq(LightfastChatSession.clerkUserId, ctx.session.userId!)
          )
        )
        .limit(1);

      if (!session[0]) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Session not found or access denied",
        });
      }

      // Create the new stream
      await db.insert(LightfastChatStream).values({
        id: input.streamId,
        sessionId: input.sessionId,
      });

      return { success: true };
    }),

  /**
   * Get stream IDs for a session
   */
  getStreams: protectedProcedure
    .input(
      z.object({
        sessionId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      // Verify session ownership
      const session = await db
        .select({ id: LightfastChatSession.id })
        .from(LightfastChatSession)
        .where(
          and(
            eq(LightfastChatSession.id, input.sessionId),
            eq(LightfastChatSession.clerkUserId, ctx.session.userId!)
          )
        )
        .limit(1);

      if (!session[0]) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Session not found or access denied",
        });
      }

      // Get streams for this session, ordered by creation time (newest first)
      const streams = await db
        .select({ id: LightfastChatStream.id })
        .from(LightfastChatStream)
        .where(eq(LightfastChatStream.sessionId, input.sessionId))
        .orderBy(desc(LightfastChatStream.createdAt));

      return streams.map(stream => stream.id);
    }),
} satisfies TRPCRouterRecord;