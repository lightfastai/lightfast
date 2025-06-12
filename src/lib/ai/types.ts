/**
 * AI Model Types and Configurations
 */

export type ModelProvider = "openai" | "anthropic"

export type OpenAIModel = "gpt-4o-mini" | "gpt-4o" | "gpt-3.5-turbo"
export type AnthropicModel =
  | "claude-sonnet-4-20250514"
  | "claude-sonnet-4-20250514-thinking"
  | "claude-3-5-sonnet-20241022"
  | "claude-3-haiku-20240307"

export type ModelId = OpenAIModel | AnthropicModel

export interface ModelConfig {
  id: string
  provider: ModelProvider
  name: string
  displayName: string
  description: string
  maxTokens: number
  costPer1KTokens: {
    input: number
    output: number
  }
  features: {
    streaming: boolean
    functionCalling: boolean
    vision: boolean
    thinking?: boolean
  }
  thinkingConfig?: {
    enabled: boolean
    defaultBudgetTokens: number
  }
}

export interface ChatMessage {
  role: "system" | "user" | "assistant"
  content: string
}

export interface ModelSelectionProps {
  selectedModel: string
  onModelChange: (modelId: string) => void
  disabled?: boolean
}

export interface AIGenerationOptions {
  modelId: string
  messages: ChatMessage[]
  maxTokens?: number
  temperature?: number
  stream?: boolean
}
