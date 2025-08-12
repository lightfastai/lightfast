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
	 * Helper to resolve a sessionId (which might be a clientSessionId) to the actual database ID
	 * Throws an error if the session doesn't exist to prevent foreign key violations
	 */
	private async resolveSessionId(sessionId: string): Promise<string> {
		// First try to find by clientSessionId
		const sessionByClientId = await db
			.select({ id: LightfastChatSession.id })
			.from(LightfastChatSession)
			.where(eq(LightfastChatSession.clientSessionId, sessionId))
			.limit(1);

		if (sessionByClientId[0]) {
			return sessionByClientId[0].id;
		}

		// Then try to find by actual database ID
		const sessionById = await db
			.select({ id: LightfastChatSession.id })
			.from(LightfastChatSession)
			.where(eq(LightfastChatSession.id, sessionId))
			.limit(1);

		if (sessionById[0]) {
			return sessionById[0].id;
		}

		// Session doesn't exist - throw error to prevent foreign key violations
		throw new Error(`Session not found: ${sessionId}. Ensure session is created before adding messages.`);
	}
	/**
	 * Append a single message to a session
	 * Resolves clientSessionId to database ID if needed
	 */
	async appendMessage({
		sessionId,
		message,
	}: {
		sessionId: string;
		message: LightfastAppChatUIMessage;
	}): Promise<void> {
		try {
			// Resolve sessionId to actual database ID
			const actualSessionId = await this.resolveSessionId(sessionId);
			
			await db.insert(LightfastChatMessage).values({
				sessionId: actualSessionId,
				role: message.role,
				parts: message.parts,
				id: message.id,
			});
		} catch (error: any) {
			// If session doesn't exist, provide helpful error message
			if (error?.message?.includes('Session not found')) {
				throw new Error(`Cannot append message: ${error.message}`);
			}
			throw error;
		}
	}


	/**
	 * Get all messages for a session, ordered by creation time
	 */
	async getMessages(sessionId: string): Promise<LightfastAppChatUIMessage[]> {
		try {
			// Resolve sessionId to actual database ID
			const actualSessionId = await this.resolveSessionId(sessionId);
			
			const messages = await db
				.select()
				.from(LightfastChatMessage)
				.where(eq(LightfastChatMessage.sessionId, actualSessionId))
				.orderBy(LightfastChatMessage.createdAt);

			return messages.map((msg) => ({
				id: msg.id,
				role: msg.role,
				parts: msg.parts,
			})) as LightfastAppChatUIMessage[];
		} catch (error: any) {
			// Return empty array if session doesn't exist yet
			// This is common for new sessions
			if (error?.message?.includes('Session not found')) {
				return [];
			}
			throw error;
		}
	}

	/**
	 * Create a new session
	 * Uses database constraints to prevent duplicate sessions (handles race conditions)
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
				.where(eq(LightfastChatSession.clientSessionId, sessionId))
				.limit(1);

			if (existingSession.length > 0) {
				return; // Session already exists, nothing to do
			}

			// Attempt to create the session
			// This will fail with a unique constraint violation if another request
			// created the session between our check and insert
			await db.insert(LightfastChatSession).values({
				clerkUserId: resourceId, // resourceId is the Clerk user ID
				clientSessionId: sessionId, // Use sessionId as clientSessionId
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
	 * Get session by client session ID or database ID
	 * First tries to find by clientSessionId, then falls back to id for backward compatibility
	 */
	async getSession(sessionId: string): Promise<{ resourceId: string; id: string } | null> {
		// First try to find by clientSessionId
		let sessions = await db
			.select()
			.from(LightfastChatSession)
			.where(eq(LightfastChatSession.clientSessionId, sessionId))
			.limit(1);

		// If not found, try by id for backward compatibility
		if (sessions.length === 0) {
			sessions = await db
				.select()
				.from(LightfastChatSession)
				.where(eq(LightfastChatSession.id, sessionId))
				.limit(1);
		}

		if (sessions.length === 0) {
			return null;
		}

		const firstSession = sessions[0];
		if (!firstSession) {
			return null;
		}
		return {
			resourceId: firstSession.clerkUserId,
			id: firstSession.id, // Return the actual database ID
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
		try {
			// Resolve sessionId to actual database ID
			const actualSessionId = await this.resolveSessionId(sessionId);
			
			// Create the new stream
			await db.insert(LightfastChatStream).values({
				id: streamId,
				sessionId: actualSessionId,
			});

			// Clean up old streams (keep only the most recent 100)
			// This prevents unbounded growth of stream records
			await this.cleanupOldStreams(actualSessionId);
		} catch (error: any) {
			if (error?.message?.includes('Session not found')) {
				throw new Error(`Cannot create stream: ${error.message}`);
			}
			throw error;
		}
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
		try {
			// Resolve sessionId to actual database ID
			const actualSessionId = await this.resolveSessionId(sessionId);
			
			const streams = await db
				.select()
				.from(LightfastChatStream)
				.where(eq(LightfastChatStream.sessionId, actualSessionId))
				.orderBy(desc(LightfastChatStream.createdAt))
				.limit(100); // Keep last 100 streams

			return streams.map((stream) => stream.id);
		} catch (error: any) {
			// Return empty array if session doesn't exist
			if (error?.message?.includes('Session not found')) {
				return [];
			}
			throw error;
		}
	}
}
