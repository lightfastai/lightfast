/**
 * AI Utilities - Centralized AI model management
 *
 * This module provides utilities for managing AI models, providers,
 * and generation options across the application.
 */

import type { ModelProvider } from "./types"

// Types
export type {
  ModelProvider,
  OpenAIModel,
  AnthropicModel,
  ModelConfig,
  ChatMessage,
  ModelSelectionProps,
  AIGenerationOptions,
} from "./types"

// Models
export {
  OPENAI_MODELS,
  ANTHROPIC_MODELS,
  ALL_MODELS,
  DEFAULT_MODELS,
  getModelsByProvider,
  getModelById,
  getModelDisplayName,
  modelSupportsFeature,
} from "./models"

// Providers
export {
  PROVIDER_CONFIG,
  getLanguageModel,
  getLanguageModelById,
  convertToAIMessages,
  getDefaultGenerationOptions,
  isProviderSupported,
  getProviderDisplayName,
  getSupportedProviders,
  createGenerationOptions,
} from "./providers"

// Constants for easy access
export const AI_PROVIDERS = ["openai", "anthropic"] as const
export const DEFAULT_PROVIDER: ModelProvider = "openai"
