/**
 * Model types for the chat application
 *
 * This module provides:
 * - ProcessedModel: Model configuration with accessibility information
 * - Types used for model selection and display in UI
 */

/**
 * Model features supported by different models
 */
export interface ModelFeatures {
  streaming: boolean;
  functionCalling: boolean;
  vision: boolean;
  thinking: boolean;
  pdfSupport: boolean;
}

/**
 * Thinking configuration for models that support extended reasoning
 */
export interface ThinkingConfig {
  enabled: boolean;
  defaultBudgetTokens: number;
}

/**
 * Base model configuration
 * This is the core model data structure used throughout the app
 */
export interface ModelConfig {
  id: string;
  provider: string;
  iconProvider: string;
  name: string;
  displayName: string;
  description: string;
  maxOutputTokens: number;
  costPer1KTokens: {
    input: number;
    output: number;
  };
  features: ModelFeatures;
  thinkingConfig?: ThinkingConfig;
  active: boolean;
  accessLevel: "anonymous" | "authenticated";
  billingTier: "non_premium" | "premium";
  streamingDelay?: number;
}

/**
 * Extended model config with accessibility information
 * Used in UI components to determine if a model is available to the current user
 *
 * @template TId - The specific model ID type (defaults to string for flexibility)
 */
export interface ProcessedModel<TId extends string = string> extends ModelConfig {
  id: TId;
  isAccessible: boolean;
  restrictionReason: string | null;
  isPremium: boolean;
  requiresAuth: boolean;
}
