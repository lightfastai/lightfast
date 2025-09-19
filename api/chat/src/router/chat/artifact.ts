/**
 * Artifact router
 * Handles CRUD operations for chat artifacts (code, documents, etc.)
 */

import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { protectedProcedure } from "../../trpc";
import { db } from "@db/chat/client";
import {
	LightfastChatArtifact,
	LightfastChatSession,
	ARTIFACT_KINDS,
	insertLightfastChatArtifactSchema,
	selectLightfastChatArtifactSchema,
} from "@db/chat";

const artifactViewerSchema = z.object({
	id: z.string(),
	title: z.string(),
	content: z.string().nullable(),
	kind: z.enum(ARTIFACT_KINDS),
	createdAt: z.union([z.string(), z.date()]),
});

export const artifactRouter = {
  /**
   * Create or update an artifact
   */
  create: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        title: z.string(),
        content: z.string(),
        kind: z.enum(ARTIFACT_KINDS),
        sessionId: z.string(),
        messageId: z.string(),
      })
    )
    .output(selectLightfastChatArtifactSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, title, content, kind, sessionId, messageId } = input;

      // Verify session ownership
      const session = await db
        .select({ id: LightfastChatSession.id })
        .from(LightfastChatSession)
        .where(
          and(
            eq(LightfastChatSession.id, sessionId),
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

      // Insert or update artifact
      await db
        .insert(LightfastChatArtifact)
        .values({
          id,
          title,
          content,
          kind,
          sessionId,
          messageId,
          clerkUserId: ctx.session.userId,
        })
        .onDuplicateKeyUpdate({
          set: {
            title,
            content,
          },
        });

      // Return the created/updated artifact
      const [createdArtifact] = await db
        .select()
        .from(LightfastChatArtifact)
        .where(eq(LightfastChatArtifact.id, id))
        .limit(1);

      if (!createdArtifact) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create artifact",
        });
      }

      return createdArtifact;
    }),

  /**
   * Get an artifact by ID
   * Returns only the fields needed by the chat UI
   */
  get: protectedProcedure
    .input(
      z.object({
        id: z.string(),
      })
    )
    .output(artifactViewerSchema.nullable())
    .query(async ({ ctx, input }) => {
      const records = await db
        .select()
        .from(LightfastChatArtifact)
        .where(
          and(
            eq(LightfastChatArtifact.id, input.id),
            eq(LightfastChatArtifact.clerkUserId, ctx.session.userId)
          )
        )
        .limit(1);

      const artifact = records[0];

      if (!artifact) {
        return null;
      }

      return {
        id: artifact.id,
        title: artifact.title,
        content: artifact.content,
        kind: artifact.kind,
        createdAt: artifact.createdAt,
      };
    }),

  /**
   * List artifacts for a session
   */
  list: protectedProcedure
    .input(
      z.object({
        sessionId: z.string(),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      })
    )
    .output(z.array(selectLightfastChatArtifactSchema))
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

      const artifacts = await db
        .select()
        .from(LightfastChatArtifact)
        .where(eq(LightfastChatArtifact.sessionId, input.sessionId))
        .orderBy(LightfastChatArtifact.createdAt)
        .limit(input.limit)
        .offset(input.offset);

      return artifacts;
    }),

  /**
   * Delete an artifact
   */
  delete: protectedProcedure
    .input(
      z.object({
        id: z.string(),
      })
    )
    .output(z.boolean())
    .mutation(async ({ ctx, input }) => {
      // Verify ownership before deletion
      const artifact = await db
        .select({ id: LightfastChatArtifact.id })
        .from(LightfastChatArtifact)
        .where(
          and(
            eq(LightfastChatArtifact.id, input.id),
            eq(LightfastChatArtifact.clerkUserId, ctx.session.userId)
          )
        )
        .limit(1);

      if (!artifact[0]) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Artifact not found or access denied",
        });
      }

      // Delete the artifact
      await db
        .delete(LightfastChatArtifact)
        .where(eq(LightfastChatArtifact.id, input.id));

      return true;
    }),
} satisfies TRPCRouterRecord;
