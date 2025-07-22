import { mastra } from "../mastra";

async function testMessageSaving() {
	console.log("Testing message saving with tool parts...\n");

	// Get the A011 agent
	const agent = mastra.getAgent("A011");
	if (!agent) {
		console.error("Agent A011 not found");
		return;
	}

	const memory = agent.getMemory();
	if (!memory) {
		console.error("No memory instance found on agent");
		return;
	}

	// Create a test thread ID
	const testThreadId = `test-thread-${Date.now()}`;
	const testUserId = "test-user-123";

	// Test messages with different part types
	const testMessages = [
		{
			id: "msg1",
			role: "user" as const,
			parts: [{ type: "text", text: "This is a user message" }],
		},
		{
			id: "msg2",
			role: "assistant" as const,
			parts: [
				{ type: "text", text: "I'll help you with that." },
				{ type: "tool-call", toolCallId: "call1", toolName: "todoWrite", args: { todos: [] } },
			],
		},
		{
			id: "msg3",
			role: "assistant" as const,
			parts: [
				{ type: "tool-result", toolCallId: "call1", result: { success: true } },
				{ type: "text", text: "Task tracking has been set up." },
			],
		},
	];

	// Save messages using memory
	console.log("Saving test messages...");
	for (const msg of testMessages) {
		try {
			await memory.saveMessage({
				threadId: testThreadId,
				resourceId: testUserId,
				message: {
					id: msg.id,
					role: msg.role,
					parts: msg.parts,
					createdAt: new Date().toISOString(),
				},
			});
			console.log(`Saved message ${msg.id} with ${msg.parts.length} parts`);
		} catch (error) {
			console.error(`Error saving message ${msg.id}:`, error);
		}
	}

	// Query the messages back
	console.log("\nQuerying saved messages...");
	const result = await memory.query({
		threadId: testThreadId,
		selectBy: { last: 50 },
	});

	console.log(`Found ${result.messages.length} messages`);
	console.log(`Found ${result.uiMessages.length} UI messages`);

	// Inspect the UI messages
	console.log("\nUI Messages structure:");
	result.uiMessages.forEach((msg, index) => {
		console.log(`\nMessage ${index + 1} (${msg.id}):`);
		console.log(`  Role: ${msg.role}`);
		console.log(`  Parts (${msg.parts?.length || 0}):`);
		if (msg.parts) {
			msg.parts.forEach((part: any, partIndex: number) => {
				console.log(
					`    Part ${partIndex + 1}: type="${part.type}", hasText=${!!part.text}, keys=[${Object.keys(part).join(", ")}]`,
				);
			});
		}
	});

	// Check raw storage
	console.log("\nChecking raw storage...");
	const storage = (memory as any).storage;
	if (storage) {
		try {
			// Try to get raw data from storage
			const rawKey = `thread:${testThreadId}:messages`;
			const rawData = await storage.get(rawKey);
			if (rawData) {
				console.log("Raw storage data found");
				console.log(JSON.stringify(rawData, null, 2).substring(0, 500) + "...");
			} else {
				console.log("No raw data found with key:", rawKey);
			}
		} catch (error) {
			console.log("Could not access raw storage:", error);
		}
	}
}

testMessageSaving()
	.then(() => {
		console.log("\nTest completed");
		process.exit(0);
	})
	.catch((error) => {
		console.error("Test failed:", error);
		process.exit(1);
	});
