import { NextResponse } from "next/server";
import { mastra } from "@/mastra";

export async function POST(request: Request) {
	try {
		const { prompt = "I need to build a web scraper. Please create a task list for this." } = await request.json();

		console.log("\n=== TEST DEBUG ENDPOINT ===");
		console.log("Testing with prompt:", prompt);

		// Get the V1Agent
		const agent = mastra.getAgent("V1Agent");
		if (!agent) {
			return NextResponse.json({ error: "Agent not found" }, { status: 404 });
		}

		console.log("\n=== AGENT INFO ===");
		console.log("Agent name:", agent.name);
		console.log("Agent tools:", Object.keys(agent.tools || {}));

		// Check memory configuration
		const memory = agent.getMemory();
		console.log("Memory configured:", !!memory);
		if (memory) {
			console.log("Memory options:", JSON.stringify(memory.options, null, 2));
		}

		// Generate with the agent
		const threadId = `test-${Date.now()}`;
		const resourceId = "test-user";

		console.log("\n=== CALLING AGENT ===");
		console.log("ThreadId:", threadId);
		console.log("ResourceId:", resourceId);

		const messages = [
			{
				role: "user" as const,
				content: prompt,
			},
		];

		const result = await agent.generate(messages, {
			threadId,
			resourceId,
			memory: {
				thread: threadId,
				resource: resourceId,
			},
		});

		console.log("\n=== AGENT RESULT ===");
		console.log("Result type:", typeof result);
		console.log("Has text:", !!result.text);
		console.log("Has steps:", !!result.steps);
		console.log("Steps count:", result.steps?.length || 0);

		// Analyze tool calls
		const toolCallAnalysis: any[] = [];
		if (result.steps && result.steps.length > 0) {
			console.log("\n=== ANALYZING STEPS ===");
			result.steps.forEach((step: any, i: number) => {
				console.log(`\nStep ${i}:`, {
					type: step.type,
					toolCallCount: step.toolCalls?.length || 0,
				});

				if (step.toolCalls) {
					step.toolCalls.forEach((tc: any, j: number) => {
						console.log(`  Tool call ${j}:`, {
							toolName: tc.toolName,
							hasArgs: !!tc.args,
							argsKeys: tc.args ? Object.keys(tc.args) : [],
						});

						if (tc.toolName === "taskManagement") {
							console.log("    taskManagement args:", JSON.stringify(tc.args, null, 2));
						}

						toolCallAnalysis.push({
							stepIndex: i,
							toolCallIndex: j,
							toolName: tc.toolName,
							args: tc.args,
						});
					});
				}
			});
		}

		// Check memory after generation
		console.log("\n=== CHECKING MEMORY AFTER GENERATION ===");
		if (memory) {
			try {
				const thread = await memory.getThreadById({ threadId });
				console.log("Thread exists:", !!thread);

				const { messages: memoryMessages } = await memory.query({
					threadId,
					selectBy: { last: 10 },
				});

				console.log("Messages in memory:", memoryMessages.length);

				// Look for working memory updates
				let foundWorkingMemory = false;
				for (const msg of memoryMessages) {
					if (msg.role === "assistant") {
						// Check for updateWorkingMemory tool calls
						if ("toolCalls" in msg && (msg as any).toolCalls) {
							for (const tc of (msg as any).toolCalls) {
								if (tc.toolName === "updateWorkingMemory") {
									console.log("Found updateWorkingMemory tool call!");
									foundWorkingMemory = true;
									break;
								}
							}
						}

						// Check content for working memory tags
						if (msg.content) {
							const contentStr = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);
							if (contentStr.includes("working_memory")) {
								console.log("Found working_memory tag in content!");
								foundWorkingMemory = true;
							}
						}
					}
				}

				console.log("Found working memory update:", foundWorkingMemory);
			} catch (e) {
				console.error("Error checking memory:", e);
			}
		}

		return NextResponse.json({
			success: true,
			threadId,
			prompt,
			response: result.text,
			toolCallAnalysis,
			agentTools: Object.keys(agent.tools || {}),
			memoryConfigured: !!memory,
		});
	} catch (error) {
		console.error("Test debug error:", error);
		return NextResponse.json(
			{
				error: "Test failed",
				details: error instanceof Error ? error.message : String(error),
			},
			{ status: 500 },
		);
	}
}
