/**
 * V2 Event System Emitter
 * Handles publishing events to Qstash for distributed processing
 */

import { Client } from "@upstash/qstash";
import { EventSchema, EventType } from "./schemas";
import type {
	AgentLoopCompleteEvent,
	AgentLoopInitEvent,
	AgentToolCallEvent,
	Event,
	Message,
	StreamWriteEvent,
	ToolExecutionCompleteEvent,
	ToolExecutionFailedEvent,
	ToolExecutionStartEvent,
} from "./schemas";
import {
	AgentLoopCompleteEventSchema,
	AgentLoopInitEventSchema,
	AgentToolCallEventSchema,
	StreamWriteEventSchema,
	ToolExecutionCompleteEventSchema,
	ToolExecutionFailedEventSchema,
	ToolExecutionStartEventSchema,
} from "./schemas";

export interface EventEmitterConfig {
	qstashUrl: string;
	qstashToken: string;
	baseUrl: string;
	endpoints: Record<string, string>;
	retryConfig?: {
		retries?: number;
		backoff?: "exponential" | "linear" | "constant";
	};
}

export class EventEmitter {
	private client: Client;
	private config: EventEmitterConfig;

	constructor(config: EventEmitterConfig) {
		this.config = config;
		this.client = new Client({
			baseUrl: config.qstashUrl,
			token: config.qstashToken,
		});
	}


	/**
	 * Generate a unique event ID
	 */
	private generateEventId(): string {
		return `evt_${Date.now()}_${Math.random().toString(36).substring(7)}`;
	}

	/**
	 * Emit an agent loop init event
	 */
	async emitAgentLoopInit(sessionId: string, data: AgentLoopInitEvent["data"]): Promise<void> {
		const event: AgentLoopInitEvent = {
			id: this.generateEventId(),
			type: EventType.AGENT_LOOP_INIT,
			sessionId,
			timestamp: new Date().toISOString(),
			version: "1.0",
			data,
		};

		const validated = AgentLoopInitEventSchema.parse(event);
		await this.publishEvent(validated);
	}

	/**
	 * Emit an agent loop complete event
	 */
	async emitAgentLoopComplete(sessionId: string, data: AgentLoopCompleteEvent["data"]): Promise<void> {
		const event: AgentLoopCompleteEvent = {
			id: this.generateEventId(),
			type: EventType.AGENT_LOOP_COMPLETE,
			sessionId,
			timestamp: new Date().toISOString(),
			version: "1.0",
			data,
		};

		const validated = AgentLoopCompleteEventSchema.parse(event);
		await this.publishEvent(validated);
	}


	/**
	 * Emit an agent tool call event
	 */
	async emitAgentToolCall(sessionId: string, data: AgentToolCallEvent["data"]): Promise<void> {
		const event: AgentToolCallEvent = {
			id: this.generateEventId(),
			type: EventType.AGENT_TOOL_CALL,
			sessionId,
			timestamp: new Date().toISOString(),
			version: "1.0",
			data,
		};

		const validated = AgentToolCallEventSchema.parse(event);
		await this.publishEvent(validated);
	}

	/**
	 * Emit a tool execution complete event
	 */
	async emitToolExecutionComplete(sessionId: string, data: ToolExecutionCompleteEvent["data"]): Promise<void> {
		const event: ToolExecutionCompleteEvent = {
			id: this.generateEventId(),
			type: EventType.TOOL_EXECUTION_COMPLETE,
			sessionId,
			timestamp: new Date().toISOString(),
			version: "1.0",
			data,
		};

		const validated = ToolExecutionCompleteEventSchema.parse(event);
		await this.publishEvent(validated);
	}

	/**
	 * Emit a tool execution failed event
	 */
	async emitToolExecutionFailed(sessionId: string, data: ToolExecutionFailedEvent["data"]): Promise<void> {
		const event: ToolExecutionFailedEvent = {
			id: this.generateEventId(),
			type: EventType.TOOL_EXECUTION_FAILED,
			sessionId,
			timestamp: new Date().toISOString(),
			version: "1.0",
			data,
		};

		const validated = ToolExecutionFailedEventSchema.parse(event);
		await this.publishEvent(validated);
	}

