import type { UIMessage } from "@ai-sdk/ui-utils";

// Custom data types for message parts (empty for now)
export interface LightfastUICustomDataTypes {}

// Tool schemas based on V1Agent's tools
export type LightfastToolSchemas = {
  // File management tools
  'tool-fileWrite': {
    args: {
      path: string;
      content: string;
    };
  };
  'tool-fileRead': {
    args: {
      path: string;
    };
  };
  'tool-fileDelete': {
    args: {
      path: string;
    };
  };
  'tool-fileStringReplace': {
    args: {
      path: string;
      searchString: string;
      replaceString: string;
    };
  };
  'tool-fileFindInContent': {
    args: {
      pattern: string;
      directory?: string;
    };
  };
  'tool-fileFindByName': {
    args: {
      pattern: string;
      directory?: string;
    };
  };

  // Information storage
  'tool-saveCriticalInfo': {
    args: {
      title: string;
      content: string;
      tags?: string[];
    };
  };

  // Task management
  'tool-taskManagement': {
    args: {
      action: 'add' | 'add_batch' | 'update' | 'complete' | 'list' | 'clear';
      description?: string;
      priority?: 'high' | 'medium' | 'low';
      taskId?: string;
      status?: 'active' | 'in_progress' | 'completed';
      tasks?: Array<{
        description: string;
        priority: 'high' | 'medium' | 'low';
      }>;
    };
  };
  'tool-autoTaskDetection': {
    args: {
      userRequest: string;
    };
  };

  // Web research
  'tool-webSearch': {
    args: {
      query: string;
      maxResults?: number;
    };
  };

  // Browser automation - navigation and viewing
  'tool-browserNavigate': {
    args: {
      url: string;
    };
  };
  'tool-browserView': {
    args: {
      selector?: string;
    };
  };
  'tool-browserClick': {
    args: {
      selector: string;
    };
  };
  'tool-browserType': {
    args: {
      selector: string;
      text: string;
      clear?: boolean;
    };
  };
  'tool-browserSelectOption': {
    args: {
      selector: string;
      value: string;
    };
  };
  'tool-browserScroll': {
    args: {
      direction: 'up' | 'down' | 'left' | 'right';
      amount?: number;
    };
  };
  'tool-browserPressKey': {
    args: {
      key: string;
    };
  };
  'tool-browserMoveMouse': {
    args: {
      x: number;
      y: number;
    };
  };
  'tool-browserWait': {
    args: {
      selector?: string;
      timeout?: number;
    };
  };
  'tool-browserScreenshot': {
    args: {
      path?: string;
      fullPage?: boolean;
    };
  };
  'tool-browserConsoleExec': {
    args: {
      script: string;
    };
  };
  'tool-browserReload': {
    args: {};
  };
  'tool-browserHistory': {
    args: {
      action: 'back' | 'forward';
    };
  };
  'tool-browserExtract': {
    args: {
      selectors: Record<string, string>;
    };
  };
  'tool-browserObserve': {
    args: {
      instruction?: string;
    };
  };

  // Download tools
  'tool-downloadFile': {
    args: {
      url: string;
      filename?: string;
    };
  };
  'tool-downloadDirectFile': {
    args: {
      url: string;
      filename?: string;
    };
  };
  'tool-downloadImage': {
    args: {
      selector: string;
      filename?: string;
    };
  };
  'tool-listDownloads': {
    args: {};
  };

  // Sandbox operations
  'tool-createSandbox': {
    args: {
      runtime: 'node22' | 'python3.13';
      timeout?: number;
    };
  };
  'tool-createSandboxWithPorts': {
    args: {
      runtime: 'node22' | 'python3.13';
      ports: number[];
      timeout?: number;
    };
  };
  'tool-executeSandboxCommand': {
    args: {
      sandboxId: string;
      command: string;
      cwd?: string;
      background?: boolean;
    };
  };
  'tool-getSandboxDomain': {
    args: {
      sandboxId: string;
      port: number;
    };
  };
  'tool-listSandboxRoutes': {
    args: {
      sandboxId: string;
    };
  };
};

// Main UIMessage type with our custom generics
export type LightfastUIMessage = UIMessage<
  {}, // No custom metadata needed
  LightfastUICustomDataTypes,
  LightfastToolSchemas
>;

// Helper type for message parts
export type LightfastUIMessagePart = LightfastUIMessage['parts'][number];

// Type guards for specific part types
export function isTextPart(part: LightfastUIMessagePart): part is Extract<LightfastUIMessagePart, { type: 'text' }> {
  return part.type === 'text';
}

export function isToolCallPart(part: LightfastUIMessagePart): part is Extract<LightfastUIMessagePart, { type: keyof LightfastToolSchemas }> {
  return typeof part.type === 'string' && part.type.startsWith('tool-');
}

export function isToolResultPart(part: LightfastUIMessagePart): part is Extract<LightfastUIMessagePart, { type: 'tool-result' }> {
  return part.type === 'tool-result';
}


// Utility type to extract tool names
export type LightfastToolName = keyof LightfastToolSchemas;

// Utility type to get args for a specific tool
export type LightfastToolArgs<T extends LightfastToolName> = LightfastToolSchemas[T]['args'];