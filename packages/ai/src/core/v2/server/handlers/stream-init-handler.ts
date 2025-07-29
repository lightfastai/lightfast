/**
 * Stream Init Handler - Handles stream initialization requests
 */

import type { Redis } from "@upstash/redis";
import type { Agent } from "../../agent";
import type { EventEmitter } from "../../events/emitter";
import type { AgentLoopInitEvent, Message } from "../../events/schemas";
import { StreamGenerator } from "../stream-generator";

export interface StreamInitRequestBody {
	prompt: string;
	sessionId?: string;
	systemPrompt?: string;
	temperature?: number;
	maxIterations?: number;
	tools?: string[];
	metadata?: Record<string, any>;
}

export class StreamInitHandler<TRuntimeContext = unknown> {
	private streamGenerator: StreamGenerator;

	constructor(
		private agent: Agent<TRuntimeContext>,
		private redis: Redis,
		private eventEmitter: EventEmitter,
		private baseUrl: string,
	) {
		this.streamGenerator = new StreamGenerator(redis);
	}

	/**
	 * Handle stream initialization request
	 */
	async handleStreamInit(request: Request): Promise<Response> {
		const body = (await request.json()) as StreamInitRequestBody;
		const {
			prompt,
			sessionId: providedSessionId,
			systemPrompt = this.agent.getSystemPrompt(),
			temperature = this.agent.getTemperature() || 0.7,
			maxIterations = this.agent.getMaxIterations() || 10,
			tools = this.agent.getAvailableTools(),
			metadata = {},
		} = body;

		// Validate prompt
		if (!prompt || !prompt.trim()) {
			return Response.json({ error: "Prompt is required" }, { status: 400 });
		}

		// Convert prompt to messages format
		const messages = [{ role: "user", content: prompt.trim() }] as Message[];

		// Use provided session ID or generate new one
		const sessionId = providedSessionId || this.streamGenerator.createSessionId();

		// Check if stream already exists
		const exists = await this.streamGenerator.streamExists(sessionId);
		if (exists) {
			return Response.json({ error: "Session already exists", sessionId }, { status: 409 });
		}

		// Initialize session and stream
		await this.initializeSession(sessionId, messages, systemPrompt, temperature, maxIterations, tools, metadata);
		await this.createInitialStream(sessionId);

		// Start agent loop in background
		const agentLoopEvent = this.createAgentLoopEvent(
			sessionId,
			messages,
			systemPrompt,
			temperature,
			maxIterations,
			tools,
			metadata,
		);
		this.startAgentLoop(agentLoopEvent, sessionId);

		// Return session info immediately
		return Response.json({
			sessionId,
			streamUrl: `${this.baseUrl}/stream/${sessionId}`,
			status: "initialized",
			message: "Agent loop initialized. Connect to the stream URL to receive updates.",
		});
	}

	/**
	 * Initialize session state in Redis
	 */
	private async initializeSession(
		sessionId: string,
		messages: Message[],
		systemPrompt: string,
		temperature: number,
		maxIterations: number,
		tools: string[],
		metadata: Record<string, any>,
	): Promise<void> {
		const sessionKey = `v2:session:${sessionId}`;
		const sessionData = {
			sessionId,
			messages: messages as Message[],
			systemPrompt,
			temperature,
			maxIterations,
			tools,
			metadata,
			createdAt: new Date().toISOString(),
			status: "initializing",
			iteration: 0,
			updatedAt: new Date().toISOString(),
		};

		// Store session data (expire after 24 hours)
		await this.redis.setex(sessionKey, 86400, JSON.stringify(sessionData));
	}

	/**
	 * Create initial stream entry
	 */
	private async createInitialStream(sessionId: string): Promise<void> {
		const streamKey = `llm:stream:${sessionId}`;
		await this.redis.xadd(streamKey, "*", {
			type: "metadata",
			status: "started",
			completedAt: new Date().toISOString(),
			totalChunks: 0,
			fullContent: "",
			timestamp: new Date().toISOString(),
		});
		await this.redis.publish(streamKey, JSON.stringify({ type: "metadata" }));
	}

	/**
	 * Create agent loop init event
	 */
	private createAgentLoopEvent(
		sessionId: string,
		messages: Message[],
		systemPrompt: string,
		temperature: number,
		maxIterations: number,
		tools: string[],
		metadata: Record<string, any>,
	): AgentLoopInitEvent {
		return {
			id: `evt_${Date.now()}_${Math.random().toString(36).substring(7)}`,
			type: "agent.loop.init",
			sessionId,
			timestamp: new Date().toISOString(),
			version: "1.0",
			data: {
				messages: messages as Message[],
				systemPrompt,
				temperature,
				maxIterations,
				tools,
				metadata,
			},
		};
	}

	/**
	 * Start agent loop in background
	 */
	private startAgentLoop(agentLoopEvent: AgentLoopInitEvent, sessionId: string): void {
		// Run the first agent loop immediately in the background
		// Don't await this - let it stream while we return the response
		this.agent.processEvent(agentLoopEvent).catch((error) => {
			console.error(`[Stream Init] First agent loop failed for session ${sessionId}:`, error);
		});
	}
}
