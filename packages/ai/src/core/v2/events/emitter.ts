/**
 * Event emitter for publishing events to Qstash
 * Provides type-safe event emission with automatic validation
 */

import { Client } from "@upstash/qstash";
import { nanoid } from "nanoid";
import type {
	AgentLoopCompleteEvent,
	AgentLoopErrorEvent,
	AgentLoopInitEvent,
	AgentToolCallEvent,
	Event,
	EventType,
	StreamWriteEvent,
	ToolExecutionCompleteEvent,
	ToolExecutionFailedEvent,
	ToolExecutionStartEvent,
} from "./schemas";
import {
	AgentLoopCompleteEventSchema,
	AgentLoopErrorEventSchema,
	AgentLoopInitEventSchema,
	AgentToolCallEventSchema,
	EventSchema,
	StreamWriteEventSchema,
	ToolExecutionCompleteEventSchema,
	ToolExecutionFailedEventSchema,
	ToolExecutionStartEventSchema,
} from "./schemas";

export interface EventEmitterConfig {
	qstashUrl: string;
	qstashToken: string;
	topicPrefix?: string;
	// Direct URL mode configuration
	directUrl?: string;
	workerBaseUrl?: string;
	retryConfig?: {
		retries?: number;
		backoff?: "exponential" | "linear" | "constant";
	};
}

export class EventEmitter {
	private client: Client;
	private topicPrefix: string;
	private directUrl?: string;
	private workerBaseUrl?: string;

	constructor(config: EventEmitterConfig) {
		this.client = new Client({
			baseUrl: config.qstashUrl,
			token: config.qstashToken,
		});
		this.topicPrefix = config.topicPrefix || "agent";
		this.directUrl = config.directUrl;
		this.workerBaseUrl = config.workerBaseUrl;
	}

	/**
	 * Generate a unique event ID
	 */
	private generateEventId(): string {
		return `evt_${nanoid(16)}`;
	}

	/**
	 * Get the topic name for an event type
	 */
	private getTopicName(eventType: EventType): string {
		return `${this.topicPrefix}.${eventType.replace(/\./g, "-")}`;
	}

	/**
	 * Emit an agent loop init event
	 */
	async emitAgentLoopInit(sessionId: string, data: AgentLoopInitEvent["data"]): Promise<void> {
		const event: AgentLoopInitEvent = {
			id: this.generateEventId(),
			type: "agent.loop.init",
			sessionId,
			timestamp: new Date().toISOString(),
			version: "1.0",
			data,
		};

		// Validate event
		const validated = AgentLoopInitEventSchema.parse(event);
		await this.publishEvent(validated);
	}

	/**
	 * Emit an agent loop complete event
	 */
	async emitAgentLoopComplete(sessionId: string, data: AgentLoopCompleteEvent["data"]): Promise<void> {
		const event: AgentLoopCompleteEvent = {
			id: this.generateEventId(),
			type: "agent.loop.complete",
			sessionId,
			timestamp: new Date().toISOString(),
			version: "1.0",
			data,
		};

		const validated = AgentLoopCompleteEventSchema.parse(event);
		await this.publishEvent(validated);
	}

	/**
	 * Emit an agent loop error event
	 */
	async emitAgentLoopError(sessionId: string, data: AgentLoopErrorEvent["data"]): Promise<void> {
		const event: AgentLoopErrorEvent = {
			id: this.generateEventId(),
			type: "agent.loop.error",
			sessionId,
			timestamp: new Date().toISOString(),
			version: "1.0",
			data,
		};

		const validated = AgentLoopErrorEventSchema.parse(event);
		await this.publishEvent(validated);
	}

	/**
	 * Emit an agent tool call event
	 */
	async emitAgentToolCall(sessionId: string, data: AgentToolCallEvent["data"]): Promise<void> {
		const event: AgentToolCallEvent = {
			id: this.generateEventId(),
			type: "agent.tool.call",
			sessionId,
			timestamp: new Date().toISOString(),
			version: "1.0",
			data,
		};

		const validated = AgentToolCallEventSchema.parse(event);
		await this.publishEvent(validated);
	}

