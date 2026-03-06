import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@db/chat/client";
import {
  LightfastChatMessage,
  LightfastChatSession,
  LightfastChatSessionShare,
} from "@db/chat";
import { uuidv4 } from "@repo/lib/uuid";
import { computeMessageCharCount } from "@repo/chat-ai-types";

import { publicProcedure, protectedProcedure } from "../../trpc";

const createShareInput = z.object({
  sessionId: z.string(),
  expiresAt: z.string().datetime().optional(),
});

const getShareInput = z.object({
  shareId: z.string(),
});

export const shareRouter = {
  /**
   * Create a shareable link for a chat session.
   * Generates a stable identifier that can be used to access the session read-only.
   */
  create: protectedProcedure
    .input(createShareInput)
    .mutation(async ({ ctx, input }) => {
      const { sessionId, expiresAt } = input;

      // Verify that the session exists and belongs to the current user
      const session = await db
        .select({
          id: LightfastChatSession.id,
          title: LightfastChatSession.title,
          isTemporary: LightfastChatSession.isTemporary,
        })
        .from(LightfastChatSession)
        .where(
          and(
            eq(LightfastChatSession.id, sessionId),
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

      if (session[0].isTemporary) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Temporary chats cannot be shared",
        });
      }

      const shareId = uuidv4();

      await db.insert(LightfastChatSessionShare).values({
        id: shareId,
        sessionId,
        clerkUserId: ctx.session.userId,
        expiresAt: expiresAt ?? null,
      });

      return {
        shareId,
        sessionId,
        title: session[0].title,
        expiresAt: expiresAt ?? null,
      };
    }),

  /**
   * Fetch a shared session for public display.
   * Returns the share metadata, associated session information, and messages.
   */
  get: publicProcedure
    .input(getShareInput)
    .query(async ({ input }) => {
      const { shareId } = input;

      const shareRecords = await db
        .select({
          id: LightfastChatSessionShare.id,
          sessionId: LightfastChatSessionShare.sessionId,
          isActive: LightfastChatSessionShare.isActive,
          revokedAt: LightfastChatSessionShare.revokedAt,
          expiresAt: LightfastChatSessionShare.expiresAt,
          createdAt: LightfastChatSessionShare.createdAt,
          updatedAt: LightfastChatSessionShare.updatedAt,
        })
        .from(LightfastChatSessionShare)
        .where(eq(LightfastChatSessionShare.id, shareId))
        .limit(1);

      const share = shareRecords[0];

      if (!share?.isActive) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Share not found",
        });
      }

      if (share.revokedAt) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Share has been revoked",
        });
      }

      if (share.expiresAt) {
        const expiresAtDate = new Date(share.expiresAt);
        if (Number.isNaN(expiresAtDate.getTime()) || expiresAtDate < new Date()) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Share has expired",
          });
        }
      }

      // Ensure the underlying session still exists
      const sessionRecords = await db
        .select({
          id: LightfastChatSession.id,
          title: LightfastChatSession.title,
          updatedAt: LightfastChatSession.updatedAt,
          isTemporary: LightfastChatSession.isTemporary,
        })
        .from(LightfastChatSession)
        .where(eq(LightfastChatSession.id, share.sessionId))
        .limit(1);

      const session = sessionRecords[0];

      if (!session || session.isTemporary) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Session not available",
        });
      }

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
        .where(eq(LightfastChatMessage.sessionId, share.sessionId))
        .orderBy(asc(LightfastChatMessage.createdAt));

      return {
        share: {
          id: share.id,
          createdAt: share.createdAt,
          updatedAt: share.updatedAt,
          expiresAt: share.expiresAt,
        },
        session: {
          id: session.id,
          title: session.title,
          updatedAt: session.updatedAt,
        },
        messages: messages.map((message) => {
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
            createdAt: message.createdAt,
            metadata: {
              sessionId: share.sessionId,
              createdAt: message.createdAt,
              charCount: metrics.charCount,
              tokenCount: metrics.tokenCount ?? undefined,
              hasFullContent: true,
            },
          };
        }),
      };
    }),
} satisfies TRPCRouterRecord;
