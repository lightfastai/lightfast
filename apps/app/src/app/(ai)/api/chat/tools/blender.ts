import { tool } from "ai";
import { z } from "zod";

const executeBlenderCodeToolSchema = z.object({
  code: z.string().describe("The Python code to execute in Blender"),
});

/**
 * Creates a question tool with the appropriate schema for the specified model.
 */
export function createExecuteBlenderCodeTool() {
  return tool({
    description:
      "Execute Blender code. When writing code, always include error handling for collections: check if collections exist before accessing them, use try/except blocks for critical operations, verify objects before linking/unlinking from collections, and consider implementing helper functions for repetitive operations.",
    parameters: executeBlenderCodeToolSchema,
    // execute function removed to enable frontend confirmation
  });
}

export const reconnectBlenderToolSchema = z.object({});

export function createReconnectBlenderTool() {
  return tool({
    description: "Reconnect to Blender",
    parameters: reconnectBlenderToolSchema,
    // execute function removed to enable frontend confirmation
  });
}

// Schema for the GetBlenderSceneInfo tool (no parameters needed)
export const getBlenderSceneInfoToolSchema = z.object({});

/**
 * Creates a tool to get the current scene information from Blender.
 */
export function createGetBlenderSceneInfoTool() {
  return tool({
    description:
      "Get the current Blender scene information (scene name, objects, and materials)",
    parameters: getBlenderSceneInfoToolSchema,
    // execute function removed to enable frontend confirmation
  });
}
