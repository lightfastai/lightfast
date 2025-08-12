import type { Memory } from "@lightfast/core/memory";
import type { LightfastAppChatUIMessage } from "~/ai/lightfast-app-chat-ui-messages";
import { db } from "@vendor/db/client";
import {
	LightfastChatSession,
	LightfastChatMessage,
	LightfastChatStream,
} from "@vendor/db/lightfast/schema";
import { eq, desc, inArray } from "drizzle-orm";

/**
 * PlanetScale implementation of Memory interface for chat persistence
 * Uses the vendor/db PlanetScale connection with Drizzle ORM
 */
export class PlanetScaleMemory implements Memory<LightfastAppChatUIMessage> {
	/**
	 * Append a single message to a session
	 * Uses the sessionId directly as it's now the primary key
	 */
	async appendMessage({
		sessionId,
		message,
	}: {
		sessionId: string;
		message: LightfastAppChatUIMessage;
	}): Promise<void> {
		await db.insert(LightfastChatMessage).values({
			sessionId,
			role: message.role,
			parts: message.parts,
			id: message.id,
		});
	}


	/**
	 * Get all messages for a session, ordered by creation time
	 */
	async getMessages(sessionId: string): Promise<LightfastAppChatUIMessage[]> {
		const messages = await db
			.select()
			.from(LightfastChatMessage)
			.where(eq(LightfastChatMessage.sessionId, sessionId))
			.orderBy(LightfastChatMessage.createdAt);

		return messages.map((msg) => ({
			id: msg.id,
			role: msg.role,
			parts: msg.parts,
		})) as LightfastAppChatUIMessage[];
	}

	/**
	 * Create a new session
	 * Client provides the ID directly, database enforces uniqueness
	 */
	async createSession({
		sessionId,
		resourceId,
	}: {
		sessionId: string;
		resourceId: string;
	}): Promise<void> {
		try {
			// First check if session already exists (for performance)
			const existingSession = await db
				.select({ id: LightfastChatSession.id })
				.from(LightfastChatSession)
				.where(eq(LightfastChatSession.id, sessionId))
				.limit(1);

			if (existingSession.length > 0) {
				return; // Session already exists, nothing to do
			}

			// Attempt to create the session with client-provided ID
			// This will fail with a unique constraint violation if another request
			// created the session between our check and insert
			await db.insert(LightfastChatSession).values({
				id: sessionId, // Use client-provided ID directly
				clerkUserId: resourceId, // resourceId is the Clerk user ID
			});
		} catch (error: any) {
			// Check if this is a unique constraint violation
			// MySQL error code 1062 is for duplicate entry
			if (error?.code === 'ER_DUP_ENTRY' || error?.message?.includes('Duplicate entry')) {
				// Session was created by another request, this is fine
				return;
			}
			
			// Re-throw other errors
			throw new Error(`Failed to create session: ${error?.message || 'Unknown error'}`);
		}
	}

	/**
	 * Get session by ID
	 * Returns the session data with the same ID provided
	 */
	async getSession(sessionId: string): Promise<{ resourceId: string; id: string } | null> {
		const sessions = await db
			.select()
			.from(LightfastChatSession)
			.where(eq(LightfastChatSession.id, sessionId))
			.limit(1);

		if (sessions.length === 0) {
			return null;
		}

		const firstSession = sessions[0];
		if (!firstSession) {
			return null;
		}
		return {
			resourceId: firstSession.clerkUserId,
			id: firstSession.id, // Return the same ID
		};
	}

	/**
	 * Create a stream ID for a session
	 * This is used to track active streaming sessions for resume functionality
	 * Automatically cleans up old streams to prevent unbounded growth
	 */
	async createStream({
		sessionId,
		streamId,
	}: {
		sessionId: string;
		streamId: string;
	}): Promise<void> {
		// Create the new stream
		await db.insert(LightfastChatStream).values({
			id: streamId,
			sessionId,
		});

		// Clean up old streams (keep only the most recent 100)
		// This prevents unbounded growth of stream records
		await this.cleanupOldStreams(sessionId);
	}

	/**
	 * Clean up old streams for a session, keeping only the most recent ones
	 * This prevents unbounded growth of stream records in the database
	 */
	private async cleanupOldStreams(sessionId: string, keepCount: number = 100): Promise<void> {
		try {
			// Get all streams for this session, ordered by creation time
			const allStreams = await db
				.select({ id: LightfastChatStream.id, createdAt: LightfastChatStream.createdAt })
				.from(LightfastChatStream)
				.where(eq(LightfastChatStream.sessionId, sessionId))
				.orderBy(desc(LightfastChatStream.createdAt));

			// If we have more than keepCount streams, delete the oldest ones
			if (allStreams.length > keepCount) {
				const streamsToDelete = allStreams.slice(keepCount);
				const idsToDelete = streamsToDelete.map(s => s.id);

				// Delete old streams in batches to avoid query size limits
				const batchSize = 100;
				for (let i = 0; i < idsToDelete.length; i += batchSize) {
					const batch = idsToDelete.slice(i, i + batchSize);
					
					// Use Drizzle's inArray for efficient batch deletion
					await db
						.delete(LightfastChatStream)
						.where(inArray(LightfastChatStream.id, batch));
				}
			}
		} catch (error) {
			// Log but don't throw - cleanup failure shouldn't block stream creation
			console.error('Failed to cleanup old streams:', error);
		}
	}

	/**
	 * Get all stream IDs for a session, ordered by creation time (newest first)
	 * Returns the most recent streams for resume functionality
	 */
	async getSessionStreams(sessionId: string): Promise<string[]> {
		const streams = await db
			.select()
			.from(LightfastChatStream)
			.where(eq(LightfastChatStream.sessionId, sessionId))
			.orderBy(desc(LightfastChatStream.createdAt))
			.limit(100); // Keep last 100 streams

		return streams.map((stream) => stream.id);
	}
}
