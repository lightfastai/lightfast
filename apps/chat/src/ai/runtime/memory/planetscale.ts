import type { Memory } from "lightfast/memory";
import type { LightfastAppChatUIMessage } from "@repo/chat-core/types";
import type { ChatFetchContext } from "@repo/chat-core/types";
import type { LightfastAppChatUIMessagePart } from "@repo/chat-core/types";

/**
 * PlanetScale implementation of Memory interface using service layer for database operations
 * This ensures consistent authentication and authorization across the app
 */
export class PlanetScaleMemory implements Memory<LightfastAppChatUIMessage, ChatFetchContext> {
	constructor(
		private messagesService: {
			append: (data: {
				sessionId: string;
				message: {
					id: string;
					role: string;
					parts: LightfastAppChatUIMessagePart[];
					modelId: string | null;
				};
			}) => Promise<void>;
			list: (sessionId: string) => Promise<LightfastAppChatUIMessage[]>;
		},
		private sessionsService: {
			create: (data: { id: string }) => Promise<void>;
			getMetadata: (sessionId: string) => Promise<{ resourceId: string; id: string } | null>;
		},
		private streamsService: {
			setActive: (data: { sessionId: string; streamId: string }) => Promise<void>;
			getActive: (sessionId: string) => Promise<string | null>;
			getAll: (sessionId: string) => Promise<string[]>;
			clearActive: (sessionId: string) => Promise<void>;
		}
	) {}

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
		// Only set modelId for assistant messages
		const modelId = message.role === 'assistant' 
			? context.modelId 
			: null;
		
		await this.messagesService.append({
			sessionId,
			message: {
				id: message.id,
				role: message.role,
				parts: message.parts,
				modelId,
			},
		});
	}

	/**
	 * Get all messages for a session, ordered by creation time
	 */
	async getMessages(sessionId: string): Promise<LightfastAppChatUIMessage[]> {
		return await this.messagesService.list(sessionId);
	}

	/**
	 * Create or ensure a session exists
	 * Uses client-provided sessionId directly as the primary key
	 */
	async createSession({
		sessionId,
		resourceId: _resourceId,
		context: _context,
	}: {
		sessionId: string;
		resourceId: string;
		context: ChatFetchContext;
	}): Promise<void> {
		// The resourceId is the Clerk user ID, but we're already authenticated via tRPC
		await this.sessionsService.create({
			id: sessionId,
		});
	}

	/**
	 * Get session by ID
	 * Returns the session data with the same ID provided
	 */
	async getSession(sessionId: string): Promise<{ resourceId: string; id: string } | null> {
		return await this.sessionsService.getMetadata(sessionId);
	}

	/**
	 * Set active stream ID for a session
	 * This is used to track the currently active streaming session for resume functionality
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
		await this.streamsService.setActive({
			sessionId,
			streamId,
		});
	}

	/**
	 * Get active stream ID for a session
	 * Returns array with single active stream ID for resume functionality, or empty array if none
	 */
	async getSessionStreams(sessionId: string): Promise<string[]> {
		return await this.streamsService.getAll(sessionId);
	}

	/**
	 * Get active stream ID for a session
	 * Returns the currently active stream for resume functionality
	 */
	async getActiveStream(sessionId: string): Promise<string | null> {
		return await this.streamsService.getActive(sessionId);
	}

	/**
	 * Clear active stream ID for a session
	 * Called when streaming completes to clean up the active stream reference
	 */
	async clearActiveStream(sessionId: string): Promise<void> {
		await this.streamsService.clearActive(sessionId);
	}
}