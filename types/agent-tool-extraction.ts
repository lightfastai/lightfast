import type { z } from "zod";
import { v1Agent } from "@/mastra/agents/v1-agent";

// Extract the tools type from v1Agent
type V1AgentTools = typeof v1Agent.tools;

// Utility type to extract tool schemas from a tools object
type ExtractToolSchemas<TTools> = {
  [K in keyof TTools]: TTools[K] extends {
    inputSchema: infer Input extends z.ZodSchema;
    outputSchema: infer Output extends z.ZodSchema;
  } ? {
    input: z.infer<Input>;
    output: z.infer<Output>;
  } : never;
};

// Create the extracted type for V1Agent's tools
export type V1AgentToolSchemas = ExtractToolSchemas<V1AgentTools>;

// Export individual tool names for convenience
export type V1AgentToolName = keyof V1AgentToolSchemas;

// Utility type to get input for a specific tool
export type V1AgentToolInput<T extends V1AgentToolName> = V1AgentToolSchemas[T]["input"];

// Utility type to get output for a specific tool
export type V1AgentToolOutput<T extends V1AgentToolName> = V1AgentToolSchemas[T]["output"];