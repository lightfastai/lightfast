import { EventEmitter } from "events";
import { z } from "zod";

// Message schema
const messageSchema = z.object({
	message: z.string(),
	id: z.string(),
	role: z.enum(["user", "assistant"]),
});

// Status schema
const statusSchema = z.object({
	status: z.enum(["starting", "running", "completed", "error"]),
	message: z.string().optional(),
});

export type Message = z.infer<typeof messageSchema>;
export type Status = z.infer<typeof statusSchema>;

// Global event emitter for realtime updates
const realtimeEmitter = new EventEmitter();

// Channel class for organizing events by chat ID
export class TaskExecutionChannel {
	constructor(private chatId: string) {}

	// Send a message update
	messages(data: Message) {
		messageSchema.parse(data);
		realtimeEmitter.emit(`task:${this.chatId}:messages`, data);
		return { channelId: `task:${this.chatId}`, topic: "messages", data };
	}

	// Send a status update
	status(data: Status) {
		statusSchema.parse(data);
		realtimeEmitter.emit(`task:${this.chatId}:status`, data);
		return { channelId: `task:${this.chatId}`, topic: "status", data };
	}

	// Subscribe to updates
	subscribe(topic: "messages" | "status", callback: (data: any) => void) {
		const event = `task:${this.chatId}:${topic}`;
		realtimeEmitter.on(event, callback);
		return () => realtimeEmitter.off(event, callback);
	}

	// Get all events for SSE streaming
	getEventStream() {
		return realtimeEmitter;
	}
}

// Factory function to create channels
export const taskExecutionChannel = (chatId: string) => new TaskExecutionChannel(chatId);

// SSE helper for streaming updates
export class SSEManager {
	private clients = new Map<string, Set<(data: any) => void>>();

	// Add a client for a specific chat
	addClient(chatId: string, sendFn: (data: any) => void) {
		if (!this.clients.has(chatId)) {
			this.clients.set(chatId, new Set());
		}
		this.clients.get(chatId)!.add(sendFn);

		// Set up listeners
		const channel = taskExecutionChannel(chatId);
		const messagesUnsub = channel.subscribe("messages", (data) => {
			sendFn({ type: "messages", data });
		});
		const statusUnsub = channel.subscribe("status", (data) => {
			sendFn({ type: "status", data });
		});

		// Return cleanup function
		return () => {
			const clients = this.clients.get(chatId);
			if (clients) {
				clients.delete(sendFn);
				if (clients.size === 0) {
					this.clients.delete(chatId);
				}
			}
			messagesUnsub();
			statusUnsub();
		};
	}
}

export const sseManager = new SSEManager();
