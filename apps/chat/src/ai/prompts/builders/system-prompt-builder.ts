/**
 * System prompt builder
 * 
 * Centralized system prompt generation for consistent prompts across evaluation and production
 */

import { 
    CITATION_FORMAT_SECTION, 
    CODE_FORMATTING_SECTION, 
    ARTIFACT_INSTRUCTIONS_SECTION 
} from "../citation";
import { SECURITY_GUIDELINES_SECTION } from "../security";

const CORE_BEHAVIOR_SECTION = `CORE BEHAVIOR:
- Provide direct, natural-language answers to the user and keep the conversation flowing.
- When you use any tools or capabilities, summarize the outcome in plain language.
- Only refuse when a request violates policy. Never claim you can only produce diagrams or artifacts if you can help in text.

FORMAT DISCIPLINE (STRICT):
- Use plain text for non-code requests; do not place non-code content inside code blocks or JSON.
- Include code blocks only when the user explicitly asks for code, a script, a file, or a refactor.
- Do not create code or code artifacts for non-code content. Prefer concise bullet points or short paragraphs for structured text.

INTENT MATCHING:
- Match your output format to the user’s intent. If they want ideas, plans, guidance, or explanations, respond in chat. If they ask for code or a diagram, provide that.
- When uncertain about format, ask one brief clarifying question before proceeding.`;

export interface SystemPromptOptions {
	/** Whether the user is anonymous (affects available capabilities) */
	isAnonymous: boolean;
	/** Whether to include citation formatting instructions */
	includeCitations: boolean;
	/** Whether to include code formatting instructions */
	includeCodeFormatting?: boolean;
	/** Custom base prompt to override default */
	basePrompt?: string;
}

/**
 * Build a system prompt based on user authentication status and requirements
 */
export function buildSystemPrompt(options: SystemPromptOptions): string {
	const {
		isAnonymous,
		includeCitations,
		includeCodeFormatting = true,
		basePrompt = "You are a helpful AI assistant with access to web search capabilities."
	} = options;

    let prompt = `${basePrompt}\n\n${CORE_BEHAVIOR_SECTION}\n\n${SECURITY_GUIDELINES_SECTION}`;

	if (isAnonymous) {
		// Anonymous users: no artifact capabilities + length constraints
		prompt += `

You can help users with:
- Answering questions using web search when needed
- Providing information and explanations
- General assistance and conversation

IMPORTANT: You do not have the ability to create code artifacts, diagrams, or documents. Focus on providing helpful text-based responses and using web search when additional information is needed.

LENGTH GUIDELINES (STRICT):
- Keep the entire reply within 120 words (or ~800 characters).
- Use 4–6 short sentences or up to 5 concise bullet points.
- Lead with the direct answer; avoid preambles and repetition.
- If the topic is broad, summarize the essentials and stop.
- For examples, prefer a single short inline example over long code blocks.
- Never exceed the length cap; do not append extra context after the summary.
`;

		// Add code formatting section for anonymous users
		if (includeCodeFormatting) {
			prompt += `\n\n${CODE_FORMATTING_SECTION}`;
		}
	} else {
		// Authenticated users: full capabilities including artifacts
		prompt += `\n\n${ARTIFACT_INSTRUCTIONS_SECTION}`;
	}

	// Add citation formatting if requested
	if (includeCitations) {
		prompt += `\n\n${CITATION_FORMAT_SECTION}`;
	}

	return prompt;
}

/**
 * Build system prompt for anonymous users (matches route.ts exactly)
 */
export function buildAnonymousSystemPrompt(includeCitations = true): string {
	return buildSystemPrompt({
		isAnonymous: true,
		includeCitations,
		includeCodeFormatting: true
	});
}

/**
 * Build system prompt for authenticated users (matches route.ts exactly)
 */
export function buildAuthenticatedSystemPrompt(includeCitations = true): string {
	return buildSystemPrompt({
		isAnonymous: false,
		includeCitations,
		includeCodeFormatting: false // Authenticated users use artifacts for code
	});
}

/**
 * Build a simple citation-focused prompt for evaluation testing
 */
export function buildCitationTestPrompt(): string {
	return buildSystemPrompt({
		isAnonymous: true,
		includeCitations: true,
		includeCodeFormatting: false,
		basePrompt: "You are a helpful AI assistant."
	});
}

/**
 * Build a simple general prompt without citations for evaluation testing
 */
export function buildGeneralTestPrompt(): string {
	return buildSystemPrompt({
		isAnonymous: true,
		includeCitations: false,
		includeCodeFormatting: false,
		basePrompt: "You are a helpful AI assistant."
	});
}
