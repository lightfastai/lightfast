/**
 * V2 Test API - Event-Driven Architecture Test Scenarios
 * Initiates test scenarios with Qstash event emission
 */

import { NextRequest, NextResponse } from "next/server";
import { redis, eventEmitter, streamGenerator } from "@/app/(v2)/ai/config";

// Test scenarios matching the V2 test server
const TEST_SCENARIOS = {
	simple: {
		key: "simple",
		name: "Simple Calculator Test", 
		description: "Tests basic agent loop with calculator tool",
		messages: [{ role: "user", content: "What is 25 * 4?" }],
		tools: ["calculator"]
	},
	multiTool: {
		key: "multiTool",
		name: "Multi-Tool Test",
		description: "Tests multiple tool usage in sequence", 
		messages: [{ role: "user", content: "What's the weather like and then calculate 15 * 3?" }],
		tools: ["weather", "calculator"]
	},
	custom: {
		key: "custom",
		name: "Custom Prompt",
		description: "Use a custom prompt with available tools",
		messages: [],
		tools: ["calculator", "weather"]
	}
} as const;

export async function POST(
	request: NextRequest,
	{ params }: { params: Promise<{ scenario: string }> }
) {
	try {
		const { scenario } = await params;
		const body = await request.json();

		// Get scenario configuration
		const scenarioConfig = TEST_SCENARIOS[scenario as keyof typeof TEST_SCENARIOS];
		if (!scenarioConfig) {
			return NextResponse.json(
				{ error: "Invalid scenario", available: Object.keys(TEST_SCENARIOS) },
				{ status: 400 }
			);
		}

		// Use custom messages if provided, otherwise use scenario defaults
		const messages = body.messages && body.messages.length > 0 
			? body.messages 
			: scenarioConfig.messages;

		if (!messages || messages.length === 0) {
			return NextResponse.json(
				{ error: "No messages provided" },
				{ status: 400 }
			);
		}

		// Generate session ID
		const sessionId = streamGenerator.createSessionId();

		// Initialize session data
		const sessionKey = `session:${sessionId}`;
		const sessionData = {
			sessionId,
			messages,
			tools: body.tools || scenarioConfig.tools,
			temperature: body.temperature || 0.7,
			maxIterations: body.maxIterations || 10,
			createdAt: new Date().toISOString(),
			status: "initializing",
			iteration: 0,
			testScenario: scenario,
		};

		await redis.setex(sessionKey, 3600, JSON.stringify(sessionData)); // 1 hour TTL

		// Create initial stream entry
		const streamKey = `stream:${sessionId}`;
		await redis.xadd(streamKey, "*", {
			type: "status",
			content: "Test session initialized",
			metadata: JSON.stringify({
				status: "initialized",
				scenario,
			}),
		});

		// Emit agent.loop.init event to start the process
		await eventEmitter.emitAgentLoopInit(sessionId, {
			messages,
			tools: body.tools || scenarioConfig.tools,
			temperature: body.temperature || 0.7,
			maxIterations: body.maxIterations || 10,
		});

		return NextResponse.json({
			success: true,
			sessionId,
			scenario: scenarioConfig,
			streamUrl: `/api/v2/stream/${sessionId}`,
			message: "Test scenario started. Connect to the stream URL to see results.",
		});

	} catch (error) {
		console.error("Test scenario error:", error);
		return NextResponse.json(
			{
				error: "Failed to start test scenario",
				details: error instanceof Error ? error.message : String(error),
			},
			{ status: 500 }
		);
	}
}

export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ scenario: string }> }
) {
	const { scenario } = await params;
	
	if (scenario === "list") {
		return NextResponse.json({
			scenarios: Object.values(TEST_SCENARIOS),
			count: Object.keys(TEST_SCENARIOS).length,
		});
	}

	const scenarioConfig = TEST_SCENARIOS[scenario as keyof typeof TEST_SCENARIOS];
	if (!scenarioConfig) {
		return NextResponse.json(
			{ error: "Scenario not found", available: Object.keys(TEST_SCENARIOS) },
			{ status: 404 }
		);
	}

	return NextResponse.json(scenarioConfig);
}