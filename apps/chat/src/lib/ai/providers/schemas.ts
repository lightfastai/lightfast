import { z } from "zod";

// Base schemas
export const ModelProviderSchema = z.enum([
	"gateway",
]);
export type ModelProvider = z.infer<typeof ModelProviderSchema>;

// Icon provider schema for UI display
export const IconProviderSchema = z.enum([
	"openai",
	"anthropic",
	"google",
	"moonshot",
]);
export type IconProvider = z.infer<typeof IconProviderSchema>;

// Display name mapping for icon providers
export const ICON_PROVIDER_DISPLAY_NAMES: Record<IconProvider, string> = {
	openai: "OpenAI",
	anthropic: "Anthropic", 
	google: "Google",
	moonshot: "Moonshot AI",
};

// Model feature schema
export const ModelFeaturesSchema = z.object({
	streaming: z.boolean(),
	functionCalling: z.boolean(),
	vision: z.boolean(),
	thinking: z.boolean(),
	pdfSupport: z.boolean(),
});
export type ModelFeatures = z.infer<typeof ModelFeaturesSchema>;

// Thinking config schema
export const ThinkingConfigSchema = z.object({
	enabled: z.boolean(),
	defaultBudgetTokens: z.number(),
});
export type ThinkingConfig = z.infer<typeof ThinkingConfigSchema>;

// Model access level schema
export const ModelAccessLevelSchema = z.enum([
	"anonymous",       // Available to all users (including anonymous)
	"authenticated",   // Available only to authenticated users
]);
export type ModelAccessLevel = z.infer<typeof ModelAccessLevelSchema>;

// Model configuration schema
export const ModelConfigSchema = z.object({
	id: z.string(),
	provider: ModelProviderSchema,
	iconProvider: IconProviderSchema,
	name: z.string(),
	displayName: z.string(),
	description: z.string(),
	maxTokens: z.number(),
	costPer1KTokens: z.object({
		input: z.number(),
		output: z.number(),
	}),
	features: ModelFeaturesSchema,
	thinkingConfig: ThinkingConfigSchema.optional(),
	active: z.boolean().default(true),
	accessLevel: ModelAccessLevelSchema.default("authenticated"),
	streamingDelay: z
		.number()
		.optional()
		.describe("Streaming delay in milliseconds for optimal readability"),
});
export type ModelConfig = z.infer<typeof ModelConfigSchema>;

// Placeholder type - will be overridden by the actual model IDs from MODELS
export type ModelId = string;

// Gateway API key schema (Vercel AI Gateway)
const GatewayKeySchema = z.string().min(1, "Gateway API key is required");

// Validation function
export function validateApiKey(provider: ModelProvider, key: string) {
	const schemas = {
		gateway: GatewayKeySchema,
	};

	return schemas[provider].safeParse(key);
}