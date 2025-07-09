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

// Code investigation events
export interface CodeInvestigationEvent {
  name: 'investigation/start';
  data: {
    query: string;
    repository: string;
    userId: string;
    chatId: string;
  };
}

export interface CodeSearchEvent {
  name: 'investigation/search';
  data: {
    sandboxId: string;
    repository: string;
    searchQuery: string;
    chatId: string;
    parentEventId: string;
  };
}

export interface ScriptExecutionEvent {
  name: 'investigation/execute';
  data: {
    sandboxId: string;
    script: string;
    purpose: string;
    chatId: string;
    parentEventId: string;
  };
}

export interface InvestigationUpdateEvent {
  name: 'investigation/update';
  data: {
    chatId: string;
    message: string;
    type: 'info' | 'success' | 'error' | 'result';
    metadata?: Record<string, unknown>;
  };
}

// Security analysis events
export interface SecurityAnalyzeEvent {
  name: 'security/analyze';
  data: {
    sandboxId: string;
    repository: string;
    securityQuery?: string;
    chatId: string;
    parentEventId: string;
  };
}

// Bug report event
export interface BugReportEvent {
  name: 'bug/report';
  data: {
    bugReport: {
      id: string;
      title: string;
      description: string;
      repository: string;
      filePath?: string;
      lineNumber?: number;
      severity: 'critical' | 'high' | 'medium' | 'low';
      category: 'security' | 'performance' | 'logic' | 'type-safety' | 'memory' | 'other';
      language?: string;
      codeSnippet?: string;
      stackTrace?: string;
      environment?: {
        os?: string;
        nodeVersion?: string;
        dependencies?: Record<string, string>;
      };
    };
    repository: string;
    chatId: string;
  };
}

export type InngestEvents =
  | SandboxExecuteEvent
  | AgentQueryEvent
  | BugReportEvent
  | CodeInvestigationEvent
  | CodeSearchEvent
  | ScriptExecutionEvent
  | InvestigationUpdateEvent
  | SecurityAnalyzeEvent;

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

// Investigation result types
export interface InvestigationResult {
  chatId: string;
  repository: string;
  findings: string[];
  scripts: Array<{
    purpose: string;
    script: string;
    output?: string;
    error?: string;
  }>;
  summary: string;
}

// API response types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  eventId?: string;
  message?: string;
}
