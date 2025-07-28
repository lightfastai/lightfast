#!/usr/bin/env tsx

/**
 * Setup Qstash Topics for V2 Event-Driven Architecture
 * 
 * This script creates all required Qstash topics for the agent system.
 * Run this once to set up your Qstash environment.
 */

import { Client } from "@upstash/qstash";
import dotenv from "dotenv";
import { resolve } from "path";

// Load environment variables
dotenv.config({ path: resolve(__dirname, "../apps/www/.vercel/.env.development.local") });

async function setupQstashTopics() {
	const qstashUrl = process.env.QSTASH_URL;
	const qstashToken = process.env.QSTASH_TOKEN;
	const topicPrefix = process.env.QSTASH_TOPIC_PREFIX || "agent";

	if (!qstashUrl || !qstashToken) {
		console.error("❌ Missing QSTASH_URL or QSTASH_TOKEN environment variables");
		process.exit(1);
	}

	console.log("🚀 Setting up Qstash topics...");
	console.log(`📍 Using URL: ${qstashUrl}`);
	console.log(`🏷️  Topic prefix: ${topicPrefix}`);

	const client = new Client({
		token: qstashToken,
	});

	// Define all topics based on the event types
	const topics = [
		// Agent Loop Events
		`${topicPrefix}.agent-loop-init`,
		`${topicPrefix}.agent-loop-start`,
		`${topicPrefix}.agent-loop-complete`,
		`${topicPrefix}.agent-loop-error`,
		
		// Agent Decision Events
		`${topicPrefix}.agent-tool-call`,
		`${topicPrefix}.agent-clarification`,
		`${topicPrefix}.agent-response`,
		
		// Tool Execution Events
		`${topicPrefix}.tool-execution-start`,
		`${topicPrefix}.tool-execution-complete`,
		`${topicPrefix}.tool-execution-failed`,
		
		// Stream Events
		`${topicPrefix}.stream-write`,
		`${topicPrefix}.stream-complete`,
	];

	console.log(`\n📋 Creating ${topics.length} topics...`);

	for (const topic of topics) {
		try {
			// Create topic with endpoints
			const endpoints = getEndpointsForTopic(topic);
			
			console.log(`\n📌 Creating topic: ${topic}`);
			
			// Create the topic by publishing a test message
			// Qstash automatically creates topics on first publish
			await client.publishJSON({
				topic,
				body: {
					type: "topic.setup",
					message: "Topic created by setup script",
					timestamp: new Date().toISOString(),
				},
			});
			
			console.log(`   ✅ Topic created: ${topic}`);
			
			// If you need to add specific endpoints, you would do it here
			// Note: Qstash API doesn't have a direct "create topic" endpoint,
			// topics are created automatically when you publish to them
			
		} catch (error) {
			console.error(`   ❌ Failed to create topic ${topic}:`, error);
		}
	}

	console.log("\n✨ Qstash topic setup complete!");
	console.log("\n📝 Next steps:");
	console.log("1. Configure your worker endpoints in Qstash dashboard");
	console.log("2. Set up retry policies for each topic");
	console.log("3. Configure DLQ (Dead Letter Queue) for failed messages");
}

// Helper function to determine endpoints for each topic
function getEndpointsForTopic(topic: string): string[] {
	const workerBaseUrl = process.env.WORKER_BASE_URL || "https://your-app.vercel.app";
	
	// Map topics to their worker endpoints
	const topicEndpointMap: Record<string, string[]> = {
		"agent-loop-init": [`${workerBaseUrl}/api/v2/workers/agent-loop`],
		"agent-loop-start": [`${workerBaseUrl}/api/v2/workers/agent-loop`],
		"agent-loop-complete": [`${workerBaseUrl}/api/v2/workers/agent-complete`],
		"agent-loop-error": [`${workerBaseUrl}/api/v2/workers/agent-error`],
		"agent-tool-call": [`${workerBaseUrl}/api/v2/workers/tool-executor`],
		"tool-execution-complete": [`${workerBaseUrl}/api/v2/workers/tool-result-complete`],
		"tool-execution-failed": [`${workerBaseUrl}/api/v2/workers/tool-result-failed`],
	};

	// Extract the topic name without prefix
	const topicName = topic.split(".").slice(1).join(".");
	return topicEndpointMap[topicName] || [];
}

// Run the setup
setupQstashTopics().catch(console.error);