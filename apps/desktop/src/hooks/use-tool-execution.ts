import { useState } from "react";

type ToolExecutionState = {
  pending: boolean;
  error: string | null;
  executed: boolean;
};

type ToolResult = {
  success: boolean;
  [key: string]: any;
};

type ToolExecutionHandlers = {
  executeBlenderCode: (code: string) => Promise<ToolResult>;
  getBlenderSceneInfo: () => Promise<ToolResult>;
  reconnectBlender: () => Promise<ToolResult>;
  webSearch: (params: {
    query: string;
    max_results?: number;
    search_depth?: string;
    include_domains?: string[];
    exclude_domains?: string[];
    use_quotes?: boolean;
    time_range?: string;
  }) => Promise<ToolResult>;
  default: (args: any) => Promise<ToolResult>;
};

const handlers: ToolExecutionHandlers = {
  /**
   * Execute Blender code
   */
  executeBlenderCode: async (code: string): Promise<ToolResult> => {
    if (!code) {
      return {
        success: false,
        error: "No code provided",
      };
    }

    // First check if Blender is actually connected
    const connectionStatus = await window.blenderConnection.getStatus();
    if (connectionStatus.status !== "connected") {
      const errorMsg = `Blender is not connected. Current status: ${connectionStatus.status}`;
      return {
        success: false,
        error: errorMsg,
      };
    }

    try {
      console.log(`📤 Sending executeBlenderCode request to main process`);
      const result = await window.blenderConnection.executeCode(code);
      console.log(`📥 Received response from main process`);

      if (result.success) {
        return {
          success: true,
          output: result.output || "Code executed successfully",
          message: "Blender code executed successfully",
        };
      } else {
        const errorMsg = result.error || "Failed to execute code in Blender";
        const isPartialExecutionError =
          errorMsg.includes("not in collection") ||
          errorMsg.includes("does not exist") ||
          errorMsg.includes("cannot find");
        const hasPartialOutput = result.output && result.output.length > 0;

        if (isPartialExecutionError && hasPartialOutput) {
          return {
            success: true, // Mark as success so the agent continues
            partial_error: true,
            error: errorMsg,
            output: result.output || "",
            message:
              "Code executed with partial success. Some operations completed, but errors occurred.",
          };
        } else {
          return {
            success: false,
            error: errorMsg,
          };
        }
      }
    } catch (e: any) {
      return {
        success: false,
        error: e?.message || "Failed to execute tool",
      };
    }
  },

  /**
   * Get Blender scene info
   */
  getBlenderSceneInfo: async (): Promise<ToolResult> => {
    // First check if Blender is actually connected
    const connectionStatus = await window.blenderConnection.getStatus();
    if (connectionStatus.status !== "connected") {
      return {
        success: false,
        error: `Blender is not connected. Current status: ${connectionStatus.status}`,
      };
    }

    try {
      console.log(`📤 Sending getSceneInfo request to main process`);
      const result = await window.blenderConnection.getSceneInfo();
      console.log(`📥 Received response from main process`);

      if (result.success) {
        return {
          success: true,
          message: "Received Blender scene info",
          scene_info: result.scene_info,
        };
      } else {
        return {
          success: false,
          error: result.error || "Failed to get scene info from Blender",
        };
      }
    } catch (e: any) {
      return {
        success: false,
        error: e?.message || "Failed to execute tool",
      };
    }
  },

  /**
   * Reconnect to Blender
   */
  reconnectBlender: async (): Promise<ToolResult> => {
    try {
      if (!window.blenderConnection) {
        throw new Error("Blender connection API not available");
      }

      const connectionStatus = await window.blenderConnection.getStatus();

      return {
        success: true,
        status: connectionStatus,
        message: `Blender connection status: ${connectionStatus.status}`,
      };
    } catch (e: any) {
      return {
        success: false,
        error: e?.message || "Failed to reconnect to Blender",
      };
    }
  },

  /**
   * Execute web search
   */
  webSearch: async (params: {
    query: string;
    max_results?: number;
    search_depth?: string;
    include_domains?: string[];
    exclude_domains?: string[];
    use_quotes?: boolean;
    time_range?: string;
  }): Promise<ToolResult> => {
    const {
      query,
      max_results = 10,
      search_depth = "basic",
      include_domains = [],
      exclude_domains = [],
      use_quotes,
      time_range,
    } = params;

    if (!query) {
      return {
        success: false,
        error: "No search query provided",
      };
    }

    try {
      console.log(`📤 Forwarding web search to backend API`);

      const response = await fetch("/api/web-search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query,
          max_results,
          search_depth,
          include_domains,
          exclude_domains,
          use_quotes,
          time_range,
        }),
      });

      if (!response.ok) {
        throw new Error(
          `Search API error: ${response.status} ${response.statusText}`,
        );
      }

      const result = await response.json();
      console.log(
        `📥 Received web search results with ${result.results?.length || 0} items`,
      );

      return {
        success: true,
        ...result,
      };
    } catch (e: any) {
      return {
        success: false,
        error: e?.message || "Failed to execute web search",
      };
    }
  },

  /**
   * Generic handler for default/unimplemented tools
   */
  default: async (args: any): Promise<ToolResult> => {
    console.log(`📤 Executing default tool handler with args:`, args);

    // For default tools, we simply return success after a brief delay
    // to provide a visual indication that something happened
    return new Promise((resolve) => {
      setTimeout(() => {
        console.log(`📥 Default tool handler completed`);
        resolve({
          success: true,
          message: "Tool executed successfully",
          type: "manual-tool-invocation",
        });
      }, 500);
    });
  },
};

