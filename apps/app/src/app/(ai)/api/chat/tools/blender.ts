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
    description: "Execute Blender code",
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

// Schema for the GetBlenderState tool (no parameters needed)
export const getBlenderStateToolSchema = z.object({});

/**
 * Creates a tool to get the current state of the Blender scene.
 */
export function createGetBlenderStateTool() {
  return tool({
    description:
      "Get the current Blender scene state (e.g., active object, selected objects, mode)",
    parameters: getBlenderStateToolSchema,
    // execute function removed to enable frontend confirmation
  });
}
