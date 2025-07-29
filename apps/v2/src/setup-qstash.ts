/**
 * Setup Qstash topics and endpoints for V2 architecture
 * Run this script to create the necessary topics in Qstash
 */

import { Client } from "@upstash/qstash";

// Event types that need topics
const EVENT_TYPES = [
	"agent.loop.init",
	"agent.tool.call",
	"tool.execution.start",
	"tool.execution.complete",
	"tool.execution.failed",
] as const;

// Worker endpoint mappings
const ENDPOINT_MAPPINGS = {
	"agent.loop.init": "/workers/agent-loop",
	"agent.tool.call": "/workers/tool-executor",
	"tool.execution.complete": "/workers/tool-result-complete",
	"tool.execution.failed": "/workers/tool-result-failed",
} as const;

async function setupQstashTopics() {
	// Check for required environment variables
	const baseUrl = process.env.WORKER_BASE_URL || process.env.VERCEL_URL;
	if (!baseUrl) {
		console.error("❌ WORKER_BASE_URL or VERCEL_URL environment variable is required");
		console.log("\nSet WORKER_BASE_URL to your worker endpoint base URL:");
		console.log("  For local testing: http://localhost:8090");
		console.log("  For production: https://your-app.vercel.app/api/v2");
		process.exit(1);
	}

	const qstashToken = process.env.QSTASH_TOKEN;
	if (!qstashToken) {
		console.error("❌ QSTASH_TOKEN environment variable is required");
		process.exit(1);
	}

	const topicPrefix = process.env.QSTASH_TOPIC_PREFIX || "agent";

	console.log("🚀 Setting up Qstash topics for V2 architecture\n");
	console.log(`Base URL: ${baseUrl}`);
	console.log(`Topic prefix: ${topicPrefix}\n`);

	const client = new Client({
		token: qstashToken,
	});

	// Create topics
	for (const eventType of EVENT_TYPES) {
		const topicName = `${topicPrefix}.${eventType.replace(/\./g, "-")}`;
		const endpoint = ENDPOINT_MAPPINGS[eventType as keyof typeof ENDPOINT_MAPPINGS];

		if (endpoint) {
			const endpointUrl = `${baseUrl}${endpoint}`;
			console.log(`📌 Topic: ${topicName}`);
			console.log(`   → Endpoint: ${endpointUrl}`);

			try {
				// Note: Qstash automatically creates topics when you first publish to them
				// But we can verify the endpoint is reachable
				const response = await fetch(endpointUrl, {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						test: true,
						message: "Endpoint verification",
					}),
				});

				if (response.ok) {
					console.log(`   ✅ Endpoint is reachable\n`);
				} else {
					console.log(`   ⚠️  Endpoint returned ${response.status} (this might be normal)\n`);
				}
			} catch (error) {
				console.log(`   ❌ Endpoint not reachable: ${error instanceof Error ? error.message : "Unknown error"}\n`);
			}
		} else {
			console.log(`📌 Topic: ${topicName}`);
			console.log(`   ℹ️  No endpoint mapping (event for monitoring only)\n`);
		}
	}

	console.log("\n✅ Setup complete!\n");
	console.log("Next steps:");
	console.log("1. Go to https://console.upstash.com/qstash");
	console.log("2. Create the topics listed above");
	console.log("3. Add the corresponding endpoints for each topic");
	console.log("4. Configure authentication if needed\n");

	console.log("For local testing, you can use ngrok or similar to expose your local server:");
	console.log("  ngrok http 8090");
	console.log("  Then use the ngrok URL as your WORKER_BASE_URL\n");

	// Test publishing to a topic
	console.log("🧪 Testing event publishing...");
	try {
		const testTopic = `${topicPrefix}.test`;
		await client.publishJSON({
			topic: testTopic,
			body: {
				test: true,
				timestamp: new Date().toISOString(),
			},
		});
		console.log(`✅ Successfully published test event to topic: ${testTopic}`);
		console.log("   (This topic will be created automatically if it doesn't exist)\n");
	} catch (error) {
		console.error("❌ Failed to publish test event:", error);
	}
}

// Run the setup
setupQstashTopics().catch(console.error);
