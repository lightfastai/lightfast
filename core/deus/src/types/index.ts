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

// Deus Session Management
export const SessionStatus = z.enum(['active', 'paused', 'awaiting_input', 'completed']);
export type SessionStatus = z.infer<typeof SessionStatus>;

export const Task = z.object({
  id: z.string(),
  content: z.string(),
  activeForm: z.string(),
  status: z.enum(['pending', 'in_progress', 'completed']),
  timestamp: z.string(),
});
export type Task = z.infer<typeof Task>;

export const LinkedAgent = z.object({
  agentType: AgentType,
  sessionId: z.string(),
  filePath: z.string(),
  linkedAt: z.string(),
});
export type LinkedAgent = z.infer<typeof LinkedAgent>;

// Session Events
export const SessionEventType = z.enum([
  'session_created',
  'agent_linked',
  'agent_unlinked',
  'status_changed',
  'task_added',
  'task_updated',
  'context_shared',
  'agent_switched',
]);
export type SessionEventType = z.infer<typeof SessionEventType>;

export const SessionEvent = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('session_created'),
    timestamp: z.string(),
    metadata: z.object({
      cwd: z.string(),
      branch: z.string().optional(),
    }),
  }),
  z.object({
    type: z.literal('agent_linked'),
    timestamp: z.string(),
    agentType: AgentType,
    sessionId: z.string(),
    filePath: z.string(),
  }),
  z.object({
    type: z.literal('agent_unlinked'),
    timestamp: z.string(),
    agentType: AgentType,
    sessionId: z.string(),
  }),
  z.object({
    type: z.literal('status_changed'),
    timestamp: z.string(),
    status: SessionStatus,
  }),
  z.object({
    type: z.literal('task_added'),
    timestamp: z.string(),
    task: Task,
  }),
  z.object({
    type: z.literal('task_updated'),
    timestamp: z.string(),
    taskId: z.string(),
    updates: z.object({
      status: z.enum(['pending', 'in_progress', 'completed']).optional(),
      content: z.string().optional(),
      activeForm: z.string().optional(),
    }),
  }),
  z.object({
    type: z.literal('context_shared'),
    timestamp: z.string(),
    key: z.string(),
    value: z.unknown(),
  }),
  z.object({
    type: z.literal('agent_switched'),
    timestamp: z.string(),
    from: AgentType,
    to: AgentType,
  }),
]);
export type SessionEvent = z.infer<typeof SessionEvent>;

// Deus Session State (reconstructed from events)
export const DeusSessionState = z.object({
  sessionId: z.string(),
  status: SessionStatus,
  linkedAgents: z.array(LinkedAgent),
  tasks: z.array(Task),
  sharedContext: z.record(z.unknown()),
  createdAt: z.string(),
  updatedAt: z.string(),
  metadata: z.object({
    cwd: z.string(),
    branch: z.string().optional(),
  }),
});
export type DeusSessionState = z.infer<typeof DeusSessionState>;
