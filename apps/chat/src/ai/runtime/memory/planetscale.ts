import type { Memory } from "lightfast/memory";
import type { LightfastAppChatUIMessage } from "~/ai/lightfast-app-chat-ui-messages";
import type { ChatFetchContext } from "~/ai/lightfast-app-chat-ui-messages";
import { createCaller } from "~/trpc/server";
import { 
  isTRPCClientError, 
  getTRPCErrorCode, 
  getTRPCErrorMessage,
  isNotFound,
  isForbidden,
  isUnauthorized 
} from "~/lib/trpc-errors";

/**
 * PlanetScale implementation of Memory interface using tRPC for all database operations
 * This ensures consistent authentication and authorization across the app
 */
export class PlanetScaleMemory implements Memory<LightfastAppChatUIMessage, ChatFetchContext> {

	/**
	 * Append a single message to a session
	 */
	async appendMessage({
		sessionId,
		message,
		context,
	}: {
		sessionId: string;
		message: LightfastAppChatUIMessage;
		context: ChatFetchContext;
	}): Promise<void> {
		try {
			const caller = await createCaller();
			// Only set modelId for assistant messages
			const modelId = message.role === 'assistant' 
				? context.modelId 
				: null;
			
			await caller.message.append({
				sessionId,
				message: {
					id: message.id,
					role: message.role,
					parts: message.parts,
					modelId,
				},
			});
			
		} catch (error) {
			console.error('[PlanetScaleMemory] Failed to append message:', {
				sessionId,
				messageId: message.id,
				error: isTRPCClientError(error) ? {
					code: getTRPCErrorCode(error),
					message: getTRPCErrorMessage(error)
				} : error
			});
			
			// Re-throw with a more descriptive error for the AI SDK
			if (isUnauthorized(error)) {
				throw new Error('Unauthorized: User session expired or invalid');
			}
			if (isForbidden(error) || isNotFound(error)) {
				throw new Error(`Session ${sessionId} not found or access denied`);
			}
			
			throw new Error(`Failed to append message: ${getTRPCErrorMessage(error)}`);
		}
	}

	/**
	 * Get all messages for a session, ordered by creation time
	 */
	async getMessages(sessionId: string): Promise<LightfastAppChatUIMessage[]> {
		try {
			const caller = await createCaller();
			const messages = await caller.message.list({
				sessionId,
			});


			return messages as LightfastAppChatUIMessage[];
		} catch (error) {
			console.error('[PlanetScaleMemory] Failed to get messages:', {
				sessionId,
				error: isTRPCClientError(error) ? {
					code: getTRPCErrorCode(error),
					message: getTRPCErrorMessage(error)
				} : error
			});
			
			// For read operations, we might want to return empty array for NOT_FOUND
			if (isNotFound(error)) {
				console.warn(`Session ${sessionId} not found, returning empty messages`);
				return [];
			}
			
			if (isUnauthorized(error)) {
				throw new Error('Unauthorized: User session expired or invalid');
			}
			
			throw new Error(`Failed to get messages: ${getTRPCErrorMessage(error)}`);
		}
	}

	/**
	 * Create or ensure a session exists
	 * Uses client-provided sessionId directly as the primary key
	 */
	async createSession({
		sessionId,
		resourceId,
		context: _context,
	}: {
		sessionId: string;
		resourceId: string;
		context: ChatFetchContext;
	}): Promise<void> {
		try {
			// The resourceId is the Clerk user ID, but we're already authenticated via tRPC
			// Use the session router to create/ensure the session exists
			const caller = await createCaller();
			await caller.session.create({
				id: sessionId,
			});
		} catch (error) {
			console.error('[PlanetScaleMemory] Failed to create/ensure session:', {
				sessionId,
				resourceId,
				error: isTRPCClientError(error) ? {
					code: getTRPCErrorCode(error),
					message: getTRPCErrorMessage(error)
				} : error
			});
			
			// Handle specific error cases
			if (isUnauthorized(error)) {
				throw new Error('Unauthorized: User session expired or invalid');
			}
			if (isForbidden(error)) {
				throw new Error('Forbidden: Session belongs to another user');
			}
			
			throw new Error(`Failed to create session: ${getTRPCErrorMessage(error)}`);
		}
	}

