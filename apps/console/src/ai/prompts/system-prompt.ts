import { buildPrompt, buildPromptContext } from "@repo/prompt-engine";
import { ANSWER_PROVIDERS } from "./providers";

export interface AnswerPromptOptions {
  /** Workspace context (hardcoded for now, dynamic later) */
  workspace: {
    projectName: string;
    projectDescription: string;
  };
  /** Model ID for token budgeting */
  modelId?: string;
}

/**
 * Build the Answer agent system prompt using composable sections.
 */
export function buildAnswerSystemPrompt(options: AnswerPromptOptions): string {
  const context = buildPromptContext({
    isAnonymous: false,
    userId: "system",
    activeTools: [
      "workspaceSearch",
      "workspaceContents",
      "workspaceFindSimilar",
      "workspaceGraph",
      "workspaceRelated",
    ],
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
      workspace: {
        name: options.workspace.projectName,
        description: options.workspace.projectDescription,
        repos: [],
        integrations: [],
      },
    },
    modelId: options.modelId ?? "anthropic/claude-sonnet-4-5-20250929",
  });

  return buildPrompt(context, ANSWER_PROVIDERS);
}

// Hardcoded workspace context for V1 (localhost = Lightfast project)
export const HARDCODED_WORKSPACE_CONTEXT = {
  projectName: "Lightfast",
  projectDescription:
    "Lightfast is a pnpm monorepo (Turborepo) for building AI agent orchestration tools. It includes a console app (Next.js), marketing site, chat app, and supporting infrastructure across GitHub, Linear, Vercel, and Sentry integrations.",
};
