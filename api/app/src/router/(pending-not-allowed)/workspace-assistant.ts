import {
  createWorkspaceAssistantConversation,
  getWorkspaceAssistantConversationByPublicId,
  listWorkspaceAssistantConversations,
  listWorkspaceAssistantMessages,
} from "@db/app";
import { safeValidateLightfastUIMessages } from "@repo/ai/workspace-assistant";
import { TRPCError, type TRPCRouterRecord } from "@trpc/server";
import { z } from "zod";

import { boundOrgProcedure } from "../../trpc";

const conversationCursorInput = z
  .object({
    id: z.number().int().positive(),
    updatedAt: z.date(),
  })
  .strict();

const listConversationsInput = z
  .object({
    cursor: conversationCursorInput.nullish(),
    limit: z.number().int().min(1).max(100).optional(),
  })
  .strict()
  .optional();

const createConversationInput = z
  .object({
    publicId: z
      .string()
      .trim()
      .min(1)
      .max(80)
      .regex(/^conv_[A-Za-z0-9_-]+$/)
      .optional(),
    title: z.string().trim().min(1).max(160).optional(),
  })
  .strict()
  .optional();

const getConversationInput = z
  .object({
    id: z.string().trim().min(1),
  })
  .strict();

function notFound(): never {
  throw new TRPCError({
    code: "NOT_FOUND",
    message: "Workspace assistant conversation not found",
  });
}

export const workspaceAssistantRouter = {
  createConversation: boundOrgProcedure
    .input(createConversationInput)
    .mutation(({ ctx, input }) =>
      createWorkspaceAssistantConversation(ctx.db, {
        clerkOrgId: ctx.auth.identity.orgId,
        createdByUserId: ctx.auth.identity.userId,
        publicId: input?.publicId,
        title: input?.title,
      })
    ),

  getConversation: boundOrgProcedure
    .input(getConversationInput)
    .query(async ({ ctx, input }) => {
      const conversation = await getWorkspaceAssistantConversationByPublicId(
        ctx.db,
        {
          clerkOrgId: ctx.auth.identity.orgId,
          createdByUserId: ctx.auth.identity.userId,
          publicId: input.id,
        }
      );
      if (!conversation) {
        notFound();
      }

      const messages = await listWorkspaceAssistantMessages(ctx.db, {
        clerkOrgId: ctx.auth.identity.orgId,
        createdByUserId: ctx.auth.identity.userId,
        conversation,
      });
      const validated = await safeValidateLightfastUIMessages({
        messages: messages.map((message) => ({
          id: message.publicId,
          metadata: message.metadata,
          parts: message.parts,
          role: message.role,
        })),
      });
      if (!validated.success) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Persisted workspace assistant messages failed validation",
        });
      }

      return { messages, conversation };
    }),

  listConversations: boundOrgProcedure
    .input(listConversationsInput)
    .query(({ ctx, input }) =>
      listWorkspaceAssistantConversations(ctx.db, {
        clerkOrgId: ctx.auth.identity.orgId,
        createdByUserId: ctx.auth.identity.userId,
        cursor: input?.cursor ?? undefined,
        limit: input?.limit,
      })
    ),
} satisfies TRPCRouterRecord;
