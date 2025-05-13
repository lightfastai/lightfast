import { tool } from "ai";
import { z } from "zod";

const executeBlenderCodeToolSchema = z.object({
  code: z.string().describe("The Python code to execute in Blender"),
});

/**
 * Creates a tool for executing Python code in Blender.
 * This is a client-side tool that requires frontend confirmation.
 */
export function createExecuteBlenderCodeTool() {
  return tool({
    description:
      "Execute Blender Python code to create, modify, or analyze 3D models. When writing code, always include proper error handling: check if collections exist before accessing them, use try/except blocks for critical operations, verify objects before linking/unlinking from collections, and implement helper functions for repetitive operations.",
    parameters: executeBlenderCodeToolSchema,
    // execute function removed to enable frontend confirmation
  });
}

export const reconnectBlenderToolSchema = z.object({});

/**
 * Creates a tool to reconnect to Blender when connection is lost.
 * This is a client-side tool that requires frontend confirmation.
 */
export function createReconnectBlenderTool() {
  return tool({
    description:
      "Reconnect to Blender when connection is lost or errors occur. Call this tool immediately when encountering Blender execution errors or when the scene information appears outdated. Explain to the user that you're attempting to reconnect before calling this tool.",
    parameters: reconnectBlenderToolSchema,
    // execute function removed to enable frontend confirmation
  });
}

// Schema for the GetBlenderSceneInfo tool (no parameters needed)
export const getBlenderSceneInfoToolSchema = z.object({});

/**
 * Creates a tool to get the current scene information from Blender.
 * This is a client-side tool that requires frontend confirmation.
 */
export function createGetBlenderSceneInfoTool() {
  return tool({
    description:
      "Get the current Blender scene information (scene name, objects, materials, and dimensions). This tool must be called before making any scene modifications or analyses. Always fetch the latest scene information after executing code that modifies the scene, or when you need up-to-date information about the model's structure and dimensions.",
    parameters: getBlenderSceneInfoToolSchema,
    // execute function removed to enable frontend confirmation
  });
}
