/**
 * Test Google Gemini 2.5 Flash WITH the same tools that are causing search_web errors
 * This will help isolate if the issue is in tool configuration
 */

import { Eval, initLogger } from "braintrust";
import type { EvalCase, EvalScorerArgs } from "braintrust";
import { gateway } from "@ai-sdk/gateway";
import { generateText, wrapLanguageModel, tool } from "ai";
import { BraintrustMiddleware } from "braintrust";
import { getBraintrustConfig } from "@repo/ai/braintrust-env";
import { evalTools } from "./tools/eval-tools";

// Simple prompts that should NOT trigger search behavior
const SIMPLE_PROMPTS = [
  {
    prompt: "Hello, how are you?",
    description: "Simple greeting - should not need tools",
  },
  {
    prompt: "What is 2 + 2?", 
    description: "Basic math - should not need tools",
  },
  {
    prompt: "Write a short poem about cats",
    description: "Creative writing - should not need tools",
  },
  {
    prompt: "Explain what TypeScript is",
    description: "General programming knowledge - should not need tools",
  },
  {
    prompt: "Create a simple HTML page",
    description: "Code request - might trigger createDocument",
  },
];

// Test configurations to isolate the issue
const TEST_CONFIGURATIONS = [
  {
    name: "no_tools",
    description: "No tools provided",
    tools: {},
  },
  {
    name: "webSearch_only", 
    description: "Only webSearch tool",
    tools: {
      webSearch: tool({
        description: evalTools.webSearch.description,
        inputSchema: evalTools.webSearch.inputSchema,
        execute: evalTools.webSearch.execute,
      }),
    },
  },
  {
    name: "createDocument_only",
    description: "Only createDocument tool", 
    tools: {
      createDocument: tool({
        description: evalTools.createDocument.description,
        inputSchema: evalTools.createDocument.inputSchema,
        execute: evalTools.createDocument.execute,
      }),
    },
  },
  {
    name: "both_tools",
    description: "Both webSearch and createDocument tools",
    tools: {
      webSearch: tool({
        description: evalTools.webSearch.description,
        inputSchema: evalTools.webSearch.inputSchema,
        execute: evalTools.webSearch.execute,
      }),
      createDocument: tool({
        description: evalTools.createDocument.description,
        inputSchema: evalTools.createDocument.inputSchema, 
        execute: evalTools.createDocument.execute,
      }),
    },
  },
];

interface TestInput {
  prompt: string;
  description: string;
  configName: string;
  tools: any;
}

interface TestExpected {
  configName: string;
}

interface TestOutput {
  text: string;
  toolCalls: any[];
  error?: string;
  errorType?: string;
  searchToolCalled: boolean;
  configName: string;
}

const TEST_DATA: EvalCase<TestInput, TestExpected, { description: string; configName: string }>[] = [];

// Create test cases for each prompt x configuration combination
for (const testPrompt of SIMPLE_PROMPTS) {
  for (const config of TEST_CONFIGURATIONS) {
    TEST_DATA.push({
      input: {
        prompt: testPrompt.prompt,
        description: testPrompt.description,
        configName: config.name,
        tools: config.tools,
      },
      expected: {
        configName: config.name,
      },
      metadata: {
        description: `${testPrompt.description} (${config.description})`,
        configName: config.name,
      },
    });
  }
}

const braintrustConfig = getBraintrustConfig();
initLogger({
  apiKey: braintrustConfig.apiKey,
  projectName: braintrustConfig.projectName || "lightfast-gemini-tools-test",
});

async function runCase(input: TestInput): Promise<TestOutput> {
  try {
    const result = await generateText({
      model: wrapLanguageModel({
        model: gateway("google/gemini-2.5-flash"),
        middleware: BraintrustMiddleware({ debug: true }),
      }),
      system: "You are a helpful AI assistant. Answer questions directly and concisely.",
      prompt: input.prompt,
      tools: input.tools,
      maxToolRoundtrips: 1,
      experimental_telemetry: {
        isEnabled: true,
        functionId: "gemini-tools-test",
        metadata: { 
          context: "tools_configuration_test",
          configName: input.configName,
          description: input.description,
        },
      },
    });

    return {
      text: result.text,
      toolCalls: result.toolCalls || [],
      searchToolCalled: false,
      configName: input.configName,
    };

  } catch (error: any) {
    const isSearchWebError = error?.message?.includes?.("search_web") || 
                            error?.toString?.()?.includes?.("search_web");
    
    const isUnavailableToolError = error?.message?.includes?.("unavailable tool") || 
                                  error?.toString?.()?.includes?.("unavailable tool");
    
    let errorType = "other_error";
    if (isSearchWebError) errorType = "search_web_error";
    else if (isUnavailableToolError) errorType = "unavailable_tool_error";
    
    return {
      text: "",
      toolCalls: [],
      error: error?.message || error?.toString() || "Unknown error",
      errorType,
      searchToolCalled: isSearchWebError,
      configName: input.configName,
    };
  }
}

void Eval(braintrustConfig.projectName || "lightfast-gemini-tools-test", {
  data: TEST_DATA,
  task: async (input: TestInput): Promise<TestOutput> => runCase(input),
  scores: [
    // Track search_web errors by configuration
    (args: EvalScorerArgs<TestInput, TestOutput, TestExpected>) => {
      const hasSearchWebError = args.output.errorType === "search_web_error";
      return {
        name: `search_web_error_${args.input.configName}`,
        score: hasSearchWebError ? 1 : 0,
      };
    },
    
    // Track successful completions by configuration 
    (args: EvalScorerArgs<TestInput, TestOutput, TestExpected>) => {
      const isSuccessful = !args.output.error;
      return {
        name: `success_${args.input.configName}`,
        score: isSuccessful ? 1 : 0,
      };
    },
    
    // Overall search_web error rate
    (args: EvalScorerArgs<TestInput, TestOutput, TestExpected>) => {
      const hasSearchWebError = args.output.errorType === "search_web_error";
      return {
        name: "search_web_error_detected",
        score: hasSearchWebError ? 1 : 0,
      };
    },
    
    // Overall success rate
    (args: EvalScorerArgs<TestInput, TestOutput, TestExpected>) => {
      const isSuccessful = !args.output.error;
      return {
        name: "successful_completion",
        score: isSuccessful ? 1 : 0,
      };
    },
  ],
});