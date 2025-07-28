/**
 * Example usage of the event-driven architecture
 * This demonstrates how events flow through the system
 */

import { createEventEmitter, EventType } from "./index";
import type { Message } from "./schemas";

// Example: Initialize event emitter
const emitter = createEventEmitter({
	qstashUrl: process.env.QSTASH_URL || "https://qstash.upstash.io",
	qstashToken: process.env.QSTASH_TOKEN || "your-token",
	topicPrefix: "agent",
});

// Example: Complete agent flow
async function exampleAgentFlow() {
	const sessionId = "session_123";

	// 1. Start agent loop
	const messages: Message[] = [{ role: "user", content: "Calculate 25 * 4 and tell me the weather in SF" }];

	await emitter.emitAgentLoopInit(sessionId, {
		messages,
		systemPrompt: "You are a helpful assistant with access to calculator and weather tools.",
		temperature: 0.7,
		maxIterations: 10,
		tools: ["calculator", "weather"],
	});

	// 2. Agent decides to use calculator
	await emitter.emitAgentToolCall(sessionId, {
		toolCallId: "tc_001",
		tool: "calculator",
		arguments: { expression: "25 * 4" },
		iteration: 1,
		priority: "normal",
	});

	// 3. Tool execution starts
	await emitter.emitToolExecutionStart(sessionId, {
		toolCallId: "tc_001",
		tool: "calculator",
		attempt: 1,
		timeout: 5000,
	});

	// 4. Stream intermediate result
	await emitter.emitStreamWrite(sessionId, {
		messageType: "event",
		content: "Calculating 25 * 4...",
		metadata: { tool: "calculator", status: "processing" },
	});

	// 5. Tool completes
	await emitter.emitToolExecutionComplete(sessionId, {
		toolCallId: "tc_001",
		tool: "calculator",
		result: { value: 100, expression: "25 * 4" },
		duration: 45,
		attempts: 1,
	});

	// 6. Agent decides to use weather tool
	await emitter.emitAgentToolCall(sessionId, {
		toolCallId: "tc_002",
		tool: "weather",
		arguments: { location: "San Francisco, CA" },
		iteration: 2,
		priority: "normal",
	});

	// 7. Weather tool executes (showing failure case)
	await emitter.emitToolExecutionStart(sessionId, {
		toolCallId: "tc_002",
		tool: "weather",
		attempt: 1,
	});

	// Simulate failure
	await emitter.emitToolExecutionFailed(sessionId, {
		toolCallId: "tc_002",
		tool: "weather",
		error: "Weather API temporarily unavailable",
		code: "WEATHER_API_DOWN",
		attempts: 3,
		lastAttemptDuration: 2000,
	});

	// 8. Agent completes with partial results
	await emitter.emitAgentLoopComplete(sessionId, {
		finalMessage:
			"I calculated that 25 * 4 = 100. Unfortunately, I couldn't retrieve the weather information for San Francisco due to a temporary API issue.",
		iterations: 2,
		toolsUsed: ["calculator", "weather"],
		duration: 5230,
	});
}

// Example: Using session-scoped emitter
async function exampleSessionEmitter() {
	const sessionId = "session_456";
	const sessionEmitter = emitter.forSession(sessionId);

	// All events automatically include the sessionId
	await sessionEmitter.emitAgentLoopInit({
		messages: [{ role: "user", content: "Hello!" }],
		temperature: 0.5,
		maxIterations: 5,
	});

	// Stream a response
	await sessionEmitter.emitStreamWrite({
		messageType: "chunk",
		content: "Hello! How can I help you today?",
	});

	// Complete
	await sessionEmitter.emitAgentLoopComplete({
		finalMessage: "Hello! How can I help you today?",
		iterations: 1,
		toolsUsed: [],
		duration: 120,
	});
}

// Example: Error handling
async function exampleErrorHandling() {
	const sessionId = "session_789";

	try {
		// Start loop
		await emitter.emitAgentLoopInit(sessionId, {
			messages: [{ role: "user", content: "Do something complex" }],
			temperature: 0.7,
			maxIterations: 10,
		});

		// Simulate an error during processing
		throw new Error("Unexpected error in agent logic");
	} catch (error) {
		// Emit error event
		await emitter.emitAgentLoopError(sessionId, {
			error: error instanceof Error ? error.message : "Unknown error",
			code: "AGENT_PROCESSING_ERROR",
			iteration: 1,
			recoverable: false,
		});
	}
}

// Run examples
if (require.main === module) {
	console.log("Running event emitter examples...");

	exampleAgentFlow()
		.then(() => console.log("✅ Agent flow example completed"))
		.catch(console.error);

	exampleSessionEmitter()
		.then(() => console.log("✅ Session emitter example completed"))
		.catch(console.error);

	exampleErrorHandling()
		.then(() => console.log("✅ Error handling example completed"))
		.catch(console.error);
}
