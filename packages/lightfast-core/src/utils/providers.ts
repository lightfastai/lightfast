import { gateway } from "@ai-sdk/gateway";
import type { LanguageModelV2 } from "@ai-sdk/provider";

// Vercel AI Gateway Models
// All AI models are accessed through Vercel AI Gateway for unified management
export const GatewayClaude4Sonnet = (): LanguageModelV2 =>
	gateway("anthropic/claude-4-sonnet");
export const GatewayGPT4o = (): LanguageModelV2 => gateway("openai/gpt-4o");
export const GatewayGPT4oMini = (): LanguageModelV2 =>
	gateway("openai/gpt-4o-mini");
export const GatewayGPT4Nano = (): LanguageModelV2 =>
	gateway("openai/gpt-4-1-nano");
