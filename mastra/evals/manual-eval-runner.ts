import { evaluate } from "@mastra/evals";
import { 
  HallucinationMetric,
  FaithfulnessMetric,
  AnswerRelevancyMetric,
  PromptAlignmentMetric,
  ToxicityMetric
} from "@mastra/evals/llm";
import { anthropic } from "@ai-sdk/anthropic";
import { v1Agent } from "../agents/v1-agent";

// Model for eval judgments
const evalModel = anthropic("claude-3-5-haiku-20241022");

// Define metrics separately
const metrics = {
  hallucination: new HallucinationMetric(evalModel, { scale: 10 }),
  faithfulness: new FaithfulnessMetric(evalModel, { scale: 10 }),
  answerRelevancy: new AnswerRelevancyMetric(evalModel, { scale: 10 }),
  promptAlignment: new PromptAlignmentMetric(evalModel, { scale: 10 }),
  toxicity: new ToxicityMetric(evalModel, { scale: 10 }),
};

/**
 * Manually run evaluations on agent output
 */
export async function evaluateAgentResponse(
  input: string,
  output: string,
  selectedMetrics: (keyof typeof metrics)[] = Object.keys(metrics) as (keyof typeof metrics)[]
) {
  const results: Record<string, any> = {};
  
  console.log("🔄 Running evaluations...\n");
  
  for (const metricName of selectedMetrics) {
    if (metricName in metrics) {
      try {
        console.log(`  Evaluating ${metricName}...`);
        const metric = metrics[metricName];
        const result = await metric.measure(input, output);
        results[metricName] = result;
      } catch (error) {
        console.error(`  ❌ Error evaluating ${metricName}:`, error.message);
        results[metricName] = { score: 0, error: error.message };
      }
    }
  }
  
  return results;
}

/**
 * Test V1 agent with manual eval execution
 */
export async function testV1WithManualEvals(prompt: string = "What is 2 + 2?") {
  console.log("🧪 Testing V1 Agent with Manual Evals\n");
  console.log(`Prompt: "${prompt}"\n`);
  
  try {
    // Step 1: Generate response
    console.log("📝 Generating response...");
    const response = await v1Agent.generate(prompt, {
      threadId: `test-${Date.now()}`,
      resourceId: "eval-test"
    });
    
    // Debug response structure
    console.log("\nDebug - Response structure:", Object.keys(response));
    console.log("Debug - Response type:", typeof response);
    console.log("Debug - Full response:", JSON.stringify(response, null, 2).substring(0, 500));
    
    // Get the actual text response - check different possible locations
    let outputText = "";
    if (typeof response === "string") {
      outputText = response;
    } else if (response.text) {
      outputText = response.text;
    } else if (response.resolvedOutput) {
      outputText = response.resolvedOutput;
    } else if (response.steps && response.steps.length > 0) {
      // Check if text is in steps
      const lastStep = response.steps[response.steps.length - 1];
      if (lastStep.content && Array.isArray(lastStep.content)) {
        const textContent = lastStep.content.find((c: any) => c.type === "text");
        if (textContent && textContent.text) {
          outputText = textContent.text;
        }
      }
    }
    
    console.log("\nResponse:");
    console.log(outputText);
    console.log("\n" + "=".repeat(50) + "\n");
    
    // Step 2: Run evaluations manually
    const evalResults = await evaluateAgentResponse(prompt, outputText);
    
    // Step 3: Display results
    console.log("📊 Evaluation Results:");
    
    for (const [metric, result] of Object.entries(evalResults)) {
      if (result.error) {
        console.log(`  ❌ ${metric}: Error - ${result.error}`);
      } else {
        const score = (result.score * 100).toFixed(0);
        const emoji = result.score > 0.8 ? "✅" : result.score > 0.6 ? "⚠️" : "❌";
        console.log(`  ${emoji} ${metric}: ${score}%`);
        
        if (result.info?.reason) {
          console.log(`     → ${result.info.reason}`);
        }
      }
    }
    
    // Calculate average score
    const validScores = Object.values(evalResults)
      .filter((r: any) => !r.error)
      .map((r: any) => r.score);
    
    if (validScores.length > 0) {
      const avgScore = validScores.reduce((a, b) => a + b, 0) / validScores.length;
      console.log(`\n📈 Average Score: ${(avgScore * 100).toFixed(0)}%`);
    }
    
    return { response, evalResults };
    
  } catch (error) {
    console.error("❌ Error:", error);
    throw error;
  }
}

// If running directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const testPrompt = process.argv[2] || "Create a simple Python script that prints hello world";
  testV1WithManualEvals(testPrompt).catch(console.error);
}