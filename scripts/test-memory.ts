import { mastra } from "../mastra";

async function testMemory() {
	const threadId = "2QQkDCe8i3f7rmQ6NUxbN";
	console.log(`\n=== Testing Memory for Thread: ${threadId} ===\n`);

	try {
		// Get the agent
		const agent = mastra.getAgent("A011");
		if (!agent) {
			console.error("Agent A011 not found");
			return;
		}

		// Get the memory instance
		const memory = agent.getMemory();
		if (!memory) {
			console.error("No memory instance found on agent");
			return;
		}

		// Query the memory directly
		console.log("Querying memory...");
		const result = await memory.query({
			threadId,
			selectBy: {
				last: 50,
			},
		});

		console.log(`\nFound ${result.messages.length} messages`);
		console.log(`Found ${result.uiMessages.length} UI messages`);

		// Display messages
		console.log("\n=== Messages ===");
		result.messages.forEach((msg, index) => {
			console.log(`\n[${index + 1}] ${msg.role}:`);
			if (msg.content) {
				console.log(`  Content: ${JSON.stringify(msg.content).substring(0, 100)}...`);
			}
		});

		// Display UI messages in detail
		console.log("\n=== UI Messages (Detailed) ===");
		result.uiMessages.forEach((msg, index) => {
			console.log(`\n[${index + 1}] ${msg.role} (id: ${msg.id}):`);
			console.log(`  Parts: ${msg.parts.length}`);
			msg.parts.forEach((part, partIndex) => {
				console.log(`    Part ${partIndex + 1}: ${part.type}`);
				if (part.type === "text") {
					console.log(`      Text: ${(part as any).text?.substring(0, 100)}...`);
				}
			});
		});

		// Check if there's a thread stored
		const thread = await memory.getThreadById({ threadId });
		console.log("\n=== Thread Info ===");
		console.log(thread ? JSON.stringify(thread, null, 2) : "No thread found");

		// Check all threads for the resource
		const resourceId = "user_30DLXbs9No9K3g44wAgd6XCpir0";
		const threads = await memory.getThreadsByResourceId({ resourceId });
		console.log(`\n=== All Threads for Resource ${resourceId} ===`);
		console.log(`Found ${threads.length} threads`);
		threads.forEach((t) => {
			console.log(`- ${t.id}: ${t.title || "Untitled"} (created: ${t.createdAt})`);
		});
	} catch (error) {
		console.error("Error testing memory:", error);
	}
}

// Run the test
testMemory()
	.then(() => {
		console.log("\n=== Test Complete ===");
		process.exit(0);
	})
	.catch((error) => {
		console.error("Test failed:", error);
		process.exit(1);
	});
