import { createTool } from "@mastra/core/tools";
import { z } from "zod";

// Example tool that demonstrates accessing threadId and resourceId
export const threadInfoTool = createTool({
  id: "getThreadInfo",
  description: "Returns information about the current conversation thread and resource",
  inputSchema: z.object({
    includeMetadata: z.boolean().optional().default(true).describe("Whether to include additional metadata"),
  }),
  outputSchema: z.object({
    threadId: z.string().optional(),
    resourceId: z.string().optional(),
    timestamp: z.string(),
    metadata: z.object({
      hasThread: z.boolean(),
      hasResource: z.boolean(),
    }).optional(),
  }),
  execute: async ({ context, threadId, resourceId }) => {
    // The execute function receives:
    // - context: The validated input data from inputSchema
    // - threadId: The conversation thread ID (if available)
    // - resourceId: The user/resource ID (if available)
    
    const result = {
      threadId: threadId || undefined,
      resourceId: resourceId || undefined,
      timestamp: new Date().toISOString(),
      metadata: context.includeMetadata ? {
        hasThread: !!threadId,
        hasResource: !!resourceId,
      } : undefined,
    };

    console.log("Tool execution context:", {
      input: context,
      threadId,
      resourceId,
    });

    return result;
  },
});

// Example tool that saves data with thread context
export const saveWithThreadTool = createTool({
  id: "saveData",
  description: "Saves data associated with the current thread",
  inputSchema: z.object({
    data: z.string().describe("The data to save"),
    tag: z.string().optional().describe("Optional tag for the data"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    savedId: z.string(),
    threadContext: z.object({
      threadId: z.string().optional(),
      resourceId: z.string().optional(),
    }),
  }),
  execute: async ({ context, threadId, resourceId }) => {
    // Simulate saving data with thread context
    const savedId = `save_${Date.now()}`;
    
    // In a real implementation, you would save this to a database
    // with the threadId and resourceId for later retrieval
    console.log("Saving data:", {
      id: savedId,
      data: context.data,
      tag: context.tag,
      threadId,
      resourceId,
      timestamp: new Date().toISOString(),
    });

    return {
      success: true,
      savedId,
      threadContext: {
        threadId: threadId || undefined,
        resourceId: resourceId || undefined,
      },
    };
  },
});

// Example usage with an agent
import { Agent } from "@mastra/core/agent";
import { openai } from "@ai-sdk/openai";

export const exampleAgent = new Agent({
  name: "thread-aware-agent",
  instructions: "You are an agent that can access and use thread context information.",
  model: openai("gpt-4o"),
  tools: {
    getThreadInfo: threadInfoTool,
    saveData: saveWithThreadTool,
  },
});

// When calling the agent, threadId and resourceId are passed through to tools:
// const response = await exampleAgent.generate("Save this message for later", {
//   threadId: "conversation-123",
//   resourceId: "user-456",
// });