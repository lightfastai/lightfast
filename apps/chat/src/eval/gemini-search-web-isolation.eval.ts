/**
 * Braintrust evaluation to isolate the "search_web" tool error in Google Gemini 2.5 Flash
 * Tests prompts WITHOUT ANY TOOLS to see when/why Gemini tries to call search_web
 */

import { Eval, initLogger } from "braintrust";
import type { EvalCase, EvalScorerArgs } from "braintrust";
import { gateway } from "@ai-sdk/gateway";
import { generateText, wrapLanguageModel } from "ai";
import { BraintrustMiddleware } from "braintrust";
import { getBraintrustConfig } from "@repo/ai/braintrust-env";

// Test prompts designed to potentially trigger search behavior
const TEST_PROMPTS = [
  // Basic prompts (should NOT trigger search)
  {
    prompt: "Hello, how are you?",
    description: "Simple greeting",
    expectedSearchTrigger: false,
  },
  {
    prompt: "What is 2 + 2?",
    description: "Basic math",
    expectedSearchTrigger: false,
  },
  {
    prompt: "Write a short poem about cats",
    description: "Creative writing",
    expectedSearchTrigger: false,
  },
  {
    prompt: "Explain how photosynthesis works",
    description: "General knowledge",
    expectedSearchTrigger: false,
  },

  // Current events (might trigger search)
  {
    prompt: "What's the latest news about AI developments in 2025?",
    description: "Current events query",
    expectedSearchTrigger: true,
  },
  {
    prompt: "Who won the latest NBA championship?",
    description: "Recent sports results",
    expectedSearchTrigger: true,
  },
  {
    prompt: "What are the current stock prices for Apple and Google?",
    description: "Real-time financial data",
    expectedSearchTrigger: true,
  },

  // Real-time information
  {
    prompt: "What's the weather like in New York today?",
    description: "Current weather",
    expectedSearchTrigger: true,
  },
  {
    prompt: "What time is it in Tokyo right now?",
    description: "Current time query",
    expectedSearchTrigger: true,
  },

  // Research-like queries
  {
    prompt: "Find me information about the best restaurants in Paris",
    description: "Research request with 'find'",
    expectedSearchTrigger: true,
  },
  {
    prompt: "Search for recent studies on climate change",
    description: "Explicit search request",
    expectedSearchTrigger: true,
  },
  {
    prompt: "Look up the population of India in 2024",
    description: "Data lookup request",
    expectedSearchTrigger: true,
  },

  // Web-specific queries
  {
    prompt: "What are people saying about the new iPhone on social media?",
    description: "Social media sentiment",
    expectedSearchTrigger: true,
  },
  {
    prompt: "Can you browse the web to find the latest Python tutorials?",
    description: "Explicit web browsing request",
    expectedSearchTrigger: true,
  },

  // Fact-checking queries
  {
    prompt: "Is it true that coffee is bad for your health? Check recent studies.",
    description: "Fact-checking with verification request",
    expectedSearchTrigger: true,
  },
  {
    prompt: "Verify this claim: 'The Earth's population reached 8 billion in 2024'",
    description: "Verification request",
    expectedSearchTrigger: true,
  },

  // Shopping/product queries
  {
    prompt: "What are the best laptops under $1000 currently available?",
    description: "Product recommendation with current pricing",
    expectedSearchTrigger: true,
  },
  {
    prompt: "Compare prices for iPhone 15 across different retailers",
    description: "Price comparison request",
    expectedSearchTrigger: true,
  },

  // Technical queries
  {
    prompt: "What are the latest features in React 19?",
    description: "Recent technical information",
    expectedSearchTrigger: true,
  },
  {
    prompt: "Show me the current documentation for OpenAI's GPT-4 API",
    description: "Current documentation request",
    expectedSearchTrigger: true,
  },
];

interface TestInput {
  prompt: string;
  description: string;
  expectedSearchTrigger: boolean;
}

interface TestExpected {
  expectedSearchTrigger: boolean;
}

interface TestOutput {
  text: string;
  toolCalls: any[];
  error?: string;
  errorType?: string;
  searchToolCalled: boolean;
}

