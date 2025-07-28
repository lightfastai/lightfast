/**
 * Test scenario routes
 * Pre-configured test scenarios for the event-driven architecture
 */

import { createV2Infrastructure } from "@lightfast/ai/v2/core";
import { Hono } from "hono";

const testRoutes = new Hono();

// Initialize infrastructure
const { redis, streamGenerator, eventEmitter } = createV2Infrastructure();

// Test scenarios
const scenarios = {
	simple: {
		name: "Simple Calculator Test",
		description: "Tests basic agent loop with calculator tool",
		messages: [{ role: "user" as const, content: "What is 25 * 4?" }],
		tools: ["calculator"],
	},
	multiTool: {
		name: "Multi-Tool Test",
		description: "Tests agent using multiple tools",
		messages: [{ role: "user" as const, content: "Calculate 15 * 7 and tell me the weather in SF" }],
		tools: ["calculator", "weather"],
	},
	error: {
		name: "Error Handling Test",
		description: "Tests error handling in tool execution",
		messages: [{ role: "user" as const, content: "Calculate invalid expression: 2 ++ 2" }],
		tools: ["calculator"],
	},
	longRunning: {
		name: "Long Running Test",
		description: "Simulates a long-running task",
		messages: [{ role: "user" as const, content: "Perform a complex calculation" }],
		tools: ["calculator"],
	},
};

// GET /test - List available test scenarios
testRoutes.get("/", (c) => {
	return c.json({
		scenarios: Object.entries(scenarios).map(([key, scenario]) => ({
			key,
			...scenario,
		})),
		usage: "POST /test/:scenario to run a test",
	});
});

// POST /test/:scenario - Run a test scenario
testRoutes.post("/:scenario", async (c) => {
	const scenarioKey = c.req.param("scenario") as keyof typeof scenarios;
	const scenario = scenarios[scenarioKey];

	if (!scenario) {
		return c.json(
			{
				error: "Unknown scenario",
				available: Object.keys(scenarios),
			},
			404,
		);
	}

	try {
		// Create session
		const sessionId = streamGenerator.createSessionId();

		// Initialize session
		const sessionKey = `session:${sessionId}`;
		const sessionData = {
			messages: scenario.messages,
			tools: scenario.tools,
			temperature: 0.7,
			maxIterations: 10,
			createdAt: new Date().toISOString(),
			status: "initializing",
			iterations: 0,
			testScenario: scenarioKey,
		};

		await redis.setex(sessionKey, 3600, JSON.stringify(sessionData)); // 1 hour TTL for tests

		// Create initial stream entry
		const streamKey = `stream:${sessionId}`;
		await redis.xadd(streamKey, "*", {
			type: "status",
			content: "Test session initialized",
			metadata: JSON.stringify({
				status: "initialized",
				scenario: scenarioKey,
			}),
		});

		// Emit agent.loop.init event
		await eventEmitter.emitAgentLoopInit(sessionId, {
			messages: scenario.messages,
			tools: scenario.tools,
			temperature: 0.7,
			maxIterations: 10,
		});

		// For local testing, directly call worker endpoints
		if (process.env.LOCAL_WORKERS === "true") {
			setTimeout(async () => {
				try {
					const response = await fetch("http://localhost:8080/workers/agent-loop", {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({
							id: `evt_test_${Date.now()}`,
							type: "agent.loop.init",
							sessionId,
							timestamp: new Date().toISOString(),
							version: "1.0",
							data: {
								messages: scenario.messages,
								tools: scenario.tools,
								temperature: 0.7,
								maxIterations: 10,
							},
						}),
					});

					const result = (await response.json()) as any;
					console.log(`[Test] Agent loop result:`, result);

					// If agent decided on a tool call, execute it
					if (result?.decision?.action === "tool_call") {
						setTimeout(async () => {
							const toolResponse = await fetch("http://localhost:8090/workers/tool-executor", {
								method: "POST",
								headers: { "Content-Type": "application/json" },
								body: JSON.stringify({
									id: `evt_test_tool_${Date.now()}`,
									type: "agent.tool.call",
									sessionId,
									timestamp: new Date().toISOString(),
									version: "1.0",
									data: {
										toolCallId: result.decision.toolCallId,
										tool: result.decision.tool,
										arguments: { expression: "25 * 4" },
										iteration: 1,
										priority: "normal",
									},
								}),
							});

							const toolResult = await toolResponse.json();
							console.log(`[Test] Tool executor result:`, toolResult);

							// After tool execution, invoke tool result handler
							if (toolResult.success) {
								setTimeout(async () => {
									await fetch("http://localhost:8090/workers/tool-result-complete", {
										method: "POST",
										headers: { "Content-Type": "application/json" },
										body: JSON.stringify({
											id: `evt_test_result_${Date.now()}`,
											type: "tool.execution.complete",
											sessionId,
											timestamp: new Date().toISOString(),
											version: "1.0",
											data: {
												toolCallId: result.decision.toolCallId,
												tool: result.decision.tool,
												result: toolResult.result,
												duration: 100,
												attempts: 1,
											},
										}),
									});
								}, 500);
							}
						}, 500);
					}
				} catch (error) {
					console.error("[Test] Worker invocation error:", error);
				}
			}, 100);
		}

		return c.json({
			success: true,
			sessionId,
			scenario: {
				key: scenarioKey,
				...scenario,
			},
			streamUrl: `/stream/${sessionId}`,
			message: "Test scenario started. Connect to the stream URL to see results.",
			hint:
				process.env.LOCAL_WORKERS !== "true"
					? "Set LOCAL_WORKERS=true to automatically invoke workers"
					: "Workers will be invoked automatically",
		});
	} catch (error) {
		console.error("Test scenario error:", error);
		return c.json(
			{
				error: "Failed to start test scenario",
				details: error instanceof Error ? error.message : String(error),
			},
			500,
		);
	}
});

// DELETE /test/:sessionId - Clean up test session
testRoutes.delete("/:sessionId", async (c) => {
	const sessionId = c.req.param("sessionId");

	try {
		// Delete session data
		await redis.del(`session:${sessionId}`);

		// Delete stream data
		await redis.del(`stream:${sessionId}`);

		// Delete events
		await redis.del(`events:${sessionId}`);

		return c.json({
			success: true,
			message: `Test session ${sessionId} cleaned up`,
		});
	} catch (error) {
		console.error("Cleanup error:", error);
		return c.json(
			{
				error: "Failed to clean up test session",
				details: error instanceof Error ? error.message : String(error),
			},
			500,
		);
	}
});

export { testRoutes };
