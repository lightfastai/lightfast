import type {
	PromptContext,
	PromptFeatureFlags,
	CommunicationStyle,
	TemporalContext,
	UserContext,
} from "./types";
import { DEFAULT_FEATURE_FLAGS } from "./types";

/**
 * Build PromptContext from route handler data.
 *
 * This is the bridge between the guard-enriched resources
 * and the composable prompt builder.
 */
export function buildPromptContext(options: {
	isAnonymous: boolean;
	userId: string;
	clerkUserId?: string | null;
	plan?: string;
	modelId?: string;
	modelProvider?: string;
	modelMaxOutputTokens?: number;
	activeTools?: string[];
	webSearchEnabled?: boolean;
	features?: PromptFeatureFlags;
	style?: CommunicationStyle;
	temporalContext?: TemporalContext;
	userContext?: UserContext;
}): PromptContext {
	const features: Required<PromptFeatureFlags> = {
		...DEFAULT_FEATURE_FLAGS,
		...options.features,
	};

	return {
		auth: {
			isAnonymous: options.isAnonymous,
			userId: options.userId,
			clerkUserId: options.clerkUserId ?? null,
		},
		billing: {
			plan: options.plan ?? "free",
			limits: {},
		},
		model: {
			id: options.modelId ?? "google/gemini-2.5-flash",
			provider: options.modelProvider ?? "gateway",
			maxOutputTokens: options.modelMaxOutputTokens ?? 100000,
		},
		activeTools: options.activeTools ?? [],
		webSearchEnabled: options.webSearchEnabled ?? false,
		features,
		style: options.style ?? "formal",
		temporalContext: options.temporalContext,
		userContext: options.userContext,
	};
}
