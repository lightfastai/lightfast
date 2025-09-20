/**
 * Braintrust evaluation to verify models can answer diverse user questions.
 *
 * Focuses on ensuring system prompts do not over-constrain responses (e.g. forcing diagrams only).
 * We expect natural language answers without refusals for standard, policy-compliant requests.
 */

import { Eval, initLogger } from "braintrust";
import type { EvalCase, EvalScorerArgs } from "braintrust";
import { gateway } from "@ai-sdk/gateway";
import { generateText, generateObject, wrapLanguageModel } from "ai";
import { BraintrustMiddleware } from "braintrust";
import { ACTIVE_MODELS } from "../ai/providers/models/active";
import type { ModelId } from "../ai/providers";
import { buildAuthenticatedSystemPrompt } from "../ai/prompts/builders/system-prompt-builder";
import { getBraintrustConfig } from "@repo/ai/braintrust-env";
import { z } from "zod";

const ACTIVE_MODEL_IDS = Object.keys(ACTIVE_MODELS) as ModelId[];

type Scenario =
  | "general_knowledge"
  | "casual_conversation"
  | "creative"
  | "reasoning"
  | "recommendation"
  | "list";

type TestInput = { prompt: string; modelId: ModelId; scenario: Scenario };
type TestExpected = { scenario: Scenario; modelId: ModelId };
type TestOutput = string;

const QA_PROMPTS: Array<{ prompt: string; scenario: Scenario; description: string }> = [
  {
    prompt: "Tell me a short history of coffee and how it became popular worldwide.",
    scenario: "general_knowledge",
    description: "Should respond with narrative text."
  },
  {
    prompt: "I'm feeling stressed from work today. Share a calming tip in a friendly tone.",
    scenario: "casual_conversation",
    description: "Should respond empathetically, not with a diagram."
  },
  {
    prompt: "Write a four-line poem about sunrise over the ocean.",
    scenario: "creative",
    description: "Expect short creative writing output."
  },
  {
    prompt: "Explain the difference between HTTP and HTTPS for a beginner.",
    scenario: "reasoning",
    description: "Technical explanation without artifacts."
  },
  {
    prompt: "List three practical ways to stay productive when working from home.",
    scenario: "list",
    description: "Provide a straightforward list in plain text."
  },
  {
    prompt: "Recommend a simple vegetarian dinner idea with key ingredients.",
    scenario: "recommendation",
    description: "Should offer a plain-text recommendation."
  },
];

const TEST_DATA: EvalCase<TestInput, TestExpected, { model: string; scenario: Scenario; description: string }>[] = [];

for (const qaCase of QA_PROMPTS) {
  for (const modelId of ACTIVE_MODEL_IDS) {
    TEST_DATA.push({
      input: {
        prompt: qaCase.prompt,
        modelId,
        scenario: qaCase.scenario,
      },
      expected: {
        scenario: qaCase.scenario,
        modelId,
      },
      metadata: {
        model: modelId,
        scenario: qaCase.scenario,
        description: qaCase.description,
      },
    });
  }
}

const braintrustConfig = getBraintrustConfig();

const QA_JUDGE_MODEL: ModelId = "google/gemini-2.5-flash";

const QA_JUDGE_SYSTEM_PROMPT = `You are an impartial evaluation judge.
You will receive a user prompt, the conversation scenario, and the assistant's response.
Score whether the answer fulfills the request with direct, natural-language content.

Scoring rubric (only respond with these scores):
- 1: Fully answers the question with helpful, relevant natural language. No refusals, no claims of being limited to diagrams, and no redirection to createDocument or other tools. Tone should match the scenario (e.g., empathetic for casual conversation, creative for poetry).
- 0.5: Partially addresses the request but misses important details, lacks scenario-appropriate tone, or feels incomplete.
- 0: Refuses, deflects, produces irrelevant content, claims only-diagram capability, or otherwise fails to answer.

Return a single JSON object with keys "score" and "reasoning". The score must be 0, 0.5, or 1.`;

const QA_JUDGE_SCHEMA = z.object({
  score: z.union([z.literal("0"), z.literal("0.5"), z.literal("1")]),
  reasoning: z.string().min(1),
});

initLogger({
  apiKey: braintrustConfig.apiKey,
  projectName: braintrustConfig.projectName || "lightfast-chat-evaluation",
});

