import { ACTIVE_MODELS } from "./models/active";
import { DEPRECATED_MODELS } from "./models/deprecated";
import type { ModelConfig, ModelProvider } from "./schemas";

// Merge all models together
export const MODELS = {
	...ACTIVE_MODELS,
	...DEPRECATED_MODELS,
} as const;

// Derive ModelId type from actual models
export type ModelId = keyof typeof MODELS;

// Export derived types
export type {
	ModelConfig,
	ModelProvider,
	ModelFeatures,
	ThinkingConfig,
	ModelAccessLevel,
} from "./schemas";

// Export schemas for validators
export { ModelProviderSchema, IconProviderSchema, ICON_PROVIDER_DISPLAY_NAMES, ModelAccessLevelSchema } from "./schemas";

// Export collections for validators
export const ALL_MODEL_IDS = Object.keys(MODELS) as ModelId[];

// Helper functions
export function getModelConfig(modelId: ModelId): ModelConfig {
	return MODELS[modelId];
}

export function getVisibleModels(): ModelConfig[] {
	return Object.values(MODELS).filter((model) => model.active);
}

// Get models based on authentication status
export function getModelsForUser(isAuthenticated: boolean): ModelConfig[] {
	return Object.values(MODELS).filter((model) => {
		// Must be active
		if (!model.active) return false;
		
		// Anonymous users can only access "anonymous" models
		// Authenticated users can access both "anonymous" and "authenticated" models
		if (!isAuthenticated && model.accessLevel === "authenticated") {
			return false;
		}
		
		return true;
	});
}

// Get the default model for a user based on authentication
export function getDefaultModelForUser(isAuthenticated: boolean): ModelId {
	// For anonymous users, use gpt-5-nano if available
	if (!isAuthenticated) {
		const anonymousModels = getModelsForUser(false);
		const gpt5Nano = anonymousModels.find(m => m.id === "openai/gpt-5-nano");
		if (gpt5Nano) return "openai/gpt-5-nano";
		// Fallback to first available anonymous model
		const firstAnonymousModel = anonymousModels[0];
		if (firstAnonymousModel) return firstAnonymousModel.id as ModelId;
	}
	
	// For authenticated users, use the default model
	return DEFAULT_MODEL_ID;
}

// Default model ID
export const DEFAULT_MODEL_ID: ModelId = "openai/gpt-5-nano";

// Display name utility
export function getModelDisplayName(modelId: string): string {
	if (modelId in MODELS) {
		return MODELS[modelId as ModelId].displayName;
	}
	return "Unknown Model";
}

// Extract provider from modelId (type-safe)
export function getProviderFromModelId(modelId: ModelId): ModelProvider {
	const model = getModelConfig(modelId);
	return model.provider;
}

// Get actual model name for API calls (removes -thinking suffix)
export function getActualModelName(modelId: ModelId): string {
	const model = getModelConfig(modelId);
	return model.name;
}

// Check if model is in thinking mode
export function isThinkingMode(modelId: ModelId): boolean {
	const model = getModelConfig(modelId);
	return (
		model.features.thinking === true && model.thinkingConfig?.enabled === true
	);
}

// Get the optimal streaming delay for a given model
export function getModelStreamingDelay(modelId: ModelId): number {
	const model = getModelConfig(modelId);
	return model.streamingDelay ?? 15; // Default to 15ms if not specified
}

// Legacy alias for backward compatibility
export const getModelById = getModelConfig;

// Re-export validation functions
export { validateApiKey } from "./schemas";

// Re-export provider icons and utilities
export {
	PROVIDER_ICONS,
	PROVIDER_DISPLAY_NAMES,
	getProviderIcon,
	getProviderDisplayName,
} from "./icons";