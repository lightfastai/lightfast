import type { PromptSection, PromptContext, SectionProvider } from "./types";

/** Default token budget for system prompt */
const DEFAULT_TOKEN_BUDGET = 4000;

/** Model-specific token budgets */
const MODEL_TOKEN_BUDGETS: Record<string, number> = {
	"google/gemini-2.5-flash": 8000,
	"google/gemini-2.5-pro": 8000,
	"anthropic/claude-4-sonnet": 6000,
	"openai/gpt-5": 6000,
	"openai/gpt-5-mini": 5000,
	"openai/gpt-5-nano": 3000,
};

const PRIORITY_ORDER: Record<string, number> = {
	critical: 0,
	high: 1,
	medium: 2,
	low: 3,
};

/**
 * Build a system prompt from composable section providers.
 *
 * Sections are sorted by priority (critical first), then included
 * within the token budget. Critical sections are always included.
 */
export function buildPrompt(
	context: PromptContext,
	providers: SectionProvider[],
): string {
	// 1. Generate all sections (skip nulls, catch errors)
	const sections: PromptSection[] = [];
	for (const provider of providers) {
		try {
			const section = provider(context);
			if (section) sections.push(section);
		} catch {
			// Section provider failed — skip silently
		}
	}

	// 2. Sort by priority (critical first)
	sections.sort(
		(a, b) =>
			(PRIORITY_ORDER[a.priority] ?? 3) - (PRIORITY_ORDER[b.priority] ?? 3),
	);

	// 3. Token budgeting
	const budget =
		MODEL_TOKEN_BUDGETS[context.model.id] ?? DEFAULT_TOKEN_BUDGET;
	const included: PromptSection[] = [];
	let estimatedTokens = 0;

	for (const section of sections) {
		const sectionTokens = section.estimateTokens();
		if (
			section.priority === "critical" ||
			estimatedTokens + sectionTokens <= budget
		) {
			included.push(section);
			estimatedTokens += sectionTokens;
		}
	}

	// 4. Render and join
	return included.map((s) => s.render()).join("\n\n");
}
