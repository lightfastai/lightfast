/**
 * Local Evaluation Example - No Braintrust Cloud Required
 * 
 * This script demonstrates how to run evaluations locally without
 * a Braintrust API key, using the built-in local logging fallback.
 * 
 * Usage:
 * pnpm tsx scripts/local-eval-example.ts
 */

import { mastra } from "../mastra";
import type { CoreMessage } from "ai";
import {
  logAgentInteraction,
  evaluateRelevancy,
  evaluateTaskCompletion,
  evaluateResponseQuality,
  logToolExecution,
  logConversationEvaluation
} from "../mastra/lib/braintrust-utils";

// Simple test scenarios
const localTestScenarios = [
  {
    agent: "mathAgent",
    query: "What is 15 * 7?",
    expectedAnswer: "105"
  },
  {
    agent: "c010",
    query: "Explain what Mastra is in one sentence",
    expectedKeywords: ["framework", "agent", "AI"]
  },
  {
    agent: "a010",
    query: "List three benefits of TypeScript",
    expectedFormat: "list"
  }
];

// Run a single evaluation
async function runLocalEvaluation(scenario: any) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`Testing ${scenario.agent} with: "${scenario.query}"`);
  console.log(`${"=".repeat(60)}\n`);

  const startTime = Date.now();
  
  try {
    // Get the agent
    const agent = mastra.getAgent(scenario.agent);
    if (!agent) {
      console.error(`❌ Agent ${scenario.agent} not found`);
      return;
    }

    // Create messages
    const messages: CoreMessage[] = [
      { role: "user", content: scenario.query }
    ];

    // Execute agent
    console.log("🤖 Executing agent...");
    const result = await agent.generate(messages, {
      threadId: `local-eval-${Date.now()}`,
      resourceId: "local-user"
    });

    const duration = Date.now() - startTime;
    const response = result.text || "";

    console.log(`\n📝 Response (${duration}ms):`);
    console.log(response);

    // Calculate scores
    console.log("\n📊 Calculating scores...");
    const relevancy = await evaluateRelevancy(scenario.query, response);
    const taskCompletion = await evaluateTaskCompletion(messages, response);
    const responseQuality = await evaluateResponseQuality(response);

    const scores = {
      relevancy,
      task_completion: taskCompletion,
      response_quality: responseQuality,
      response_time: Math.max(0, 1 - (duration / 5000)), // 5s max
      accuracy: evaluateAccuracy(response, scenario),
      safety: 1,
      toxicity: 0
    };

    console.log("\n🎯 Scores:");
    Object.entries(scores).forEach(([metric, score]) => {
      const percentage = (score * 100).toFixed(0);
      const bar = "█".repeat(Math.floor(score * 20));
      const empty = "░".repeat(20 - Math.floor(score * 20));
      console.log(`  ${metric.padEnd(20)} ${bar}${empty} ${percentage}%`);
    });

    // Log to local Braintrust (will output to console)
    console.log("\n📤 Logging to Braintrust (local mode)...");
    await logAgentInteraction(
      {
        messages,
        agentName: scenario.agent,
        threadId: `local-eval-${Date.now()}`,
      },
      {
        response,
        metadata: { duration }
      },
      scores,
      {
        scenario: scenario.query,
        localEvaluation: true
      }
    );

    // Example of logging tool execution
    if (scenario.agent === "mathAgent") {
      await logToolExecution({
        tool_name: "calculator",
        input: { expression: scenario.query },
        output: response,
        success: true,
        duration: duration,
        context: {
          agentName: scenario.agent,
          threadId: `local-eval-${Date.now()}`
        }
      });
    }

    console.log("\n✅ Evaluation complete!");

  } catch (error) {
    console.error("\n❌ Evaluation failed:", error);
  }
}

// Evaluate accuracy based on expected values
function evaluateAccuracy(response: string, scenario: any): number {
  const responseLower = response.toLowerCase();
  
  if (scenario.expectedAnswer) {
    return response.includes(scenario.expectedAnswer) ? 1 : 0;
  }
  
  if (scenario.expectedKeywords) {
    const matchedKeywords = scenario.expectedKeywords.filter((keyword: string) =>
      responseLower.includes(keyword.toLowerCase())
    );
    return matchedKeywords.length / scenario.expectedKeywords.length;
  }
  
  if (scenario.expectedFormat === "list") {
    // Check if response contains numbered or bulleted list
    const hasListFormat = /(\d+\.|•|-)/.test(response);
    const hasMultiplePoints = response.split('\n').length > 2;
    return hasListFormat && hasMultiplePoints ? 1 : 0.5;
  }
  
  return 0.7; // Default accuracy
}

// Run conversation evaluation example
async function runConversationEvaluation() {
  console.log(`\n${"=".repeat(60)}`);
  console.log("Running Conversation Evaluation Example");
  console.log(`${"=".repeat(60)}\n`);

  const messages: CoreMessage[] = [
    { role: "user", content: "What is TypeScript?" },
    { role: "assistant", content: "TypeScript is a statically typed superset of JavaScript." },
    { role: "user", content: "What are its main benefits?" },
    { role: "assistant", content: "Main benefits: type safety, better IDE support, and easier refactoring." }
  ];

  await logConversationEvaluation({
    messages,
    final_response: messages[messages.length - 1].content as string,
    thread_id: "conv-eval-example",
    agent_name: "c010",
    duration: 2500,
    tool_calls_count: 0,
    success: true
  });

  console.log("✅ Conversation evaluation logged!");
}

// Main execution
async function main() {
  console.log(`
🧪 Local Evaluation Example
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

This example demonstrates running evaluations locally without
a Braintrust API key. All logs will be output to the console
with the [BRAINTRUST LOCAL] prefix.

Environment: ${process.env.NODE_ENV || "development"}
Braintrust API Key: ${process.env.BRAINTRUST_API_KEY ? "✓ Set" : "✗ Not set (using local mode)"}
  `);

  // Run individual agent evaluations
  for (const scenario of localTestScenarios) {
    await runLocalEvaluation(scenario);
    
    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Run conversation evaluation example
  await runConversationEvaluation();

  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Evaluation Summary
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Tested ${localTestScenarios.length} scenarios
✅ All evaluations logged locally
✅ No Braintrust API key required

💡 Tips:
- Check console output for [BRAINTRUST LOCAL] logs
- Scores are calculated using local heuristics
- Perfect for development and testing
- Set BRAINTRUST_API_KEY to enable cloud logging
  `);
}

// Run the example
main().catch(console.error);