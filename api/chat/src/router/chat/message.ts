import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure } from "../../trpc";
import { db } from "@db/chat/client";
import { 
  LightfastChatSession, 
  LightfastChatMessage, 
  LightfastChatStream,
  insertLightfastChatMessageSchema
} from "@db/chat";
import { eq, desc, and, or, lt, sql } from "drizzle-orm";
import { formatMySqlDateTime } from "@repo/lib/datetime";
import {
  computeMessageCharCount,
  createPreviewParts,
} from "@repo/chat-ai-types";
import { selectRecordsByCharBudget } from "./message-pagination";

const OVERSIZED_PREVIEW_CHAR_LIMIT = 2_000;

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

      const metrics = computeMessageCharCount(
        input.message.parts as unknown as Parameters<
          typeof computeMessageCharCount
        >[0],
      );

      // Insert the message
      await db.insert(LightfastChatMessage).values({
        sessionId: input.sessionId,
        role: input.message.role as "system" | "user" | "assistant",
        parts: input.message.parts,
        id: input.message.id,
        modelId: input.message.modelId,
        charCount: metrics.charCount,
        tokenCount: metrics.tokenCount ?? null,
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

      // Get messages
      const messages = await db
        .select({
          id: LightfastChatMessage.id,
          role: LightfastChatMessage.role,
          parts: LightfastChatMessage.parts,
          modelId: LightfastChatMessage.modelId,
          createdAt: LightfastChatMessage.createdAt,
          charCount: LightfastChatMessage.charCount,
          tokenCount: LightfastChatMessage.tokenCount,
        })
        .from(LightfastChatMessage)
        .where(eq(LightfastChatMessage.sessionId, input.sessionId))
        .orderBy(LightfastChatMessage.createdAt);

      return messages.map((msg) => {
        const charMetrics =
          msg.charCount && msg.charCount > 0
            ? { charCount: msg.charCount, tokenCount: msg.tokenCount ?? undefined }
            : computeMessageCharCount(
                msg.parts as unknown as Parameters<
                  typeof computeMessageCharCount
                >[0],
              );

        return {
          id: msg.id,
          role: msg.role,
          parts: msg.parts,
          modelId: msg.modelId,
          metadata: {
            sessionId: input.sessionId,
            createdAt: msg.createdAt,
            charCount: charMetrics.charCount,
            tokenCount: charMetrics.tokenCount ?? undefined,
            hasFullContent: true,
          },
        };
      });
    }),

  /**
   * Paginated messages for streaming long histories
   */
  listInfinite: protectedProcedure
    .input(
      z.object({
        sessionId: z.string(),
        limitChars: z.number().min(1).max(500_000).optional(),
        limitMessages: z.number().min(1).max(200).optional(),
        limit: z.number().min(1).max(200).optional(),
        cursor: z
          .object({
            createdAt: z.string(),
            id: z.string(),
          })
          .nullish(),
      })
    )
    .query(async ({ ctx, input }) => {
      const session = await db
        .select({ id: LightfastChatSession.id })
        .from(LightfastChatSession)
        .where(
          and(
            eq(LightfastChatSession.id, input.sessionId),
            eq(LightfastChatSession.clerkUserId, ctx.session.userId),
          ),
        )
        .limit(1);

      if (!session[0]) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Session not found or access denied",
        });
      }

      const limitMessages = input.limitMessages ?? input.limit ?? 40;
      const messageLimit = Math.max(1, Math.min(limitMessages, 200));
      const charLimit = input.limitChars ?? null;

      const baseCondition = eq(
        LightfastChatMessage.sessionId,
        input.sessionId,
      );

      const whereCondition = input.cursor
        ? (() => {
            const cursorDate = new Date(input.cursor.createdAt);
            const cursorCreatedAt = formatMySqlDateTime(cursorDate);
            return and(
              baseCondition,
              or(
                lt(LightfastChatMessage.createdAt, cursorCreatedAt),
                and(
                  eq(LightfastChatMessage.createdAt, cursorCreatedAt),
                  lt(LightfastChatMessage.id, input.cursor.id),
                ),
              ),
            );
          })()
        : baseCondition;

      const records = await db
        .select({
          id: LightfastChatMessage.id,
          role: LightfastChatMessage.role,
          parts: LightfastChatMessage.parts,
          modelId: LightfastChatMessage.modelId,
          createdAt: LightfastChatMessage.createdAt,
          charCount: LightfastChatMessage.charCount,
          tokenCount: LightfastChatMessage.tokenCount,
        })
        .from(LightfastChatMessage)
        .where(whereCondition)
        .orderBy(desc(LightfastChatMessage.createdAt), desc(LightfastChatMessage.id))
        .limit(messageLimit + 1);

      const hasMoreRecordsThanPage = records.length > messageLimit;
      const pageCandidates = hasMoreRecordsThanPage
        ? records.slice(0, messageLimit)
        : records;

      const normalizedCandidates = pageCandidates.map((candidate) => {
        const computedMetrics =
          candidate.charCount && candidate.charCount > 0
            ? {
                charCount: candidate.charCount,
                tokenCount: candidate.tokenCount ?? undefined,
              }
            : computeMessageCharCount(
                candidate.parts as unknown as Parameters<
                  typeof computeMessageCharCount
                >[0],
              );

        return {
          ...candidate,
          charCount: computedMetrics.charCount,
          tokenCount: computedMetrics.tokenCount ?? null,
        };
      });

      const pagination = selectRecordsByCharBudget(
        normalizedCandidates,
        charLimit,
      );

      const hasMore =
        hasMoreRecordsThanPage ||
        pagination.hitCharBudget ||
        pagination.selectedRecords.length < normalizedCandidates.length;

      const items = pagination.selectedRecords
        .slice()
        .reverse()
        .map((msg) => {
          const tooLarge =
            charLimit !== null && pagination.oversizeRecordId === msg.id;

          const previewLimit = tooLarge
            ? Math.min(charLimit ?? OVERSIZED_PREVIEW_CHAR_LIMIT, OVERSIZED_PREVIEW_CHAR_LIMIT)
            : charLimit ?? OVERSIZED_PREVIEW_CHAR_LIMIT;

          const preview = tooLarge
            ? createPreviewParts(
                msg.parts as unknown as Parameters<typeof createPreviewParts>[0],
                previewLimit,
              )
            : null;

          return {
            id: msg.id,
            role: msg.role,
            parts: (preview?.parts ?? msg.parts) as typeof msg.parts,
            modelId: msg.modelId,
            metadata: {
              sessionId: input.sessionId,
              createdAt: msg.createdAt,
              charCount: msg.charCount,
              tokenCount: msg.tokenCount ?? undefined,
              previewCharCount: preview?.previewCharCount,
              tooLarge,
              hasFullContent: !tooLarge,
            },
          };
        });

      const nextCursor = hasMore && pagination.selectedRecords.length > 0
        ? {
            createdAt:
              pagination.selectedRecords[pagination.selectedRecords.length - 1]!
                .createdAt,
            id: pagination.selectedRecords[pagination.selectedRecords.length - 1]!.id,
          }
        : null;

      return {
        items,
        nextCursor,
        pageCharCount: pagination.accumulatedChars,
        pageMessageCount: items.length,
        exhaustedCharBudget: pagination.hitCharBudget,
        exhaustedMessageBudget: hasMoreRecordsThanPage,
      };
    }),

  /**
   * Fetch a single message in full (used for oversized previews)
   */
  get: protectedProcedure
    .input(
      z.object({
        sessionId: z.string(),
        messageId: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const session = await db
        .select({ id: LightfastChatSession.id })
        .from(LightfastChatSession)
        .where(
          and(
            eq(LightfastChatSession.id, input.sessionId),
            eq(LightfastChatSession.clerkUserId, ctx.session.userId),
          ),
        )
        .limit(1);

      if (!session[0]) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Session not found or access denied",
        });
      }

      const messageRecords = await db
        .select({
          id: LightfastChatMessage.id,
          role: LightfastChatMessage.role,
          parts: LightfastChatMessage.parts,
          modelId: LightfastChatMessage.modelId,
          createdAt: LightfastChatMessage.createdAt,
          charCount: LightfastChatMessage.charCount,
          tokenCount: LightfastChatMessage.tokenCount,
        })
        .from(LightfastChatMessage)
        .where(
          and(
            eq(LightfastChatMessage.sessionId, input.sessionId),
            eq(LightfastChatMessage.id, input.messageId),
          ),
        )
        .limit(1);

      const message = messageRecords[0];

      if (!message) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Message not found",
        });
      }

      const metrics =
        message.charCount && message.charCount > 0
          ? { charCount: message.charCount, tokenCount: message.tokenCount ?? undefined }
          : computeMessageCharCount(
              message.parts as unknown as Parameters<typeof computeMessageCharCount>[0],
            );

      return {
        id: message.id,
        role: message.role,
        parts: message.parts,
        modelId: message.modelId,
        metadata: {
          sessionId: input.sessionId,
          createdAt: message.createdAt,
          charCount: metrics.charCount,
          tokenCount: metrics.tokenCount ?? undefined,
          hasFullContent: true,
        },
      };
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

      // Get streams for this session, ordered by creation time (newest first)
      const streams = await db
        .select({ id: LightfastChatStream.id })
        .from(LightfastChatStream)
        .where(eq(LightfastChatStream.sessionId, input.sessionId))
        .orderBy(desc(LightfastChatStream.createdAt));

      return streams.map(stream => stream.id);
    }),
} satisfies TRPCRouterRecord;
