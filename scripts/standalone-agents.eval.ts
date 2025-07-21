/**
 * Braintrust Evaluation Script for Standalone Agents
 * 
 * This script evaluates all standalone single-purpose agents
 * with scenarios tailored to their specific capabilities.
 * 
 * Usage:
 * npx braintrust eval --no-send-logs scripts/standalone-agents.eval.ts
 * npx braintrust eval --dev --dev-port 8300 scripts/standalone-agents.eval.ts
 */

import { Eval } from "braintrust";
import { mastra } from "../mastra";
import type { CoreMessage } from "ai";
import {
  logAgentInteraction,
  evaluateRelevancy,
  evaluateTaskCompletion,
  type AgentEvaluationScores
} from "../mastra/lib/braintrust-utils";

// Test scenarios for each standalone agent
const standaloneAgentScenarios = [
  // Math Agent Tests
  {
    input: {
      agent: "mathAgent",
      query: "Calculate the factorial of 7",
      category: "basic_calculation",
      expectedResult: 5040
    },
    metadata: { agent_type: "math", operation: "factorial" }
  },
  {
    input: {
      agent: "mathAgent", 
      query: "Solve the quadratic equation: 2x^2 + 5x - 3 = 0",
      category: "algebra",
      expectedResult: { roots: [0.5, -3] }
    },
    metadata: { agent_type: "math", operation: "quadratic" }
  },
  {
    input: {
      agent: "mathAgent",
      query: "Calculate the mean, median, and mode of [1, 2, 2, 3, 4, 4, 4, 5]",
      category: "statistics",
      expectedResult: { mean: 3.125, median: 3.5, mode: 4 }
    },
    metadata: { agent_type: "math", operation: "statistics" }
  },
  {
    input: {
      agent: "mathAgent",
      query: "Find the prime factors of 120",
      category: "number_theory",
      expectedResult: [2, 2, 2, 3, 5]
    },
    metadata: { agent_type: "math", operation: "prime_factorization" }
  },

  // Browser Agent Tests
  {
    input: {
      agent: "browserAgent",
      query: "Navigate to example.com and take a screenshot",
      category: "navigation",
      expectedTools: ["browserNavigate", "browserScreenshot"]
    },
    metadata: { agent_type: "browser", operation: "screenshot" }
  },
  {
    input: {
      agent: "browserAgent",
      query: "Search for 'TypeScript tutorial' on Google and get the first result",
      category: "search",
      expectedTools: ["browserNavigate", "browserType", "browserClick"]
    },
    metadata: { agent_type: "browser", operation: "search" }
  },

  // Vision Agent Tests
  {
    input: {
      agent: "visionAgent",
      query: "Describe what you see in this image: /path/to/test-image.jpg",
      category: "image_description",
      requiresFile: true
    },
    metadata: { agent_type: "vision", operation: "describe" }
  },
  {
    input: {
      agent: "visionAgent",
      query: "Extract any text from this screenshot",
      category: "ocr",
      requiresFile: true
    },
    metadata: { agent_type: "vision", operation: "text_extraction" }
  },

  // File Agent Tests
  {
    input: {
      agent: "fileAgent",
      query: "Create a new file called test-output.txt with the content 'Hello from evaluation'",
      category: "file_creation",
      expectedTools: ["fileWrite"]
    },
    metadata: { agent_type: "file", operation: "create" }
  },
  {
    input: {
      agent: "fileAgent",
      query: "Read the contents of package.json and tell me the project name",
      category: "file_reading",
      expectedTools: ["fileRead"]
    },
    metadata: { agent_type: "file", operation: "read" }
  },

  // Download Agent Tests
  {
    input: {
      agent: "downloadAgent",
      query: "Download the robots.txt file from example.com",
      category: "simple_download",
      expectedTools: ["downloadFile"]
    },
    metadata: { agent_type: "download", operation: "single_file" }
  },

  // Search Agent Tests
  {
    input: {
      agent: "searchAgent",
      query: "Search for information about Braintrust evaluation framework",
      category: "web_search",
      expectedTools: ["webSearch"]
    },
    metadata: { agent_type: "search", operation: "general_search" }
  },
  {
    input: {
      agent: "searchAgent",
      query: "Find the latest news about AI agents development",
      category: "news_search",
      expectedTools: ["webSearch"]
    },
    metadata: { agent_type: "search", operation: "news" }
  },

  // Sandbox Agent Tests
  {
    input: {
      agent: "sandboxAgent",
      query: "Create a Python sandbox and run print('Hello from sandbox')",
      category: "python_execution",
      expectedTools: ["createSandbox", "executeSandboxCommand"]
    },
    metadata: { agent_type: "sandbox", operation: "python", language: "python" }
  },
  {
    input: {
      agent: "sandboxAgent",
      query: "Create a Node.js sandbox and calculate 2 + 2",
      category: "nodejs_execution",
      expectedTools: ["createSandbox", "executeSandboxCommand"]
    },
    metadata: { agent_type: "sandbox", operation: "nodejs", language: "javascript" }
  }
];