	/**
	 * Emit a tool execution start event
	 */
	async emitToolExecutionStart(sessionId: string, data: ToolExecutionStartEvent["data"]): Promise<void> {
		const event: ToolExecutionStartEvent = {
			id: this.generateEventId(),
			type: "tool.execution.start",
			sessionId,
			timestamp: new Date().toISOString(),
			version: "1.0",
			data,
		};

		const validated = ToolExecutionStartEventSchema.parse(event);
		await this.publishEvent(validated);
	}

	/**
	 * Emit a tool execution complete event
	 */
	async emitToolExecutionComplete(sessionId: string, data: ToolExecutionCompleteEvent["data"]): Promise<void> {
		const event: ToolExecutionCompleteEvent = {
			id: this.generateEventId(),
			type: "tool.execution.complete",
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
			type: "tool.execution.failed",
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
			type: "stream.write",
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
		// Check if we're in direct URL mode (for testing)
		if (this.directUrl === "true" && this.workerBaseUrl) {
			return this.publishEventDirectUrl(event);
		}

		// Normal topic-based publishing
		const topic = this.getTopicName(event.type);

		try {
			await this.client.publishJSON({
				topic,
				body: event,
				retries: 3,
				delay: "10s", // Retry after 10 seconds
				headers: {
					"x-event-id": event.id,
					"x-event-type": event.type,
					"x-session-id": event.sessionId,
				},
			});

			console.log(`Event published: ${event.type} [${event.id}]`);
		} catch (error) {
			console.error(`Failed to publish event ${event.type}:`, error);
			
			// In development, don't fail if topic doesn't exist
			if (process.env.NODE_ENV === "development" && 
				error instanceof Error && 
				error.message.includes("topic") && 
				error.message.includes("not found")) {
				console.warn(`⚠️  Topic ${topic} not found. Skipping event publish in development.`);
				return;
			}
			
			throw new Error(`Event publish failed: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	/**
	 * Publish event using direct URL (for testing without topic setup)
	 */
	private async publishEventDirectUrl(event: Event): Promise<void> {
		const endpoint = this.getEndpointForEvent(event.type);
		if (!endpoint) {
			console.warn(`No endpoint mapping for event type: ${event.type}`);
			return;
		}

		const url = `${this.workerBaseUrl}${endpoint}`;

		try {
			await this.client.publishJSON({
				url,
				body: event,
				retries: 3,
				delay: "10s",
				headers: {
					"x-event-id": event.id,
					"x-event-type": event.type,
					"x-session-id": event.sessionId,
				},
			});

			console.log(`Event published via URL: ${event.type} [${event.id}] -> ${url}`);
		} catch (error) {
			console.error(`Failed to publish event ${event.type} to ${url}:`, error);
			throw new Error(`Event publish failed: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	/**
	 * Get endpoint for event type (used in direct URL mode)
	 */
	private getEndpointForEvent(eventType: string): string | undefined {
		const endpoints: Record<string, string> = {
			"agent.loop.init": "/api/v2/workers/agent-loop",
			"agent.tool.call": "/api/v2/workers/tool-executor",
			"tool.execution.complete": "/api/v2/workers/tool-result-complete",
			"tool.execution.failed": "/api/v2/workers/tool-result-failed",
			"agent.loop.complete": "/api/v2/workers/agent-complete",
		};
		return endpoints[eventType];
	}

	/**
	 * Create a scoped emitter for a specific session
	 */
	forSession(sessionId: string): SessionEventEmitter {
		return new SessionEventEmitter(this, sessionId);
	}
}

/**
 * Session-scoped event emitter
 * Automatically includes sessionId in all events
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

	async emitAgentLoopError(data: AgentLoopErrorEvent["data"]): Promise<void> {
		return this.emitter.emitAgentLoopError(this.sessionId, data);
	}

	async emitAgentToolCall(data: AgentToolCallEvent["data"]): Promise<void> {
		return this.emitter.emitAgentToolCall(this.sessionId, data);
	}

	async emitToolExecutionStart(data: ToolExecutionStartEvent["data"]): Promise<void> {
		return this.emitter.emitToolExecutionStart(this.sessionId, data);
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

/**
 * Create a default event emitter instance
 */
export function createEventEmitter(config: EventEmitterConfig): EventEmitter {
	return new EventEmitter(config);
}

/**
 * Create an event emitter with default configuration from environment
 */
export function createDefaultEventEmitter(): EventEmitter {
	// Import dynamically to avoid circular dependencies
	const { getQstashConfig } = require("../env");
	return new EventEmitter(getQstashConfig());
}
