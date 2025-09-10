/**
 * Artifact router
 * Handles CRUD operations for chat artifacts (code, documents, etc.)
 */

import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "../../trpc";
import { 
  LightfastChatArtifact,
  ARTIFACT_KINDS,
  insertLightfastChatArtifactSchema,
  selectLightfastChatArtifactSchema,
} from "db/chat/src/schema/tables/artifact";

export const artifactRouter = createTRPCRouter({
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
      })
    )
    .output(selectLightfastChatArtifactSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, title, content, kind, sessionId } = input;

      // Insert or update artifact
      const [artifact] = await ctx.db
        .insert(LightfastChatArtifact)
        .values({
          id,
          title,
          content,
          kind,
          sessionId,
          clerkUserId: ctx.auth.userId,
        })
        .onDuplicateKeyUpdate({
          set: {
            title,
            content,
          },
        });

      return artifact;
    }),

  /**
   * Get an artifact by ID
   */
  get: protectedProcedure
    .input(
      z.object({
        id: z.string(),
      })
    )
    .output(selectLightfastChatArtifactSchema.nullable())
    .query(async ({ ctx, input }) => {
      const artifact = await ctx.db
        .select()
        .from(LightfastChatArtifact)
        .where(
          and(
            eq(LightfastChatArtifact.id, input.id),
            eq(LightfastChatArtifact.clerkUserId, ctx.auth.userId)
          )
        )
        .limit(1);

      return artifact[0] || null;
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
      const artifacts = await ctx.db
        .select()
        .from(LightfastChatArtifact)
        .where(
          and(
            eq(LightfastChatArtifact.sessionId, input.sessionId),
            eq(LightfastChatArtifact.clerkUserId, ctx.auth.userId)
          )
        )
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
      const result = await ctx.db
        .delete(LightfastChatArtifact)
        .where(
          and(
            eq(LightfastChatArtifact.id, input.id),
            eq(LightfastChatArtifact.clerkUserId, ctx.auth.userId)
          )
        );

      return result.affectedRows > 0;
    }),
});