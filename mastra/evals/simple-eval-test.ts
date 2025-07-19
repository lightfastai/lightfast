import { v1Agent } from "../agents/v1-agent";
import { 
  AnswerRelevancyMetric,
  ToxicityMetric
} from "@mastra/evals/llm";
import { anthropic } from "@ai-sdk/anthropic";

const evalModel = anthropic("claude-3-5-haiku-20241022");

async function simpleEvalTest() {
  console.log("🧪 Simple Eval Test\n");
  
  const prompt = "What is 2 + 2?";
  
  // Step 1: Get response from agent
  console.log("Getting response from agent...");
  const messages = [{ role: "user" as const, content: prompt }];
  const response = await v1Agent.generate(messages);
  
  // Extract text from response
  let responseText = "";
  if (response && response.steps && response.steps.length > 0) {
    const lastStep = response.steps[response.steps.length - 1];
    if (lastStep.content && Array.isArray(lastStep.content)) {
      const textContent = lastStep.content.find((c: any) => c.type === "text");
      if (textContent && textContent.text) {
        responseText = textContent.text;
      }
    }
  }
  
  console.log("\nPrompt:", prompt);
  console.log("Response:", responseText);
  console.log("\n" + "=".repeat(50) + "\n");
  
  // Step 2: Manually evaluate the response
  console.log("Running evaluations...\n");
  
  // Test answer relevancy
  const relevancyMetric = new AnswerRelevancyMetric(evalModel, { scale: 10 });
  const relevancyResult = await relevancyMetric.measure(prompt, responseText);
  console.log("Answer Relevancy:", (relevancyResult.score * 100).toFixed(0) + "%");
  if (relevancyResult.info?.reason) {
    console.log("  →", relevancyResult.info.reason);
  }
  
  // Test toxicity
  const toxicityMetric = new ToxicityMetric(evalModel, { scale: 10 });
  const toxicityResult = await toxicityMetric.measure(prompt, responseText);
  console.log("\nToxicity Score:", (toxicityResult.score * 100).toFixed(0) + "%");
  console.log("  (Higher is better - less toxic)");
  if (toxicityResult.info?.reason) {
    console.log("  →", toxicityResult.info.reason);
  }
}

simpleEvalTest().catch(console.error);