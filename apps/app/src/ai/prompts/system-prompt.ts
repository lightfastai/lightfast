import { buildPrompt, buildPromptContext } from "@repo/prompt-engine";
import { ANSWER_PROVIDERS } from "./providers";

interface AnswerPromptOptions {
  /** Model ID for token budgeting */
  modelId?: string;
  /** Org context (hardcoded for now, dynamic later) */
  org: {
    projectName: string;
    projectDescription: string;
  };
}

/**
 * Build the Answer agent system prompt using composable sections.
 */
export function buildAnswerSystemPrompt(options: AnswerPromptOptions): string {
  const context = buildPromptContext({
    isAnonymous: false,
    userId: "system",
    activeTools: ["orgSearch", "orgContents", "orgFindSimilar", "orgRelated"],
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
        name: options.org.projectName,
        description: options.org.projectDescription,
        repos: [],
        integrations: [],
      },
    },
    modelId: options.modelId ?? "anthropic/claude-sonnet-4-5-20250929",
  });

  return buildPrompt(context, ANSWER_PROVIDERS);
}

// Hardcoded org context for V1 (localhost = Lightfast project)
export const HARDCODED_ORG_CONTEXT = {
  projectName: "Lightfast",
  projectDescription:
    "Lightfast is a pnpm monorepo (Turborepo) for building AI agent orchestration tools. It includes a console app (Next.js), marketing site, chat app, and supporting infrastructure across GitHub, Linear, Vercel, and Sentry integrations.",
};
