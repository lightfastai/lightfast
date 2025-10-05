import { z } from 'zod';

// Agent types
export const AgentType = z.enum(['claude-code', 'codex']);
export type AgentType = z.infer<typeof AgentType>;

// Agent status
export const AgentStatus = z.enum(['idle', 'running', 'waiting', 'error']);
export type AgentStatus = z.infer<typeof AgentStatus>;

// Message types
export const MessageRole = z.enum(['user', 'assistant', 'system']);
export type MessageRole = z.infer<typeof MessageRole>;

export const Message = z.object({
  id: z.string(),
  role: MessageRole,
  content: z.string(),
  timestamp: z.date(),
  agentType: AgentType.optional(),
});
export type Message = z.infer<typeof Message>;

// Agent state
export const AgentState = z.object({
  type: AgentType,
  status: AgentStatus,
  currentTask: z.string().optional(),
  messages: z.array(Message),
  processId: z.number().optional(),
  sessionId: z.string().optional(), // Claude conversation session ID
});
export type AgentState = z.infer<typeof AgentState>;

// Orchestration state
export const OrchestrationState = z.object({
  claudeCode: AgentState,
  codex: AgentState,
  activeAgent: AgentType,
  sharedContext: z.record(z.unknown()),
});
export type OrchestrationState = z.infer<typeof OrchestrationState>;

// Commands
export const Command = z.object({
  type: z.enum(['send', 'switch', 'stop', 'share-context', 'clear']),
  agentType: AgentType.optional(),
  payload: z.unknown().optional(),
});
export type Command = z.infer<typeof Command>;
