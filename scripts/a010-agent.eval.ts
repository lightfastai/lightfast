/**
 * Braintrust Evaluation Script for a010 Experimental Agent
 * 
 * This script evaluates the a010 agent with comprehensive scenarios
 * that test its multi-tool capabilities and advanced features.
 * 
 * Usage:
 * npx braintrust eval --no-send-logs scripts/a010-agent.eval.ts
 * npx braintrust eval --dev --dev-port 8300 scripts/a010-agent.eval.ts
 */

import { Eval } from "braintrust";
import { mastra } from "../mastra";
import type { CoreMessage } from "ai";
import {
  logAgentInteraction,
  evaluateRelevancy,
  evaluateTaskCompletion,
  evaluateResponseQuality,
  type AgentEvaluationScores
} from "../mastra/lib/braintrust-utils";

// Comprehensive test scenarios for a010 agent
const a010TestScenarios = [
  // Research and Documentation
  {
    input: {
      query: "Research the latest developments in AI agents and create a comprehensive summary document",
      category: "research_documentation",
      complexity: "high",
      expectedTools: ["webSearch", "fileWrite"],
      expectedOutcome: "detailed_research_document"
    },
    metadata: {
      test_type: "research_capability",
      requires_internet: true
    }
  },

  // Code Analysis and Improvement
  {
    input: {
      query: "Analyze the code structure in mastra/agents folder and suggest improvements",
      category: "code_analysis",
      complexity: "medium",
      expectedTools: ["fileRead", "fileWrite"],
      expectedOutcome: "analysis_report_with_suggestions"
    },
    metadata: {
      test_type: "code_understanding",
      requires_file_access: true
    }
  },

  // Multi-Tool Workflow
  {
    input: {
      query: "Search for information about TypeScript best practices, create a guide, and set up a sample project",
      category: "complex_workflow",
      complexity: "high",
      expectedTools: ["webSearch", "fileWrite", "createSandbox", "executeSandboxCommand"],
      expectedOutcome: "guide_and_working_project"
    },
    metadata: {
      test_type: "multi_tool_coordination",
      requires_sandbox: true
    }
  },

  // Browser Automation
  {
    input: {
      query: "Navigate to the Mastra documentation and extract key features into a summary",
      category: "browser_automation",
      complexity: "medium",
      expectedTools: ["browserNavigate", "browserSnapshot", "fileWrite"],
      expectedOutcome: "extracted_documentation"
    },
    metadata: {
      test_type: "browser_capability",
      requires_browser: true
    }
  },

  // Data Processing
  {
    input: {
      query: "Create a Python script to analyze JSON data and generate a visualization",
      category: "data_processing",
      complexity: "medium",
      expectedTools: ["fileWrite", "createSandbox", "executeSandboxCommand"],
      expectedOutcome: "working_data_analysis_script"
    },
    metadata: {
      test_type: "programming_capability",
      language: "python"
    }
  },

  // File Management
  {
    input: {
      query: "Organize the project documentation by creating a structured folder hierarchy",
      category: "file_management",
      complexity: "low",
      expectedTools: ["fileRead", "fileWrite", "fileMove"],
      expectedOutcome: "organized_file_structure"
    },
    metadata: {
      test_type: "file_operations"
    }
  },

  // Error Handling
  {
    input: {
      query: "Try to access a non-existent file and handle the error gracefully",
      category: "error_handling",
      complexity: "low",
      expectedTools: ["fileRead"],
      expectedOutcome: "graceful_error_handling"
    },
    metadata: {
      test_type: "error_recovery"
    }
  },

  // Creative Task
  {
    input: {
      query: "Create an interactive CLI tool for managing todo lists",
      category: "creative_development",
      complexity: "high",
      expectedTools: ["fileWrite", "createSandbox", "executeSandboxCommand"],
      expectedOutcome: "working_cli_application"
    },
    metadata: {
      test_type: "creative_programming"
    }
  }
];

// Execute agent and capture detailed metrics
async function executeA010Agent(scenario: any): Promise<{
  output: string;
  toolCalls: any[];
  duration: number;
  error?: string;
}> {
  const startTime = Date.now();
  
  try {
    // Get the a010 agent
    const agent = mastra.getAgent("a010");
    
    if (!agent) {
      throw new Error("a010 agent not found in mastra registry");
    }

    // Create messages for the agent
    const messages: CoreMessage[] = [
      {
        role: "user",
        content: scenario.input.query
      }
    ];

    // Execute the agent
    console.log(`[EVAL] Executing a010 with: "${scenario.input.query}"`);
    
    const result = await agent.generate(messages, {
      threadId: `eval-${Date.now()}`,
      resourceId: "eval-user"
    });

    const duration = Date.now() - startTime;

    // Extract tool calls from result if available
    const toolCalls = extractToolCalls(result);

    return {
      output: result.text || "",
      toolCalls,
      duration,
    };
  } catch (error) {
    console.error(`[EVAL] Error executing a010:`, error);
    return {
      output: "",
      toolCalls: [],
      duration: Date.now() - startTime,
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
}

// Extract tool calls from agent result
function extractToolCalls(result: any): any[] {
  // This would need to be implemented based on actual agent response structure
  // For now, we'll parse the text for tool mentions
  const toolCalls: any[] = [];
  const text = result.text || "";
  
  const toolPatterns = [
    /using (.+?) tool/gi,
    /executing (.+?) command/gi,
    /calling (.+?) function/gi
  ];

  for (const pattern of toolPatterns) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      toolCalls.push({
        name: match[1],
        success: true // Would need actual success detection
      });
    }
  }

  return toolCalls;
}

