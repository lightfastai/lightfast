// Types for Inngest events and function payloads

export interface SandboxExecuteEvent {
  name: 'sandbox/execute';
  data: {
    code: string;
    language: 'javascript' | 'js' | 'bash';
  };
}

export interface AgentQueryEvent {
  name: 'agent/query';
  data: {
    query: string;
    context?: Record<string, unknown>;
  };
}

export type InngestEvents = SandboxExecuteEvent | AgentQueryEvent;

// Response types
export interface SandboxExecutionResult {
  success: boolean;
  result?: string;
  error?: string;
  language: string;
}

export interface AgentQueryResult {
  success: boolean;
  response?: string;
  query: string;
  error?: string;
}

// API response types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  eventId?: string;
  message?: string;
}