const TEST_DATA: EvalCase<TestInput, TestExpected, { description: string; expectedSearchTrigger: boolean }>[] = [];

// Create test cases for Google Gemini 2.5 Flash only
for (const testPrompt of TEST_PROMPTS) {
  TEST_DATA.push({
    input: {
      prompt: testPrompt.prompt,
      description: testPrompt.description,
      expectedSearchTrigger: testPrompt.expectedSearchTrigger,
    },
    expected: {
      expectedSearchTrigger: testPrompt.expectedSearchTrigger,
    },
    metadata: {
      description: testPrompt.description,
      expectedSearchTrigger: testPrompt.expectedSearchTrigger,
    },
  });
}

const braintrustConfig = getBraintrustConfig();
initLogger({
  apiKey: braintrustConfig.apiKey,
  projectName: braintrustConfig.projectName || "lightfast-gemini-search-isolation",
});

async function runCase(input: TestInput): Promise<TestOutput> {
  try {
    // Test Gemini 2.5 Flash WITHOUT ANY TOOLS
    const result = await generateText({
      model: wrapLanguageModel({
        model: gateway("google/gemini-2.5-flash"),
        middleware: BraintrustMiddleware({ debug: true }),
      }),
      system: "You are a helpful AI assistant. Answer questions directly and concisely.",
      prompt: input.prompt,
      // IMPORTANT: NO TOOLS PROVIDED - this should prevent any tool calls
      // tools: {}, // Explicitly empty or omit entirely
      maxToolRoundtrips: 0, // Disable tool calling entirely
      experimental_telemetry: {
        isEnabled: true,
        functionId: "gemini-search-web-isolation",
        metadata: { 
          context: "search_web_isolation_test",
          expectedSearchTrigger: input.expectedSearchTrigger,
          description: input.description,
        },
      },
    });

    return {
      text: result.text,
      toolCalls: result.toolCalls || [],
      searchToolCalled: false, // Should always be false since no tools provided
    };

  } catch (error: any) {
    // Capture the specific error we're looking for
    const isSearchWebError = error?.message?.includes?.("search_web") || 
                            error?.toString?.()?.includes?.("search_web");
    
    return {
      text: "",
      toolCalls: [],
      error: error?.message || error?.toString() || "Unknown error",
      errorType: isSearchWebError ? "search_web_error" : "other_error",
      searchToolCalled: isSearchWebError, // If we get search_web error, it means it tried to call it
    };
  }
}

void Eval(braintrustConfig.projectName || "lightfast-gemini-search-isolation", {
  data: TEST_DATA,
  task: async (input: TestInput): Promise<TestOutput> => runCase(input),
  scores: [
    // Primary: Track when search_web errors occur
    (args: EvalScorerArgs<TestInput, TestOutput, TestExpected>) => {
      const hasSearchWebError = args.output.errorType === "search_web_error";
      return {
        name: "search_web_error_detected",
        score: hasSearchWebError ? 1 : 0,
      };
    },
    
    // Secondary: Track successful completions (no errors)
    (args: EvalScorerArgs<TestInput, TestOutput, TestExpected>) => {
      const isSuccessful = !args.output.error;
      return {
        name: "successful_completion",
        score: isSuccessful ? 1 : 0,
      };
    },
    
    // Tertiary: Track if prompt type correlates with search behavior
    (args: EvalScorerArgs<TestInput, TestOutput, TestExpected>) => {
      const expectedSearch = args.input.expectedSearchTrigger;
      const actualSearchError = args.output.errorType === "search_web_error";
      const match = expectedSearch === actualSearchError;
      return {
        name: "search_trigger_prediction_accuracy",
        score: match ? 1 : 0,
      };
    },
    
    // Quality: Check if response is meaningful when successful
    (args: EvalScorerArgs<TestInput, TestOutput, TestExpected>) => {
      if (args.output.error) return { name: "response_quality", score: 0 };
      const hasContent = args.output.text && args.output.text.trim().length > 10;
      return {
        name: "response_quality",
        score: hasContent ? 1 : 0,
      };
    },
  ],
});