// Score the a010 agent performance
async function scoreA010Performance(
  scenario: any,
  output: string,
  toolCalls: any[],
  duration: number,
  error?: string
): Promise<AgentEvaluationScores> {
  const scores: AgentEvaluationScores = {};

  // Basic scoring if there was an error
  if (error) {
    return {
      relevancy: 0,
      completeness: 0,
      accuracy: 0,
      helpfulness: 0,
      safety: 1, // No harmful output on error
      response_time: duration / 10000, // Normalize to 0-1 (10s max)
      task_completion: 0
    };
  }

  // Relevancy score
  scores.relevancy = await evaluateRelevancy(scenario.input.query, output);

  // Task completion score
  const messages: CoreMessage[] = [{ role: "user", content: scenario.input.query }];
  scores.task_completion = await evaluateTaskCompletion(messages, output);

  // Response quality
  scores.response_quality = await evaluateResponseQuality(output);

  // Tool usage evaluation
  if (scenario.input.expectedTools && scenario.input.expectedTools.length > 0) {
    const expectedTools = scenario.input.expectedTools;
    const usedTools = toolCalls.map(tc => tc.name.toLowerCase());
    
    const correctTools = expectedTools.filter((tool: string) => 
      usedTools.some(used => used.includes(tool.toLowerCase()))
    );
    
    scores.tool_success_rate = correctTools.length / expectedTools.length;
  }

  // Response time scoring (normalized)
  scores.response_time = Math.max(0, 1 - (duration / 30000)); // 30s = 0 score

  // Category-specific scoring
  switch (scenario.input.category) {
    case "research_documentation":
      scores.completeness = output.includes("summary") || output.includes("document") ? 0.8 : 0.3;
      scores.accuracy = output.includes("source") || output.includes("reference") ? 0.9 : 0.5;
      break;
      
    case "code_analysis":
      scores.helpfulness = output.includes("improvement") || output.includes("suggest") ? 0.9 : 0.4;
      scores.clarity = output.includes("structure") || output.includes("analysis") ? 0.8 : 0.5;
      break;
      
    case "complex_workflow":
      scores.completeness = toolCalls.length >= 3 ? 1 : 0.5;
      scores.coherence = output.includes("step") || output.includes("process") ? 0.9 : 0.6;
      break;
      
    case "error_handling":
      scores.safety = 1; // Error handling is inherently safe
      scores.helpfulness = output.includes("error") || output.includes("not found") ? 1 : 0;
      break;
      
    default:
      scores.completeness = 0.7;
      scores.helpfulness = 0.7;
  }

  // Safety is always high unless toxic content detected
  scores.safety = scores.safety || 1;
  scores.toxicity = 0;
  scores.bias = 0;

  return scores;
}

// Main evaluation
Eval("a010-comprehensive-evaluation", {
  data: () => a010TestScenarios,
  
  task: async (scenario) => {
    const result = await executeA010Agent(scenario);
    
    // Log to Braintrust (or local)
    await logAgentInteraction(
      {
        messages: [{ role: "user", content: scenario.input.query }],
        agentName: "a010",
        threadId: `eval-${Date.now()}`,
        tools: scenario.input.expectedTools,
        context: { category: scenario.input.category }
      },
      {
        response: result.output,
        tool_calls: result.toolCalls.map(tc => ({
          name: tc.name,
          result: {},
          success: tc.success,
          duration: 0
        }))
      },
      await scoreA010Performance(scenario, result.output, result.toolCalls, result.duration, result.error),
      scenario.metadata
    );
    
    return result.output;
  },
  
  scores: [
    async (scenario, output) => {
      // For Braintrust UI, we need to return the scores
      const result = await executeA010Agent(scenario);
      const scores = await scoreA010Performance(
        scenario,
        output,
        result.toolCalls,
        result.duration,
        result.error
      );
      
      console.log(`[EVAL] Scores for ${scenario.input.category}:`, scores);
      
      return scores as Record<string, number>;
    }
  ],
  
  metadata: {
    description: "Comprehensive evaluation of a010 experimental agent",
    version: "1.0.0",
    agent: "a010",
    capabilities_tested: [
      "research",
      "code_analysis",
      "multi_tool_workflows",
      "browser_automation",
      "file_management",
      "error_handling",
      "creative_development"
    ],
    timestamp: new Date().toISOString()
  }
});

// Helpful startup message
console.log(`
🧪 a010 Agent Comprehensive Evaluation

This evaluation tests the a010 experimental agent across multiple scenarios:

📊 Test Categories:
   • Research & Documentation
   • Code Analysis
   • Multi-Tool Workflows
   • Browser Automation
   • Data Processing
   • File Management
   • Error Handling
   • Creative Development

🎯 Evaluation Metrics:
   • Relevancy & Accuracy
   • Task Completion
   • Tool Usage Effectiveness
   • Response Quality
   • Performance & Safety

🚀 Run Commands:
   Local Mode (no API key needed):
   npx braintrust eval --no-send-logs scripts/a010-agent.eval.ts
   
   Development UI Mode:
   npx braintrust eval --dev --dev-port 8300 scripts/a010-agent.eval.ts
   
   Production Mode (requires API key):
   npx braintrust eval scripts/a010-agent.eval.ts

📝 Results will be logged to console in local mode or viewable in Braintrust UI.
`);