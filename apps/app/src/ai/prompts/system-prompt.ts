import { buildPrompt, buildPromptContext } from "@repo/prompt-engine";
import { ANSWER_PROVIDERS } from "./providers";

interface AnswerPromptOptions {
  /** Model ID for token budgeting */
  modelId?: string;
  /** Org context */
  org: {
    name: string;
    /** Cached content from indexed repo */
    repoIndex?: string;
  };
}

/**
 * Build the Answer agent system prompt using composable sections.
 */
export function buildAnswerSystemPrompt(options: AnswerPromptOptions): string {
  const context = buildPromptContext({
    isAnonymous: false,
    userId: "system",
    activeTools: ["orgSearch"],
    features: {
      temporalContext: true,
      style: true,
      toolGuidance: true,
      userContext: true,
    },
    style: "formal",
    temporalContext: {
      currentTimestamp: new Date().toISOString(),
    },
    userContext: {
      org: {
        name: options.org.name,
        repoIndex: options.org.repoIndex,
        repos: [],
        integrations: [],
      },
    },
    modelId: options.modelId ?? "anthropic/claude-sonnet-4-5-20250929",
  });

  return buildPrompt(context, ANSWER_PROVIDERS);
}
