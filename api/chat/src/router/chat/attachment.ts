import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure } from "../../trpc";
import { db } from "@db/chat/client";
import { LightfastChatAttachment } from "@db/chat";
import { eq } from "drizzle-orm";

export const attachmentRouter = {
	/**
	 * List all attachments for the current user
	 */
	list: protectedProcedure.query(async ({ ctx }) => {
		const attachments = await db
			.select({
				id: LightfastChatAttachment.id,
				storagePath: LightfastChatAttachment.storagePath,
				filename: LightfastChatAttachment.filename,
				contentType: LightfastChatAttachment.contentType,
				size: LightfastChatAttachment.size,
				metadata: LightfastChatAttachment.metadata,
				createdAt: LightfastChatAttachment.createdAt,
			})
			.from(LightfastChatAttachment)
			.where(eq(LightfastChatAttachment.userId, ctx.session.userId));

		return attachments;
	}),

	/**
	 * Delete an attachment
	 */
	delete: protectedProcedure
		.input(
			z.object({
				attachmentId: z.string(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			// Verify attachment belongs to user
			const attachment = await db
				.select({
					id: LightfastChatAttachment.id,
					storagePath: LightfastChatAttachment.storagePath,
				})
				.from(LightfastChatAttachment)
				.where(eq(LightfastChatAttachment.id, input.attachmentId))
				.limit(1);

			if (!attachment[0]) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Attachment not found",
				});
			}

			// Verify ownership
			const userAttachment = await db
				.select({ id: LightfastChatAttachment.id })
				.from(LightfastChatAttachment)
				.where(eq(LightfastChatAttachment.userId, ctx.session.userId))
				.limit(1);

			if (!userAttachment[0]) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "Access denied",
				});
			}

			// Delete from database
			await db
				.delete(LightfastChatAttachment)
				.where(eq(LightfastChatAttachment.id, input.attachmentId));

			// Note: Vercel Blob deletion would require additional API call
			// For now, we only delete the database record
			// TODO: Implement blob storage cleanup

			return { success: true };
		}),
} satisfies TRPCRouterRecord;