async function testGeneralQuestion(prompt: string, modelId: ModelId): Promise<string> {
  try {
    const systemPrompt = buildAuthenticatedSystemPrompt(true);

    const result = await generateText({
      model: wrapLanguageModel({
        model: gateway(modelId),
        middleware: BraintrustMiddleware({ debug: true }),
      }),
      system: systemPrompt,
      prompt,
      experimental_telemetry: {
        isEnabled: true,
        functionId: "general-qa-evaluation",
        metadata: {
          context: "experiment",
          experimentType: "general-qa",
          modelId,
          evaluationName: "General QA Coverage",
        },
      },
    });

    return result.text;
  } catch (error) {
    console.error("General QA model error", { modelId, error });
    return `ERROR: ${String(error)}`;
  }
}

async function getJudgeScore(
  args: EvalScorerArgs<TestInput, TestOutput, TestExpected, { model: string; scenario: Scenario; description: string }>,
  output: string,
): Promise<number> {
  const scenarioDescription = args.metadata?.description || args.input.scenario;

  const evaluationPrompt = [
    `Scenario: ${args.input.scenario}`,
    `Scenario guidance: ${scenarioDescription}`,
    `User prompt:\n${args.input.prompt}`,
    `Assistant answer:\n${output}`,
    "Judge the answer using the rubric and respond with JSON only.",
  ].join("\n\n");

  try {
    const { object } = await generateObject({
      model: wrapLanguageModel({
        model: gateway(QA_JUDGE_MODEL),
        middleware: BraintrustMiddleware({ debug: true }),
      }),
      system: QA_JUDGE_SYSTEM_PROMPT,
      prompt: evaluationPrompt,
      schema: QA_JUDGE_SCHEMA,
      experimental_telemetry: {
        isEnabled: true,
        functionId: "general-qa-judge",
        metadata: {
          context: "experiment",
          experimentType: "general-qa-judge",
          modelId: args.input.modelId,
          judgeModel: QA_JUDGE_MODEL,
          scenario: args.input.scenario,
        },
      },
    });

    const numericScore = Number(object.score);

    console.log(
      `[General QA Eval][Judge] ${args.input.modelId} (${args.input.scenario}) → score ${numericScore}: ${object.reasoning}`,
    );

    if (Number.isNaN(numericScore)) {
      return 0;
    }

    return numericScore;
  } catch (error) {
    console.error(
      `[General QA Eval][Judge] Failed to score ${args.input.modelId} (${args.input.scenario})`,
      error,
    );
    return 0;
  }
}

async function scoreAnswerCoverage(
  args: EvalScorerArgs<TestInput, TestOutput, TestExpected, { model: string; scenario: Scenario; description: string }>,
): Promise<number> {
  const { output } = args;

  if (typeof output !== "string" || !output.trim() || output.includes("ERROR:")) {
    console.log(
      `[General QA Eval] Empty or error output for ${args.input.modelId} (${args.input.scenario}).`,
    );
    return 0;
  }

  const refusalPatterns = [
    /i\s+(?:can['’]t|cannot|won['’]t)\s+(?:help|comply|answer|assist)/i,
    /i\s+am\s+unable\s+to\s+assist/i,
    /i\s+am\s+just\s+a\s+diagram/i,
    /only\s+(?:provide|produce)\s+diagrams/i,
    /cannot\s+generate\s+that/i,
    /request\s+requires\s+code\s+artifact/i,
  ];

  if (refusalPatterns.some((pattern) => pattern.test(output))) {
    console.log(
      `[General QA Eval] Refusal detected for ${args.input.modelId} (${args.input.scenario}). Output: ${output}`,
    );
    return 0;
  }

  const codeBlockRegex = /```[\s\S]*?```/g;
  const stripped = output.replace(codeBlockRegex, " ").replace(/\s+/g, " ").trim();
  const wordCount = stripped.split(" ").filter(Boolean).length;

  if (wordCount < 12) {
    console.log(
      `[General QA Eval] Too little natural language from ${args.input.modelId} (${args.input.scenario}). Output: ${output}`,
    );
    return 0;
  }

  if (/created\s+a\s+(?:document|diagram)/i.test(output) || /createDocument/i.test(output)) {
    console.log(
      `[General QA Eval] Artifact deflection detected for ${args.input.modelId} (${args.input.scenario}). Output: ${output}`,
    );
    return 0;
  }

  return getJudgeScore(args, output);
}

void Eval(braintrustConfig.projectName || "lightfast-chat-evaluation", {
  data: TEST_DATA,
  task: async (input: TestInput): Promise<TestOutput> => {
    console.log(`Evaluating ${input.modelId} on scenario: ${input.scenario}`);
    return testGeneralQuestion(input.prompt, input.modelId);
  },
  scores: [scoreAnswerCoverage],
});
