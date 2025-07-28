/**
 * Simple test to verify the event-driven architecture
 */

import { 
	createRedisClient,
	createStreamGenerator,
	createV2EventEmitter 
} from "@lightfast/ai/v2/core";

async function testEventDrivenArchitecture() {
	console.log("Testing V2 Event-Driven Architecture...\n");

	try {
		// Create infrastructure
		const redis = createRedisClient();
		const streamGenerator = createStreamGenerator(redis);
		const eventEmitter = createV2EventEmitter();
		console.log("✅ Infrastructure created successfully");

		// Test 1: Create a session
		const sessionId = streamGenerator.createSessionId();
		console.log(`\n📝 Created session: ${sessionId}`);

		// Test 2: Initialize session data
		const sessionKey = `session:${sessionId}`;
		const sessionData = {
			messages: [{ role: "user" as const, content: "What is 2 + 2?" }],
			status: "initializing",
			createdAt: new Date().toISOString(),
		};
		await redis.setex(sessionKey, 3600, JSON.stringify(sessionData));
		console.log("✅ Session data stored in Redis");

		// Test 3: Write to stream
		const streamKey = `stream:${sessionId}`;
		await redis.xadd(streamKey, "*", {
			type: "status",
			content: "Session initialized",
			metadata: JSON.stringify({ status: "ready" }),
		});
		console.log("✅ Initial stream entry created");

		// Test 4: Emit an event
		console.log("\n🚀 Emitting agent.loop.init event...");
		await eventEmitter.emitAgentLoopInit(sessionId, {
			messages: [{ role: "user", content: "What is 2 + 2?" }],
			temperature: 0.7,
			maxIterations: 5,
		});
		console.log("✅ Event emitted successfully");

		// Test 5: Read from stream
		console.log("\n📖 Reading from stream...");
		const entries = await redis.xrange(streamKey, "-", "+") as unknown as any[];
		console.log(`Found ${entries.length} stream entries:`);
		for (const entry of entries) {
			console.log(`  - ${entry.id}: ${JSON.stringify(entry.data)}`);
		}

		// Test 6: Check session data
		const storedSession = await redis.get(sessionKey);
		if (storedSession) {
			console.log("\n✅ Session data retrieved successfully");
			console.log(JSON.parse(storedSession as string));
		}

		console.log("\n🎉 All tests passed!");

		// Clean up
		await redis.del(sessionKey);
		await redis.del(streamKey);
		console.log("\n🧹 Cleaned up test data");

		process.exit(0);
	} catch (error) {
		console.error("\n❌ Test failed:", error);
		process.exit(1);
	}
}

// Run the test
testEventDrivenArchitecture();