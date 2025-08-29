import { createLightfast } from "lightfast/client";
import { createAgent } from "lightfast/agent";
import { gateway } from "@ai-sdk/gateway";

// Import agents from individual files
import { customerSupportAgent } from "./agents/customer-support.js";
import { codeReviewAgent } from "./agents/code-reviewer.js";
import { dataAnalystAgent } from "./agents/data-analyst.js";
import { contentWriterAgent } from "./agents/content-writer.js";

/**
 * Example Lightfast configuration with modular agent imports
 * Demonstrates how to organize agents in separate files for better maintainability
 */

// Inline agents for testing mixed import patterns
const codeGeneratorAgent = createAgent({
  name: "code-generator",
  system: `You are an expert programmer.
Generate clean, efficient, and well-documented code.
Always follow best practices and include proper error handling.

IMPORTANT: When displaying code, ALWAYS use triple backticks:
\`\`\`language
code here
\`\`\``,
  model: gateway("claude-3-5-sonnet-20241022"),
  // Code manipulation tools would be added here
  // tools: { writeFile: fileWriterTool, runTests: testRunnerTool },
});

const qaTestAgent = createAgent({
  name: "qa-tester", 
  system: `You are a QA engineer.
Find bugs, edge cases, and ensure quality.
Create comprehensive test plans and report issues clearly.`,
  model: gateway("gpt-4"),
  // Testing tools would be added here
  // tools: { runTests: testSuiteTool, fileReport: bugReportTool },
});

// Create and export the Lightfast configuration
const lightfast = createLightfast({
  agents: {
    customerSupport: customerSupportAgent,
    codeReviewer: codeReviewAgent,
    dataAnalyst: dataAnalystAgent,
    contentWriter: contentWriterAgent,
    codeGenerator: codeGeneratorAgent,
    qaTester: qaTestAgent,
  },
  metadata: {
    name: "Agent Chat Example",
    version: "1.0.0",
    description: "Example project demonstrating multiple AI agents with Lightfast",
  },
  dev: {
    port: 3000,
    hotReload: true,
    verbose: false,
  },
});

export default lightfast;