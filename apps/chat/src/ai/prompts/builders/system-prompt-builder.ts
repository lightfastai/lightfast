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

	let prompt = basePrompt;

	if (isAnonymous) {
		// Anonymous users: no artifact capabilities
		prompt += `

You can help users with:
- Answering questions using web search when needed
- Providing information and explanations
- General assistance and conversation

IMPORTANT: You do not have the ability to create code artifacts, diagrams, or documents. Focus on providing helpful text-based responses and using web search when additional information is needed.`;

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
export function buildAnonymousSystemPrompt(includeCitations: boolean = true): string {
	return buildSystemPrompt({
		isAnonymous: true,
		includeCitations,
		includeCodeFormatting: true
	});
}

/**
 * Build system prompt for authenticated users (matches route.ts exactly)
 */
export function buildAuthenticatedSystemPrompt(includeCitations: boolean = true): string {
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