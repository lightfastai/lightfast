import { createAgent } from 'lightfast/agent'
import { gateway } from '@ai-sdk/gateway'
import type { LightfastJSON } from 'lightfast/client'

/**
 * Test agents for dev-server development
 * These are injected directly without needing config files or compilation
 */

// Test agents for UI development
const chatAssistant = createAgent({
  name: 'chat-assistant',
  system: `You are a helpful AI assistant for testing the Lightfast dev server.
You can answer questions, have conversations, and help with various tasks.
Be friendly and conversational.`,
  model: gateway('claude-3-5-sonnet-20241022'),
})

const codeHelper = createAgent({
  name: 'code-helper', 
  system: `You are a coding assistant that helps with programming questions.
Provide clear, concise code examples and explanations.
Always use proper markdown formatting for code blocks.`,
  model: gateway('claude-3-5-sonnet-20241022'),
})

const debugAgent = createAgent({
  name: 'debug-agent',
  system: `You are a debugging assistant.
Help identify and fix issues in code.
Provide step-by-step debugging strategies.`,
  model: gateway('gpt-4'),
})

// Export test configuration that matches LightfastJSON structure
export const TEST_CONFIG: LightfastJSON = {
  agents: {
    chat: chatAssistant as any,
    code: codeHelper as any,
    debug: debugAgent as any,
  },
  metadata: {
    name: 'Dev Server Test Agents',
    version: '1.0.0',
    description: 'Test agents for Lightfast dev-server UI development',
  },
  dev: {
    port: 3000,
    hotReload: true,
    verbose: false,
  },
}

// Export individual agents for direct use
export const TEST_AGENTS = {
  chat: chatAssistant,
  code: codeHelper,
  debug: debugAgent,
}