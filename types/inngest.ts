// Types for Inngest events and function payloads

// Update event for SSE
export interface UpdateEvent {
  name: 'updates/send';
  data: {
    chatId: string;
    message: string;
    type: 'info' | 'success' | 'error' | 'result';
    metadata?: Record<string, unknown>;
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

// Task execution event
export interface TaskExecuteEvent {
  name: 'task/execute';
  data: {
    taskDescription: string;
    chatId: string;
    constraints?: {
      maxExecutionTime?: number;
      allowedDependencies?: string[];
      blockedDependencies?: string[];
      memoryLimit?: string;
    };
  };
}

export type InngestEvents =
  | BugReportEvent
  | UpdateEvent
  | TaskExecuteEvent;

// Response types

// API response types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  eventId?: string;
  message?: string;
}
