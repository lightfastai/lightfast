// Agent-related type definitions for the dev-server

/**
 * Simplified agent type for display in the UI
 */
export interface AgentInfo {
  key: string;
  name: string;
  description?: string;
  model?: string;
  system?: string;
  settings?: {
    model?: string;
    [key: string]: unknown;
  };
}

/**
 * Agent runtime instance (simplified for dev-server)
 * The actual Agent type from lightfast is complex with generics,
 * so we use a simplified version here for UI purposes
 */
export interface AgentRuntime {
  name: string;
  system?: string;
  description?: string;
  settings?: {
    model?: string;
    [key: string]: unknown;
  };
  // Additional runtime properties can be added as needed
}

/**
 * Response from the agents API
 */
export interface AgentsApiResponse {
  success: boolean;
  data?: {
    agents: AgentInfo[];
    count: number;
  };
  error?: string;
  message?: string;
}