	/**
	 * Get session by ID
	 * Returns the session data with the same ID provided
	 */
	async getSession(sessionId: string): Promise<{ resourceId: string; id: string } | null> {
		try {
			const caller = await createCaller();
			const session = await caller.session.getMetadata({
				sessionId,
			});
			
			return {
				resourceId: session.clerkUserId,
				id: session.id,
			};
		} catch (error) {
			// For read operations, return null for NOT_FOUND (session doesn't exist)
			// This is expected for new sessions that haven't been created yet
			if (isNotFound(error)) {
				// Debug log only - this is normal for new sessions
				console.debug(`[PlanetScaleMemory] Session ${sessionId} not found (expected for new sessions)`);
				return null;
			}
			
			// Log actual errors
			console.error('[PlanetScaleMemory] Failed to get session:', {
				sessionId,
				error: isTRPCClientError(error) ? {
					code: getTRPCErrorCode(error),
					message: getTRPCErrorMessage(error)
				} : error
			});
			
			// Handle auth errors
			if (isUnauthorized(error)) {
				throw new Error('Unauthorized: User session expired or invalid');
			}
			
			if (isForbidden(error)) {
				throw new Error(`Session ${sessionId} access denied`);
			}
			
			// For other errors, also return null to be graceful
			// but log the error for debugging
			console.warn(`Failed to get session ${sessionId}, returning null: ${getTRPCErrorMessage(error)}`);
			return null;
		}
	}

	/**
	 * Create a stream ID for a session
	 * This is used to track active streaming sessions for resume functionality
	 */
	async createStream({
		sessionId,
		streamId,
		context: _context,
	}: {
		sessionId: string;
		streamId: string;
		context: ChatFetchContext;
	}): Promise<void> {
		try {
			const caller = await createCaller();
			await caller.message.createStream({
				sessionId,
				streamId,
			});
		} catch (error) {
			console.error('[PlanetScaleMemory] Failed to create stream:', {
				sessionId,
				streamId,
				error: isTRPCClientError(error) ? {
					code: getTRPCErrorCode(error),
					message: getTRPCErrorMessage(error)
				} : error
			});
			
			// Stream creation errors are usually not critical
			// but we should still handle auth errors
			if (isUnauthorized(error)) {
				throw new Error('Unauthorized: User session expired or invalid');
			}
			
			if (isNotFound(error) || isForbidden(error)) {
				throw new Error(`Session ${sessionId} not found or access denied`);
			}
			
			// For other errors, log but don't throw to avoid breaking the stream
			console.warn(`Stream creation failed but continuing: ${getTRPCErrorMessage(error)}`);
		}
	}

	/**
	 * Get all stream IDs for a session, ordered by creation time (newest first)
	 * Returns the most recent streams for resume functionality
	 */
	async getSessionStreams(sessionId: string): Promise<string[]> {
		try {
			const caller = await createCaller();
			const streamIds = await caller.message.getStreams({
				sessionId,
			});

			return streamIds;
		} catch (error) {
			console.error('[PlanetScaleMemory] Failed to get stream IDs:', {
				sessionId,
				error: isTRPCClientError(error) ? {
					code: getTRPCErrorCode(error),
					message: getTRPCErrorMessage(error)
				} : error
			});
			
			// For read operations, return empty array for NOT_FOUND (session doesn't exist)
			if (isNotFound(error)) {
				console.warn(`Session ${sessionId} not found, returning empty stream IDs`);
				return [];
			}
			
			if (isUnauthorized(error)) {
				throw new Error('Unauthorized: User session expired or invalid');
			}
			
			// For other errors, return empty array to be graceful
			// but log the error for debugging
			console.warn(`Failed to get stream IDs for session ${sessionId}, returning empty array: ${getTRPCErrorMessage(error)}`);
			return [];
		}
	}
}