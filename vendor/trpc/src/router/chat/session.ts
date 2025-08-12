import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure } from "../../trpc";
import { db, LightfastChatSession, LightfastChatMessage } from "@vendor/db";
import { desc, eq, lt, and } from "drizzle-orm";

export const sessionRouter = {
  /**
   * List user's chat sessions with cursor-based pagination
   */
  list: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(20),
        cursor: z.string().optional(), // Last session ID from previous page
      })
    )
    .query(async ({ ctx, input }) => {
      const whereConditions = [
        eq(LightfastChatSession.clerkUserId, ctx.session.userId!)
      ];

      // If cursor is provided, get sessions older than the cursor
      if (input.cursor) {
        // First get the cursor session's updatedAt timestamp
        const cursorSession = await db
          .select({ updatedAt: LightfastChatSession.updatedAt })
          .from(LightfastChatSession)
          .where(eq(LightfastChatSession.id, input.cursor))
          .limit(1);

        if (cursorSession[0]) {
          whereConditions.push(
            lt(LightfastChatSession.updatedAt, cursorSession[0].updatedAt)
          );
        }
      }

      const sessions = await db
        .select({
          id: LightfastChatSession.id,
          title: LightfastChatSession.title,
          pinned: LightfastChatSession.pinned,
          createdAt: LightfastChatSession.createdAt,
          updatedAt: LightfastChatSession.updatedAt,
        })
        .from(LightfastChatSession)
        .where(and(...whereConditions))
        .orderBy(desc(LightfastChatSession.updatedAt))
        .limit(input.limit);

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
        throw new TRPCError({ 
          code: "NOT_FOUND",
          message: "Session not found"
        });
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
   * Create a new session (with upsert behavior)
   * If the session already exists and belongs to the user, returns success
   * If it belongs to another user, throws FORBIDDEN error
   */
  create: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid("Session ID must be a valid UUID v4"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Try to create the session
        await db
          .insert(LightfastChatSession)
          .values({
            id: input.id,  // Use client-provided ID directly
            clerkUserId: ctx.session.userId!,
          })
          .execute();

        return { 
          id: input.id,
          success: true,
          created: true
        };
      } catch (error) {
        // Check if it's a duplicate key error
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const errorCode = (error as { code?: string })?.code;
        
        if (errorCode === 'ER_DUP_ENTRY' || errorMessage.includes('Duplicate entry')) {
          // Session already exists, verify ownership
          const session = await db
            .select({ id: LightfastChatSession.id })
            .from(LightfastChatSession)
            .where(
              and(
                eq(LightfastChatSession.id, input.id),
                eq(LightfastChatSession.clerkUserId, ctx.session.userId!)
              )
            )
            .limit(1);

          if (!session[0]) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "Session exists but belongs to another user",
            });
          }
          
          return { 
            id: input.id,
            success: true,
            created: false
          };
        }
        
        // Re-throw other database errors
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to create session: ${errorMessage}`,
        });
      }
    }),

  /**
   * Set pinned status of a session
   */
  setPinned: protectedProcedure
    .input(
      z.object({
        sessionId: z.string(),
        pinned: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify ownership
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
          message: "Session not found"
        });
      }

      // Set the pinned status explicitly
      await db
        .update(LightfastChatSession)
        .set({ pinned: input.pinned })
        .where(eq(LightfastChatSession.id, input.sessionId));

      return { success: true, pinned: input.pinned };
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
        throw new TRPCError({ 
          code: "NOT_FOUND",
          message: "Session not found"
        });
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