/**
 * AI Model Types and Configurations
 */

export type ModelProvider = "openai" | "anthropic"

export type OpenAIModel = "gpt-4o-mini"
export type AnthropicModel = "claude-3-5-sonnet-20241022"

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
  }
}

export interface ChatMessage {
  role: "system" | "user" | "assistant"
  content: string
}

export interface ModelSelectionProps {
  selectedModel: ModelProvider
  onModelChange: (model: ModelProvider) => void
  disabled?: boolean
}

export interface AIGenerationOptions {
  model: ModelProvider
  messages: ChatMessage[]
  maxTokens?: number
  temperature?: number
  stream?: boolean
}