export type ToolType = keyof typeof handlers;

/**
 * Hook for central tool execution management with state tracking
 */
export function useToolExecution() {
  const [state, setState] = useState<Record<string, ToolExecutionState>>({});

  /**
   * Execute a specific tool and track its state
   */
  const executeTool = async (
    toolCallId: string,
    toolType: ToolType,
    args: any,
  ): Promise<ToolResult> => {
    // Update state to pending
    setState((prev) => ({
      ...prev,
      [toolCallId]: {
        pending: true,
        error: null,
        executed: false,
      },
    }));

    console.log(`🧰 Executing ${toolType} tool for call: ${toolCallId}`);

    try {
      let result: ToolResult;

      switch (toolType) {
        case "executeBlenderCode":
          result = await handlers.executeBlenderCode(args.code || "");
          break;
        case "getBlenderSceneInfo":
          result = await handlers.getBlenderSceneInfo();
          break;
        case "reconnectBlender":
          result = await handlers.reconnectBlender();
          break;
        case "webSearch":
          result = await handlers.webSearch({
            query: args.query || "",
            max_results: args.max_results,
            search_depth: args.search_depth,
            include_domains: args.include_domains,
            exclude_domains: args.exclude_domains,
            use_quotes: args.use_quotes,
            time_range: args.time_range,
          });
          break;
        case "default":
          result = await handlers.default(args);
          break;
        default:
          // If we don't have a specific handler, use the default one
          console.log(
            `No specific handler for ${toolType}, using default handler`,
          );
          result = await handlers.default(args);
      }

      // Update state to completed
      setState((prev) => ({
        ...prev,
        [toolCallId]: {
          pending: false,
          error: !result.success ? result.error || null : null,
          executed: true,
        },
      }));

      return result;
    } catch (e: any) {
      const errorMessage = e?.message || `Failed to execute ${toolType}`;

      // Update state to error
      setState((prev) => ({
        ...prev,
        [toolCallId]: {
          pending: false,
          error: errorMessage,
          executed: true,
        },
      }));

      return {
        success: false,
        error: errorMessage,
      };
    }
  };

  /**
   * Mark a tool as declined/rejected by the user
   */
  const declineTool = (toolCallId: string): void => {
    setState((prev) => ({
      ...prev,
      [toolCallId]: {
        pending: false,
        error: null,
        executed: true,
      },
    }));
  };

  /**
   * Get the current state for a specific tool call
   */
  const getToolState = (toolCallId: string): ToolExecutionState => {
    return (
      state[toolCallId] || {
        pending: false,
        error: null,
        executed: false,
      }
    );
  };

  /**
   * Map tool names from the AI to our internal tool types
   */
  const mapToolNameToType = (toolName: string): ToolType | null => {
    const mapping: Record<string, ToolType> = {
      executeBlenderCode: "executeBlenderCode",
      getBlenderSceneInfo: "getBlenderSceneInfo",
      reconnectBlender: "reconnectBlender",
      webSearch: "webSearch",
      // Add more mappings as needed
    };

    return mapping[toolName] || "default";
  };

  return {
    executeTool,
    declineTool,
    getToolState,
    mapToolNameToType,
  };
}
