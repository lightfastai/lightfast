import { ModelConfigSchema } from "../schemas";

/**
 * Active AI Models
 *
 * These are the models currently available and supported via Vercel AI Gateway.
 * All models use "gateway" as provider since they're routed through the gateway.
 */
export const ACTIVE_MODELS = {
	// ===== Anthropic Models =====
	"anthropic/claude-4-sonnet": ModelConfigSchema.parse({
		id: "anthropic/claude-4-sonnet",
		provider: "gateway",
		iconProvider: "anthropic",
		name: "anthropic/claude-4-sonnet",
		displayName: "Claude 4 Sonnet",
		description: "Latest generation superior coding and reasoning model",
		maxTokens: 200000,
		costPer1KTokens: { input: 0.003, output: 0.015 },
		features: {
			streaming: true,
			functionCalling: true,
			vision: true,
			thinking: true, // Has extended thinking mode
			pdfSupport: true,
		},
		streamingDelay: 12,
	}),

	// ===== OpenAI GPT-5 Models =====
	"openai/gpt-5-nano": ModelConfigSchema.parse({
		id: "openai/gpt-5-nano",
		provider: "gateway",
		iconProvider: "openai",
		name: "openai/gpt-5-nano",
		displayName: "GPT-5 Nano",
		description: "Ultra-efficient GPT-5 model for simple tasks",
		maxTokens: 400000,
		costPer1KTokens: { input: 0.05, output: 0.4 },
		features: {
			streaming: true,
			functionCalling: true,
			vision: true, // GPT-5 expected to have vision capabilities
			thinking: false,
			pdfSupport: false,
		},
		streamingDelay: 25,
	}),
	"openai/gpt-5-mini": ModelConfigSchema.parse({
		id: "openai/gpt-5-mini",
		provider: "gateway",
		iconProvider: "openai",
		name: "openai/gpt-5-mini",
		displayName: "GPT-5 Mini",
		description: "Efficient GPT-5 model for everyday tasks",
		maxTokens: 400000,
		costPer1KTokens: { input: 0.25, output: 2.0 },
		features: {
			streaming: true,
			functionCalling: true,
			vision: true,
			thinking: false,
			pdfSupport: false,
		},
		streamingDelay: 18,
	}),
	"openai/gpt-5": ModelConfigSchema.parse({
		id: "openai/gpt-5",
		provider: "gateway",
		iconProvider: "openai",
		name: "openai/gpt-5",
		displayName: "GPT-5",
		description: "Most advanced GPT-5 model with enhanced capabilities",
		maxTokens: 400000,
		costPer1KTokens: { input: 1.25, output: 10.0 },
		features: {
			streaming: true,
			functionCalling: true,
			vision: true,
			thinking: false,
			pdfSupport: false,
		},
		streamingDelay: 12,
	}),

	// ===== Google Gemini Models =====
	"google/gemini-2.5-flash": ModelConfigSchema.parse({
		id: "google/gemini-2.5-flash",
		provider: "gateway",
		iconProvider: "google",
		name: "google/gemini-2.5-flash",
		displayName: "Gemini 2.5 Flash",
		description: "Fast and efficient model for most tasks",
		maxTokens: 1048576,
		costPer1KTokens: { input: 0.3, output: 2.5 },
		features: {
			streaming: true,
			functionCalling: true,
			vision: true,
			thinking: true, // Gemini 2.5 Flash has thinking capabilities
			pdfSupport: true, // Supports multimodal document processing
		},
		streamingDelay: 15,
	}),
	"google/gemini-2.5-pro": ModelConfigSchema.parse({
		id: "google/gemini-2.5-pro",
		provider: "gateway",
		iconProvider: "google",
		name: "google/gemini-2.5-pro",
		displayName: "Gemini 2.5 Pro",
		description: "Most advanced Gemini model for complex reasoning",
		maxTokens: 1048576,
		costPer1KTokens: { input: 2.5, output: 10.0 },
		features: {
			streaming: true,
			functionCalling: true,
			vision: true,
			thinking: true, // Gemini 2.5 Pro has advanced reasoning/thinking
			pdfSupport: true, // Supports multimodal document processing
		},
		streamingDelay: 10,
	}),

	// ===== OpenAI Open Source Models =====
	// GPT-OSS-120B: Released in 2025 under Apache 2.0 license
	"openai/gpt-oss-120b": ModelConfigSchema.parse({
		id: "openai/gpt-oss-120b",
		provider: "gateway",
		iconProvider: "openai",
		name: "openai/gpt-oss-120b",
		displayName: "GPT OSS 120B",
		description: "Open source 120B parameter model",
		maxTokens: 131072,
		costPer1KTokens: { input: 0.1, output: 0.5 },
		features: {
			streaming: true,
			functionCalling: true,
			vision: false,
			thinking: false,
			pdfSupport: false,
		},
		streamingDelay: 20,
	}),

	// ===== MoonshotAI Models =====
	"moonshotai/kimi-k2": ModelConfigSchema.parse({
		id: "moonshotai/kimi-k2",
		provider: "gateway",
		iconProvider: "moonshot",
		name: "moonshotai/kimi-k2",
		displayName: "Kimi K2",
		description: "Advanced Chinese/English bilingual model",
		maxTokens: 131072,
		costPer1KTokens: { input: 0.55, output: 2.2 },
		features: {
			streaming: true,
			functionCalling: true,
			vision: true, // Kimi K2 has multimodal capabilities
			thinking: false,
			pdfSupport: true,
		},
		streamingDelay: 18,
	}),
} as const;