	/**
	 * Emit a stream write event
	 */
	async emitStreamWrite(sessionId: string, data: StreamWriteEvent["data"]): Promise<void> {
		const event: StreamWriteEvent = {
			id: this.generateEventId(),
			type: EventType.STREAM_WRITE,
			sessionId,
			timestamp: new Date().toISOString(),
			version: "1.0",
			data,
		};

		const validated = StreamWriteEventSchema.parse(event);
		await this.publishEvent(validated);
	}

	/**
	 * Generic event emission (for custom events)
	 */
	async emit(event: Omit<Event, "id" | "timestamp">): Promise<void> {
		const fullEvent = {
			...event,
			id: this.generateEventId(),
			timestamp: new Date().toISOString(),
		} as Event;

		// Validate against the union schema
		const validated = EventSchema.parse(fullEvent);
		await this.publishEvent(validated);
	}

	/**
	 * Publish an event to Qstash
	 */
	private async publishEvent(event: Event): Promise<void> {
		// Always use direct URL publishing - we don't need URL groups
		// since each event type maps to exactly one endpoint
		const endpoint = this.config.endpoints[event.type];
		if (!endpoint) {
			console.warn(`No endpoint mapping for event type: ${event.type}`);
			return;
		}

		const url = `${this.config.baseUrl}${endpoint}`;

		try {
			await this.client.publishJSON({
				url,
				body: event,
				retries: this.config.retryConfig?.retries ?? 3,
				delay: "10s", // Retry after 10 seconds
				headers: {
					"x-event-id": event.id,
					"x-event-type": event.type,
					"x-session-id": event.sessionId,
				},
			});

			console.log(`Event published: ${event.type} [${event.id}] -> ${url}`);
		} catch (error) {
			console.error(`Failed to publish event ${event.type} to ${url}:`, error);
			throw new Error(`Event publish failed: ${error instanceof Error ? error.message : String(error)}`);
		}
	}




	/**
	 * Emit a tool execution start event
	 */
	async emitToolExecutionStart(sessionId: string, data: ToolExecutionStartEvent["data"]): Promise<void> {
		const event: ToolExecutionStartEvent = {
			id: this.generateEventId(),
			type: EventType.TOOL_EXECUTION_START,
			sessionId,
			timestamp: new Date().toISOString(),
			version: "1.0",
			data,
		};

		const validated = ToolExecutionStartEventSchema.parse(event);
		await this.publishEvent(validated);
	}

	/**
	 * Create a session-scoped event emitter
	 */
	forSession(sessionId: string): SessionEventEmitter {
		return new SessionEventEmitter(this, sessionId);
	}
}

/**
 * Session-scoped event emitter
 * Convenience wrapper that automatically includes sessionId
 */
export class SessionEventEmitter {
	constructor(
		private emitter: EventEmitter,
		private sessionId: string,
	) {}

	async emitAgentLoopInit(data: AgentLoopInitEvent["data"]): Promise<void> {
		return this.emitter.emitAgentLoopInit(this.sessionId, data);
	}

	async emitAgentLoopComplete(data: AgentLoopCompleteEvent["data"]): Promise<void> {
		return this.emitter.emitAgentLoopComplete(this.sessionId, data);
	}

	async emitAgentToolCall(data: AgentToolCallEvent["data"]): Promise<void> {
		return this.emitter.emitAgentToolCall(this.sessionId, data);
	}

	async emitToolExecutionComplete(data: ToolExecutionCompleteEvent["data"]): Promise<void> {
		return this.emitter.emitToolExecutionComplete(this.sessionId, data);
	}

	async emitToolExecutionFailed(data: ToolExecutionFailedEvent["data"]): Promise<void> {
		return this.emitter.emitToolExecutionFailed(this.sessionId, data);
	}

	async emitStreamWrite(data: StreamWriteEvent["data"]): Promise<void> {
		return this.emitter.emitStreamWrite(this.sessionId, data);
	}
}

