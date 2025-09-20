/**
 * Braintrust evaluation to ensure models DO NOT create code artifacts
 * for non-code requests (plans, itineraries, recommendations, etc.).
 */

import { Eval, initLogger } from "braintrust";
import type { EvalCase, EvalScorerArgs } from "braintrust";
import { gateway } from "@ai-sdk/gateway";
import { generateText, wrapLanguageModel, tool } from "ai";
import { BraintrustMiddleware } from "braintrust";
import { ACTIVE_MODELS } from "../ai/providers/models/active";
import type { ModelId } from "../ai/providers";
import { buildAuthenticatedSystemPrompt } from "../ai/prompts/builders/system-prompt-builder";
import { getBraintrustConfig } from "@repo/ai/braintrust-env";
import { evalTools } from "./tools/eval-tools";

const ACTIVE_MODEL_IDS = Object.keys(ACTIVE_MODELS) as ModelId[];

// Typical non-code prompts that should NOT trigger createDocument
const NON_CODE_PROMPTS = [
  {
    prompt: "write me a nutrition plan for aussie 120g protein per day",
    description: "Meal plan should be plain text, no code or artifacts",
  },
  {
    prompt: "Plan a 3-day itinerary in Tokyo with highlights and food recommendations",
    description: "Itinerary should be plain text; no code blocks or artifacts",
  },
  {
    prompt: "Create a weekly workout plan for a beginner (3 days a week)",
    description: "Workout plan in text; avoid code blocks and documents",
  },
  {
    prompt: "Give me a study plan to learn TypeScript in 2 weeks",
    description: "Study plan; no code artifact or fenced code",
  },
];

interface TestInput {
  prompt: string;
  modelId: ModelId;
}
interface TestExpected {
  modelId: ModelId;
}
type TestOutput = { text: string; toolCalls: any[] };

const TEST_DATA: EvalCase<TestInput, TestExpected, { model: string; description: string }>[] = [];

for (const p of NON_CODE_PROMPTS) {
  for (const modelId of ACTIVE_MODEL_IDS) {
    TEST_DATA.push({
      input: { prompt: p.prompt, modelId },
      expected: { modelId },
      metadata: { model: modelId, description: p.description },
    });
  }
}

const braintrustConfig = getBraintrustConfig();
initLogger({
  apiKey: braintrustConfig.apiKey,
  projectName: braintrustConfig.projectName || "lightfast-chat-evaluation",
});

async function runCase(prompt: string, modelId: ModelId): Promise<TestOutput> {
  const systemPrompt = buildAuthenticatedSystemPrompt(true);

  const result = await generateText({
    model: wrapLanguageModel({
      model: gateway(modelId),
      middleware: BraintrustMiddleware({ debug: true }),
    }),
    system: systemPrompt,
    prompt,
    tools: {
      createDocument: tool({
        description: evalTools.createDocument.description,
        inputSchema: evalTools.createDocument.inputSchema,
        execute: evalTools.createDocument.execute,
      }),
      webSearch: tool({
        description: evalTools.webSearch.description,
        inputSchema: evalTools.webSearch.inputSchema,
        execute: evalTools.webSearch.execute,
      }),
    },
    maxToolRoundtrips: 1,
    experimental_telemetry: {
      isEnabled: true,
      functionId: "non-code-artifact-avoidance",
      metadata: { context: "experiment", modelId },
    },
  });

  return { text: result.text, toolCalls: result.toolCalls || [] };
}

void Eval(braintrustConfig.projectName || "lightfast-chat-evaluation", {
  data: TEST_DATA,
  task: async (input: TestInput): Promise<TestOutput> => runCase(input.prompt, input.modelId),
  scores: [
    // Primary: No createDocument calls should be made
    (args: EvalScorerArgs<TestInput, TestOutput, TestExpected, { model: string; description: string }>) => {
      const calls = args.output.toolCalls || [];
      const createdDoc = calls.some((c: any) => c.toolName === "createDocument");
      return createdDoc ? 0 : 1;
    },
    // Secondary: No code block formatting or obvious code smells in plain-text outputs
    (args: EvalScorerArgs<TestInput, TestOutput, TestExpected, { model: string; description: string }>) => {
      const out = args.output.text || "";
      if (!out) return 0;
      const hasCodeFence = /```[\s\S]*?```/.test(out);
      const looksLikeCode = /(import\s+|export\s+|class\s+|function\s+|const\s+\w+\s*=|{\s*"\w+"\s*:)/.test(out);
      return hasCodeFence || looksLikeCode ? 0 : 1;
    },
  ],
});