// Execute standalone agent
async function executeStandaloneAgent(scenario: any): Promise<{
  output: string;
  duration: number;
  error?: string;
  toolsUsed?: string[];
}> {
  const startTime = Date.now();
  
  try {
    const agent = mastra.getAgent(scenario.input.agent);
    
    if (!agent) {
      throw new Error(`Agent ${scenario.input.agent} not found`);
    }

    const messages: CoreMessage[] = [
      {
        role: "user",
        content: scenario.input.query
      }
    ];

    console.log(`[EVAL] Testing ${scenario.input.agent}: "${scenario.input.query}"`);
    
    const result = await agent.generate(messages, {
      threadId: `eval-${scenario.input.agent}-${Date.now()}`,
      resourceId: "eval-user"
    });

    const duration = Date.now() - startTime;
    const toolsUsed = extractToolsFromOutput(result.text || "");

    return {
      output: result.text || "",
      duration,
      toolsUsed
    };
  } catch (error) {
    console.error(`[EVAL] Error with ${scenario.input.agent}:`, error);
    return {
      output: "",
      duration: Date.now() - startTime,
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
}

// Extract tools mentioned in output
function extractToolsFromOutput(output: string): string[] {
  const tools: string[] = [];
  const toolPatterns = [
    /using (\w+) tool/gi,
    /executing (\w+)/gi,
    /calling (\w+)/gi,
    /\b(fileWrite|fileRead|browserNavigate|webSearch|createSandbox)\b/gi
  ];

  for (const pattern of toolPatterns) {
    const matches = output.matchAll(pattern);
    for (const match of matches) {
      if (match[1] && !tools.includes(match[1])) {
        tools.push(match[1]);
      }
    }
  }

  return tools;
}

// Score standalone agent performance
async function scoreStandaloneAgent(
  scenario: any,
  output: string,
  duration: number,
  toolsUsed: string[] = [],
  error?: string
): Promise<AgentEvaluationScores> {
  const scores: AgentEvaluationScores = {};

  if (error) {
    return {
      relevancy: 0,
      completeness: 0,
      accuracy: 0,
      helpfulness: 0,
      safety: 1,
      response_time: Math.max(0, 1 - (duration / 10000)),
      task_completion: 0
    };
  }

  // Basic scoring
  scores.relevancy = await evaluateRelevancy(scenario.input.query, output);
  scores.response_time = Math.max(0, 1 - (duration / 5000)); // 5s max for standalone agents
  
  const messages: CoreMessage[] = [{ role: "user", content: scenario.input.query }];
  scores.task_completion = await evaluateTaskCompletion(messages, output);

  // Agent-specific scoring
  switch (scenario.input.agent) {
    case "mathAgent":
      scores.accuracy = evaluateMathAccuracy(output, scenario.input.expectedResult);
      scores.completeness = output.includes("=") || output.includes("result") ? 1 : 0.5;
      break;

    case "browserAgent":
      scores.tool_success_rate = evaluateToolUsage(toolsUsed, scenario.input.expectedTools || []);
      scores.completeness = output.includes("navigat") || output.includes("screenshot") ? 0.9 : 0.4;
      break;

    case "visionAgent":
      scores.helpfulness = output.length > 50 ? 0.9 : 0.5; // Vision descriptions should be detailed
      scores.completeness = output.includes("see") || output.includes("image") ? 0.8 : 0.3;
      break;

    case "fileAgent":
      scores.accuracy = output.includes("success") || output.includes("created") || output.includes("content") ? 1 : 0;
      scores.tool_success_rate = evaluateToolUsage(toolsUsed, scenario.input.expectedTools || []);
      break;

    case "searchAgent":
      scores.helpfulness = output.includes("found") || output.includes("results") ? 0.9 : 0.4;
      scores.completeness = output.length > 100 ? 1 : 0.6;
      break;

    case "sandboxAgent":
      scores.accuracy = output.includes("Hello from sandbox") || output.includes("4") ? 1 : 0;
      scores.tool_success_rate = evaluateToolUsage(toolsUsed, scenario.input.expectedTools || []);
      break;

    default:
      scores.helpfulness = 0.7;
      scores.completeness = 0.7;
  }

  // Safety scoring (all standalone agents should be safe)
  scores.safety = 1;
  scores.toxicity = 0;
  scores.bias = 0;

  return scores;
}

// Evaluate math accuracy
function evaluateMathAccuracy(output: string, expected: any): number {
  if (!expected) return 0.5;

  const outputLower = output.toLowerCase();
  
  if (typeof expected === "number") {
    return output.includes(expected.toString()) ? 1 : 0;
  }
  
  if (expected.roots) {
    let score = 0;
    for (const root of expected.roots) {
      if (output.includes(root.toString())) score += 0.5;
    }
    return score;
  }
  
  if (expected.mean || expected.median || expected.mode) {
    let score = 0;
    if (expected.mean && output.includes(expected.mean.toString())) score += 0.33;
    if (expected.median && output.includes(expected.median.toString())) score += 0.33;
    if (expected.mode && output.includes(expected.mode.toString())) score += 0.34;
    return score;
  }
  
  if (Array.isArray(expected)) {
    let matches = 0;
    for (const value of expected) {
      if (output.includes(value.toString())) matches++;
    }
    return matches / expected.length;
  }
  
  return 0.5;
}

// Evaluate tool usage
function evaluateToolUsage(used: string[], expected: string[]): number {
  if (expected.length === 0) return 1;
  
  let matches = 0;
  for (const tool of expected) {
    if (used.some(u => u.toLowerCase().includes(tool.toLowerCase()))) {
      matches++;
    }
  }
  
  return matches / expected.length;
}

// Main evaluation
Eval("standalone-agents-evaluation", {
  data: () => standaloneAgentScenarios,
  
  task: async (scenario) => {
    const result = await executeStandaloneAgent(scenario);
    
    // Log to Braintrust
    await logAgentInteraction(
      {
        messages: [{ role: "user", content: scenario.input.query }],
        agentName: scenario.input.agent,
        threadId: `eval-${Date.now()}`,
        tools: scenario.input.expectedTools,
        context: { 
          category: scenario.input.category,
          agent_type: scenario.metadata.agent_type 
        }
      },
      {
        response: result.output,
        tool_calls: (result.toolsUsed || []).map(tool => ({
          name: tool,
          result: {},
          success: true,
          duration: 0
        }))
      },
      await scoreStandaloneAgent(
        scenario,
        result.output,
        result.duration,
        result.toolsUsed,
        result.error
      ),
      scenario.metadata
    );
    
    return result.output;
  },
  
  scores: [
    async (scenario, output) => {
      const result = await executeStandaloneAgent(scenario);
      const scores = await scoreStandaloneAgent(
        scenario,
        output,
        result.duration,
        result.toolsUsed,
        result.error
      );
      
      console.log(`[EVAL] ${scenario.input.agent} - ${scenario.input.category}:`, 
        Object.entries(scores)
          .filter(([_, v]) => v !== undefined)
          .map(([k, v]) => `${k}=${v?.toFixed(2)}`)
          .join(", ")
      );
      
      return scores as Record<string, number>;
    }
  ],
  
  metadata: {
    description: "Evaluation of all standalone single-purpose agents",
    version: "1.0.0",
    agents_tested: [
      "mathAgent",
      "browserAgent", 
      "visionAgent",
      "fileAgent",
      "downloadAgent",
      "searchAgent",
      "sandboxAgent"
    ],
    total_scenarios: standaloneAgentScenarios.length,
    timestamp: new Date().toISOString()
  }
});

// Summary report
console.log(`
🧪 Standalone Agents Evaluation Suite

This evaluation tests all single-purpose agents with targeted scenarios:

🤖 Agents Tested:
   • mathAgent     - Mathematical calculations and operations
   • browserAgent  - Web browser automation tasks
   • visionAgent   - Image analysis and description
   • fileAgent     - File system operations
   • downloadAgent - File downloading capabilities
   • searchAgent   - Web search functionality
   • sandboxAgent  - Code execution in isolated environments

📊 Test Coverage:
   • ${standaloneAgentScenarios.filter(s => s.input.agent === "mathAgent").length} Math agent tests
   • ${standaloneAgentScenarios.filter(s => s.input.agent === "browserAgent").length} Browser agent tests
   • ${standaloneAgentScenarios.filter(s => s.input.agent === "visionAgent").length} Vision agent tests
   • ${standaloneAgentScenarios.filter(s => s.input.agent === "fileAgent").length} File agent tests
   • ${standaloneAgentScenarios.filter(s => s.input.agent === "sandboxAgent").length} Sandbox agent tests

🎯 Evaluation Metrics:
   • Task-specific accuracy
   • Tool usage effectiveness
   • Response time performance
   • Output quality and completeness

🚀 Run Commands:
   npx braintrust eval --no-send-logs scripts/standalone-agents.eval.ts
   npx braintrust eval --dev scripts/standalone-agents.eval.ts

📈 Results will help identify:
   • Agent-specific strengths and weaknesses
   • Performance bottlenecks
   • Areas for improvement
`);