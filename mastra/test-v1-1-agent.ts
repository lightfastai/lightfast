import { mastra } from "./index";

async function testV1_1Agent() {
	console.log("🚀 Testing V1.1 Task-Led Agent\n");

	const agent = mastra.getAgent("V1_1Agent");
	if (!agent) {
		console.error("❌ V1.1 Agent not found!");
		return;
	}

	const testPrompt = "search claude code best practices";
	console.log(`📝 Test prompt: "${testPrompt}"\n`);

	try {
		console.log("🔄 Generating response...\n");
		const result = await agent.generate(testPrompt, {
			threadId: `test-v1-1-${Date.now()}`,
			resourceId: "test-user",
		});

		console.log("✅ Generation complete!\n");
		console.log("📄 Response:");
		console.log("─".repeat(50));
		console.log(result.text);
		console.log("─".repeat(50));

		// Log tool usage
		if (result.steps) {
			console.log("\n🔧 Tool Usage Summary:");
			let toolCallCount = 0;
			result.steps.forEach((step, index) => {
				if (step.toolCalls && step.toolCalls.length > 0) {
					step.toolCalls.forEach((toolCall) => {
						toolCallCount++;
						console.log(`  ${toolCallCount}. ${toolCall.toolName}`);
						if (toolCall.toolName === "taskExecutor") {
							console.log(`     Action: ${toolCall.args.action}`);
							console.log(`     Task ID: ${toolCall.args.taskId}`);
						}
					});
				}
			});
			console.log(`\nTotal tool calls: ${toolCallCount}`);
		}

		// Check working memory
		if (agent.memory) {
			console.log("\n💾 Working Memory Check:");
			try {
				const memoryQuery = await agent.memory.query({
					threadId: result.threadId || `test-v1-1-${Date.now()}`,
					selectBy: { last: 1 },
				});

				if (memoryQuery.messages.length > 0) {
					const lastMessage = memoryQuery.messages[0];
					console.log("  Last message role:", lastMessage.role);

					// Try to find working memory updates
					if ("content" in lastMessage) {
						const content = lastMessage.content;
						if (Array.isArray(content)) {
							content.forEach((part) => {
								if (part.type === "tool-result" && part.toolName === "updateWorkingMemory") {
									console.log("  Working memory updated!");
									console.log("  Tasks:", JSON.stringify(part.result?.tasks || [], null, 2));
								}
							});
						}
					}
				}
			} catch (memError) {
				console.log("  Could not retrieve working memory:", memError);
			}
		}
	} catch (error) {
		console.error("❌ Error during generation:", error);
	}
}

// Run the test
testV1_1Agent().catch(console.error);
