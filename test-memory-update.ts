import { mastra } from "./mastra";

async function testMemoryUpdate() {
	console.log("Testing memory update with agent...");

	const agent = mastra.getAgent("V1Agent");
	if (!agent) {
		console.error("Agent not found");
		return;
	}

	// Test the agent with a task-triggering message
	const messages = [
		{
			role: "user" as const,
			content: "I need to build a web scraper. Please create a task list for this.",
		},
	];

	const options = {
		threadId: "test-memory-tasks",
		resourceId: "test-user",
	};

	console.log("Calling agent with:", { messages, options });

	try {
		const result = await agent.generate(messages, options);
		console.log("Agent response:", result);

		// Check if taskManagement tool was called
		if (result.steps && result.steps.length > 0) {
			console.log("Steps:", result.steps.length);
			result.steps.forEach((step: any, i: number) => {
				console.log(`Step ${i}:`, {
					type: step.type,
					toolCalls: step.toolCalls?.map((tc: any) => ({
						toolName: tc.toolName,
						args: tc.args,
					})),
				});
			});
		}
	} catch (error) {
		console.error("Error:", error);
	}
}

testMemoryUpdate().catch(console.error);
