import type {
  AnthropicModel,
  ModelConfig,
  ModelProvider,
  OpenAIModel,
} from "./types"

/**
 * OpenAI Model Configurations
 */
export const OPENAI_MODELS: Record<OpenAIModel, ModelConfig> = {
  "gpt-4o-mini": {
    id: "gpt-4o-mini",
    provider: "openai",
    name: "gpt-4o-mini",
    displayName: "GPT-4o Mini",
    description: "Fast and efficient model for most tasks",
    maxTokens: 128000,
    costPer1KTokens: {
      input: 0.00015,
      output: 0.0006,
    },
    features: {
      streaming: true,
      functionCalling: true,
      vision: true,
    },
  },
  "gpt-4o": {
    id: "gpt-4o",
    provider: "openai",
    name: "gpt-4o",
    displayName: "GPT-4o",
    description: "Most capable OpenAI model with advanced reasoning",
    maxTokens: 128000,
    costPer1KTokens: {
      input: 0.005,
      output: 0.015,
    },
    features: {
      streaming: true,
      functionCalling: true,
      vision: true,
    },
  },
  "gpt-3.5-turbo": {
    id: "gpt-3.5-turbo",
    provider: "openai",
    name: "gpt-3.5-turbo",
    displayName: "GPT-3.5 Turbo",
    description: "Legacy model, fast and cost-effective",
    maxTokens: 16384,
    costPer1KTokens: {
      input: 0.0005,
      output: 0.0015,
    },
    features: {
      streaming: true,
      functionCalling: true,
      vision: false,
    },
  },
}

/**
 * Anthropic Model Configurations
 */
export const ANTHROPIC_MODELS: Record<AnthropicModel, ModelConfig> = {
  "claude-3-5-sonnet-20241022": {
    id: "claude-3-5-sonnet-20241022",
    provider: "anthropic",
    name: "claude-3-5-sonnet-20241022",
    displayName: "Claude 3.5 Sonnet",
    description: "Most intelligent Claude model with enhanced capabilities",
    maxTokens: 200000,
    costPer1KTokens: {
      input: 0.003,
      output: 0.015,
    },
    features: {
      streaming: true,
      functionCalling: true,
      vision: true,
    },
  },
  "claude-3-haiku-20240307": {
    id: "claude-3-haiku-20240307",
    provider: "anthropic",
    name: "claude-3-haiku-20240307",
    displayName: "Claude 3 Haiku",
    description: "Fast and cost-effective for simple tasks",
    maxTokens: 200000,
    costPer1KTokens: {
      input: 0.00025,
      output: 0.00125,
    },
    features: {
      streaming: true,
      functionCalling: false,
      vision: true,
    },
  },
  "claude-3-opus-20240229": {
    id: "claude-3-opus-20240229",
    provider: "anthropic",
    name: "claude-3-opus-20240229",
    displayName: "Claude 3 Opus",
    description: "Most powerful Claude model for complex reasoning",
    maxTokens: 200000,
    costPer1KTokens: {
      input: 0.015,
      output: 0.075,
    },
    features: {
      streaming: true,
      functionCalling: false,
      vision: true,
    },
  },
}

/**
 * All available models combined
 */
export const ALL_MODELS = {
  ...OPENAI_MODELS,
  ...ANTHROPIC_MODELS,
} as const

/**
 * Default models for each provider
 */
export const DEFAULT_MODELS: Record<ModelProvider, ModelConfig> = {
  openai: OPENAI_MODELS["gpt-4o-mini"],
  anthropic: ANTHROPIC_MODELS["claude-3-5-sonnet-20241022"],
}

/**
 * Get models by provider
 */
export function getModelsByProvider(provider: ModelProvider): ModelConfig[] {
  return Object.values(ALL_MODELS).filter(
    (model) => model.provider === provider,
  )
}

/**
 * Get model configuration by ID
 */
export function getModelById(id: string): ModelConfig | undefined {
  return ALL_MODELS[id as keyof typeof ALL_MODELS]
}

/**
 * Get model display name by provider
 */
export function getModelDisplayName(provider: ModelProvider): string {
  return DEFAULT_MODELS[provider].displayName
}

/**
 * Check if model supports a specific feature
 */
export function modelSupportsFeature(
  modelId: string,
  feature: keyof ModelConfig["features"],
): boolean {
  const model = getModelById(modelId)
  return model?.features[feature] ?? false
}
