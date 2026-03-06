import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure } from "../../trpc";
import { db } from "@db/chat/client";
import {
  LightfastChatSession,
  LightfastChatMessage,
  LightfastChatMessageFeedback,
} from "@db/chat";
import { eq, and } from "drizzle-orm";

export const messageFeedbackRouter = {
  /**
   * Submit or update feedback for a message
   */
  submit: protectedProcedure
    .input(
      z.object({
        sessionId: z.string(),
        messageId: z.string(),
        feedbackType: z.enum(["upvote", "downvote"]),
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
            eq(LightfastChatSession.clerkUserId, ctx.session.userId)
          )
        )
        .limit(1);

      if (!session[0]) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Session not found or access denied",
        });
      }

      // Verify message exists in the session
      const message = await db
        .select({ id: LightfastChatMessage.id })
        .from(LightfastChatMessage)
        .where(
          and(
            eq(LightfastChatMessage.id, input.messageId),
            eq(LightfastChatMessage.sessionId, input.sessionId)
          )
        )
        .limit(1);

      if (!message[0]) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Message not found in this session",
        });
      }

      // Check if feedback already exists for this user and message
      const existingFeedback = await db
        .select({ id: LightfastChatMessageFeedback.id })
        .from(LightfastChatMessageFeedback)
        .where(
          and(
            eq(LightfastChatMessageFeedback.messageId, input.messageId),
            eq(LightfastChatMessageFeedback.clerkUserId, ctx.session.userId)
          )
        )
        .limit(1);

      if (existingFeedback[0]) {
        // Update existing feedback
        await db
          .update(LightfastChatMessageFeedback)
          .set({ 
            feedbackType: input.feedbackType,
          })
          .where(eq(LightfastChatMessageFeedback.id, existingFeedback[0].id));
      } else {
        // Create new feedback
        await db.insert(LightfastChatMessageFeedback).values({
          sessionId: input.sessionId,
          messageId: input.messageId,
          clerkUserId: ctx.session.userId,
          feedbackType: input.feedbackType,
        });
      }

      return { success: true };
    }),

  /**
   * Get feedback for messages in a session
   */
  getBySession: protectedProcedure
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
            eq(LightfastChatSession.clerkUserId, ctx.session.userId)
          )
        )
        .limit(1);

      if (!session[0]) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Session not found or access denied",
        });
      }

      // Get feedback for this session
      const feedback = await db
        .select({
          messageId: LightfastChatMessageFeedback.messageId,
          feedbackType: LightfastChatMessageFeedback.feedbackType,
        })
        .from(LightfastChatMessageFeedback)
        .where(
          and(
            eq(LightfastChatMessageFeedback.sessionId, input.sessionId),
            eq(LightfastChatMessageFeedback.clerkUserId, ctx.session.userId)
          )
        );

      // Return as a map for easy lookup
      return feedback.reduce((acc, fb) => {
        acc[fb.messageId] = fb.feedbackType;
        return acc;
      }, {} as Record<string, "upvote" | "downvote">);
    }),

  /**
   * Remove feedback for a message
   */
  remove: protectedProcedure
    .input(
      z.object({
        sessionId: z.string(),
        messageId: z.string(),
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
            eq(LightfastChatSession.clerkUserId, ctx.session.userId)
          )
        )
        .limit(1);

      if (!session[0]) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Session not found or access denied",
        });
      }

      // Remove feedback
      await db
        .delete(LightfastChatMessageFeedback)
        .where(
          and(
            eq(LightfastChatMessageFeedback.messageId, input.messageId),
            eq(LightfastChatMessageFeedback.sessionId, input.sessionId),
            eq(LightfastChatMessageFeedback.clerkUserId, ctx.session.userId)
          )
        );

      return { success: true };
    }),
} satisfies TRPCRouterRecord;