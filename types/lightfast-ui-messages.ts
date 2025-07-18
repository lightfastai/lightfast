import type { UIMessage } from "ai";

// Custom data types for message parts (empty for now)
export interface LightfastUICustomDataTypes {
  [key: string]: any; // Index signature required by UIDataTypes
}

// Tool schemas based on V1Agent's tools
export type LightfastToolSchemas = {
  // File management tools
  fileWrite: {
    input: {
      path: string;
      content: string;
    };
    output: {
      success: boolean;
      message?: string;
    };
  };
  fileRead: {
    input: {
      path: string;
    };
    output: {
      content: string;
    };
  };
  fileDelete: {
    input: {
      path: string;
    };
    output: {
      success: boolean;
    };
  };
  fileStringReplace: {
    input: {
      path: string;
      searchString: string;
      replaceString: string;
    };
    output: {
      success: boolean;
      replacements?: number;
    };
  };
  fileFindInContent: {
    input: {
      pattern: string;
      directory?: string;
    };
    output: {
      matches: Array<{
        path: string;
        line: number;
        content: string;
      }>;
    };
  };
  fileFindByName: {
    input: {
      pattern: string;
      directory?: string;
    };
    output: {
      files: string[];
    };
  };

  // Information storage
  saveCriticalInfo: {
    input: {
      title: string;
      content: string;
      tags?: string[];
    };
    output: {
      success: boolean;
      id?: string;
    };
  };

  // Task management
  taskManagement: {
    input: {
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
    output: {
      success: boolean;
      tasks?: any[];
      taskId?: string;
    };
  };
  autoTaskDetection: {
    input: {
      userRequest: string;
    };
    output: {
      shouldUseTasks: boolean;
      suggestedTasks?: any[];
    };
  };

  // Web research
  webSearch: {
    input: {
      query: string;
      maxResults?: number;
    };
    output: {
      results: Array<{
        title: string;
        url: string;
        snippet?: string;
      }>;
    };
  };

  // Browser automation - navigation and viewing
  browserNavigate: {
    input: {
      url: string;
    };
    output: {
      success: boolean;
      url?: string;
    };
  };
  browserView: {
    input: {
      selector?: string;
    };
    output: {
      content: string;
    };
  };
  browserClick: {
    input: {
      selector: string;
    };
    output: {
      success: boolean;
    };
  };
  browserType: {
    input: {
      selector: string;
      text: string;
      clear?: boolean;
    };
    output: {
      success: boolean;
    };
  };
  browserSelectOption: {
    input: {
      selector: string;
      value: string;
    };
    output: {
      success: boolean;
    };
  };
  browserScroll: {
    input: {
      direction: 'up' | 'down' | 'left' | 'right';
      amount?: number;
    };
    output: {
      success: boolean;
    };
  };
  browserPressKey: {
    input: {
      key: string;
    };
    output: {
      success: boolean;
    };
  };
  browserMoveMouse: {
    input: {
      x: number;
      y: number;
    };
    output: {
      success: boolean;
    };
  };
  browserWait: {
    input: {
      selector?: string;
      timeout?: number;
    };
    output: {
      success: boolean;
    };
  };
  browserScreenshot: {
    input: {
      path?: string;
      fullPage?: boolean;
    };
    output: {
      success: boolean;
      path?: string;
    };
  };
  browserConsoleExec: {
    input: {
      script: string;
    };
    output: {
      result: any;
    };
  };
  browserReload: {
    input: {};
    output: {
      success: boolean;
    };
  };
  browserHistory: {
    input: {
      action: 'back' | 'forward';
    };
    output: {
      success: boolean;
    };
  };
  browserExtract: {
    input: {
      selectors: Record<string, string>;
    };
    output: {
      data: Record<string, string>;
    };
  };
  browserObserve: {
    input: {
      instruction?: string;
    };
    output: {
      observation: string;
    };
  };

  // Download tools
  downloadFile: {
    input: {
      url: string;
      filename?: string;
    };
    output: {
      success: boolean;
      path?: string;
    };
  };
  downloadDirectFile: {
    input: {
      url: string;
      filename?: string;
    };
    output: {
      success: boolean;
      path?: string;
    };
  };
  downloadImage: {
    input: {
      selector: string;
      filename?: string;
    };
    output: {
      success: boolean;
      path?: string;
    };
  };
  listDownloads: {
    input: {};
    output: {
      downloads: Array<{
        filename: string;
        path: string;
        size?: number;
      }>;
    };
  };

  // Sandbox operations
  createSandbox: {
    input: {
      runtime: 'node22' | 'python3.13';
      timeout?: number;
    };
    output: {
      sandboxId: string;
      success: boolean;
    };
  };
  createSandboxWithPorts: {
    input: {
      runtime: 'node22' | 'python3.13';
      ports: number[];
      timeout?: number;
    };
    output: {
      sandboxId: string;
      success: boolean;
      urls?: Record<number, string>;
    };
  };
  executeSandboxCommand: {
    input: {
      sandboxId: string;
      command: string;
      cwd?: string;
      background?: boolean;
    };
    output: {
      stdout: string;
      stderr: string;
      exitCode: number;
    };
  };
  getSandboxDomain: {
    input: {
      sandboxId: string;
      port: number;
    };
    output: {
      url: string;
    };
  };
  listSandboxRoutes: {
    input: {
      sandboxId: string;
    };
    output: {
      routes: Array<{
        port: number;
        url: string;
      }>;
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

export function isToolPart(part: LightfastUIMessagePart): boolean {
  return typeof part.type === 'string' && part.type.startsWith('tool-');
}


// Utility type to extract tool names
export type LightfastToolName = keyof LightfastToolSchemas;

// Utility type to get input for a specific tool
export type LightfastToolInput<T extends LightfastToolName> = LightfastToolSchemas[T]['input'];