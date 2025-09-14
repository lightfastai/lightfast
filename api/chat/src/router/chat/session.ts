import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure } from "../../trpc";
import { db } from "@db/chat/client";
import {
	LightfastChatSession,
	LightfastChatMessage,
	DEFAULT_SESSION_TITLE,
} from "@db/chat";
import { desc, eq, lt, and, like, sql } from "drizzle-orm";
import { inngest } from "../../inngest/client/client";

export const sessionRouter = {
	/**
	 * List user's chat sessions with cursor-based pagination
	 */
	list: protectedProcedure
		.input(
			z.object({
				limit: z.number().min(1).max(100).default(20),
				cursor: z.string().nullish(), // Last session ID from previous page
			}),
		)
		.query(async ({ ctx, input }) => {
			const whereConditions = [
				eq(LightfastChatSession.clerkUserId, ctx.session.userId),
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
						lt(LightfastChatSession.updatedAt, cursorSession[0].updatedAt),
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
	 * List user's pinned chat sessions
	 */
	listPinned: protectedProcedure.query(async ({ ctx }) => {
		const sessions = await db
			.select({
				id: LightfastChatSession.id,
				title: LightfastChatSession.title,
				pinned: LightfastChatSession.pinned,
				createdAt: LightfastChatSession.createdAt,
				updatedAt: LightfastChatSession.updatedAt,
			})
			.from(LightfastChatSession)
			.where(
				and(
					eq(LightfastChatSession.clerkUserId, ctx.session.userId),
					eq(LightfastChatSession.pinned, true),
				),
			)
			.orderBy(desc(LightfastChatSession.updatedAt));

		return sessions;
	}),

	/**
	 * Search sessions by title
	 */
	search: protectedProcedure
		.input(
			z.object({
				query: z.string().min(1).max(100),
				limit: z.number().min(1).max(50).default(20),
			}),
		)
		.query(async ({ ctx, input }) => {
			// Prepare search term for LIKE query (case-insensitive)
			const searchTerm = `%${input.query}%`;

			const sessions = await db
				.select({
					id: LightfastChatSession.id,
					title: LightfastChatSession.title,
					pinned: LightfastChatSession.pinned,
					createdAt: LightfastChatSession.createdAt,
					updatedAt: LightfastChatSession.updatedAt,
				})
				.from(LightfastChatSession)
				.where(
					and(
						eq(LightfastChatSession.clerkUserId, ctx.session.userId),
						like(LightfastChatSession.title, searchTerm),
					),
				)
				.orderBy(
					// Order by relevance: exact match first, then starts with, then contains
					sql`CASE 
            WHEN ${LightfastChatSession.title} = ${input.query} THEN 0
            WHEN ${LightfastChatSession.title} LIKE ${input.query + "%"} THEN 1
            ELSE 2
          END`,
					desc(LightfastChatSession.updatedAt),
				)
				.limit(input.limit);

			return sessions;
		}),

	/**
	 * Get session metadata only (without messages)
	 * Used by the AI memory system to check session ownership
	 */
	getMetadata: protectedProcedure
		.input(
			z.object({
				sessionId: z.string(),
			}),
		)
		.query(async ({ ctx, input }) => {
			// Get the session metadata only
			const session = await db
				.select({
					id: LightfastChatSession.id,
					clerkUserId: LightfastChatSession.clerkUserId,
					title: LightfastChatSession.title,
					pinned: LightfastChatSession.pinned,
					createdAt: LightfastChatSession.createdAt,
					updatedAt: LightfastChatSession.updatedAt,
				})
				.from(LightfastChatSession)
				.where(eq(LightfastChatSession.id, input.sessionId))
				.limit(1);

			if (!session[0] || session[0].clerkUserId !== ctx.session.userId) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Session not found",
				});
			}

			return session[0];
		}),

	/**
	 * Create a new session (with upsert behavior)
	 * If the session already exists and belongs to the user, returns success
	 * If it belongs to another user, throws FORBIDDEN error
	 * Triggers title generation if firstMessage is provided
	 */
	create: protectedProcedure
		.input(
			z.object({
				id: z.string().uuid("Session ID must be a valid UUID v4"),
				firstMessage: z.string().min(1).optional(), // Optional for internal calls, but should be provided from UI
			}),
		)
		.mutation(async ({ ctx, input }) => {
			try {
				// Try to create the session
				await db
					.insert(LightfastChatSession)
					.values({
						id: input.id, // Use client-provided ID directly
						clerkUserId: ctx.session.userId,
					})
					.execute();

				// Trigger title generation for the new session if firstMessage is provided
				if (input.firstMessage) {
					await inngest
						.send({
							name: "apps-chat/generate-title",
							data: {
								sessionId: input.id,
								userId: ctx.session.userId,
								firstMessage: input.firstMessage,
							},
						})
						.catch((error) => {
							console.error("Failed to trigger title generation:", error);
						});
				}

				return {
					id: input.id,
					success: true,
					created: true,
				};
			} catch (error) {
				// Check if it's a duplicate key error
				const errorMessage =
					error instanceof Error ? error.message : "Unknown error";
				const errorCode = (error as { code?: string })?.code;

				if (
					errorCode === "ER_DUP_ENTRY" ||
					errorMessage.includes("Duplicate entry")
				) {
					// Session already exists, verify ownership
					const session = await db
						.select({ id: LightfastChatSession.id })
						.from(LightfastChatSession)
						.where(
							and(
								eq(LightfastChatSession.id, input.id),
								eq(LightfastChatSession.clerkUserId, ctx.session.userId),
							),
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
						created: false,
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
			}),
		)
		.mutation(async ({ ctx, input }) => {
			// Verify ownership
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
					message: "Session not found",
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
			}),
		)
		.mutation(async ({ ctx, input }) => {
			// Verify ownership
			const session = await db
				.select()
				.from(LightfastChatSession)
				.where(eq(LightfastChatSession.id, input.sessionId))
				.limit(1);

			if (!session[0] || session[0].clerkUserId !== ctx.session.userId) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Session not found",
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

	/**
	 * Set active stream ID for resumable streams
	 * Used by the AI runtime to track streaming sessions
	 */
	setActiveStream: protectedProcedure
		.input(
			z.object({
				sessionId: z.string(),
				streamId: z.string(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			// Verify ownership first
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
					message: "Session not found",
				});
			}

			// Set the active stream ID
			await db
				.update(LightfastChatSession)
				.set({ activeStreamId: input.streamId })
				.where(eq(LightfastChatSession.id, input.sessionId));

			return { success: true };
		}),

	/**
	 * Get active stream ID for resumable streams
	 * Returns null if no active stream exists
	 */
	getActiveStream: protectedProcedure
		.input(
			z.object({
				sessionId: z.string(),
			}),
		)
		.query(async ({ ctx, input }) => {
			// Verify ownership and get active stream ID
			const session = await db
				.select({ 
					id: LightfastChatSession.id,
					activeStreamId: LightfastChatSession.activeStreamId,
				})
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
					message: "Session not found",
				});
			}

			return {
				activeStreamId: session[0].activeStreamId,
			};
		}),

	/**
	 * Clear active stream ID (called when streaming completes)
	 */
	clearActiveStream: protectedProcedure
		.input(
			z.object({
				sessionId: z.string(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			// Verify ownership first
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
					message: "Session not found",
				});
			}

			// Clear the active stream ID
			await db
				.update(LightfastChatSession)
				.set({ activeStreamId: null })
				.where(eq(LightfastChatSession.id, input.sessionId));

			return { success: true };
		}),
} satisfies TRPCRouterRecord;

