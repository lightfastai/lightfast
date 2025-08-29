import { createLightfast } from "lightfast/client";
import { createAgent } from "lightfast/agent";
import { gateway } from "@ai-sdk/gateway";
import { wrapLanguageModel } from "ai";

/**
 * Example Lightfast configuration with multiple agents
 * Based on the real implementation from apps/chat
 */

// Customer Support Agent
const customerSupportAgent = createAgent({
  name: "customer-support",
  system: `You are a helpful customer support agent. 
Be polite, professional, and solution-oriented.
Always aim to resolve customer issues efficiently.`,
  model: wrapLanguageModel({
    model: gateway("claude-3-5-sonnet-20241022"),
  }),
  // Tools would be added here in a real implementation
  // tools: { searchKB: searchKnowledgeBaseTool },
});

// Code Review Assistant
const codeReviewAgent = createAgent({
  name: "code-reviewer",
  system: `You are an expert code reviewer. 
Focus on code quality, security vulnerabilities, and best practices.
Provide constructive feedback with specific suggestions for improvement.`,
  model: wrapLanguageModel({
    model: gateway("claude-3-5-sonnet-20241022"),
  }),
  // Tools for code analysis would be added here
  // tools: { analyzeCode: codeAnalysisTool },
});

// Data Analysis Agent
const dataAnalystAgent = createAgent({
  name: "data-analyst",
  system: `You are a data analyst specialized in business intelligence.
Analyze data patterns, create visualizations, and provide actionable insights.
Always back your conclusions with data.`,
  model: wrapLanguageModel({
    model: gateway("gpt-4-turbo"),
  }),
  // Data processing tools would be added here
  // tools: { queryData: databaseQueryTool, createChart: chartTool },
});

// Content Writer Agent
const contentWriterAgent = createAgent({
  name: "content-writer",
  system: `You are a creative content writer.
Create engaging, SEO-friendly content that resonates with the target audience.
Use a clear, compelling writing style.`,
  model: wrapLanguageModel({
    model: gateway("claude-3-5-sonnet-20241022"),
  }),
  // No tools for this agent - pure generation
});

// Code Generator Agent
const codeGeneratorAgent = createAgent({
  name: "code-generator",
  system: `You are an expert programmer.
Generate clean, efficient, and well-documented code.
Always follow best practices and include proper error handling.

IMPORTANT: When displaying code, ALWAYS use triple backticks:
\`\`\`language
code here
\`\`\``,
  model: wrapLanguageModel({
    model: gateway("claude-3-5-sonnet-20241022"),
  }),
  // Code manipulation tools would be added here
  // tools: { writeFile: fileWriterTool, runTests: testRunnerTool },
});

// QA Test Agent
const qaTestAgent = createAgent({
  name: "qa-tester",
  system: `You are a QA engineer.
Find bugs, edge cases, and ensure quality.
Create comprehensive test plans and report issues clearly.`,
  model: wrapLanguageModel({
    model: gateway("gpt-4"),
  }),
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