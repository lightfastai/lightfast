import { createTool } from "@lightfastai/ai-sdk/tool";
import { z } from "zod";
import type {
  GraphToolInput,
  GraphToolOutput,
  LightfastAnswerRuntimeContext,
} from "@repo/console-ai-types";
import { GraphResponseSchema } from "@repo/console-types";

const inputSchema: z.ZodType<GraphToolInput> = z.object({
  id: z.string().describe("The observation ID to traverse from"),
  depth: z
    .number()
    .int()
    .min(1)
    .max(3)
    .default(1)
    .describe("Relationship depth to traverse"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .default(20)
    .describe("Max relationships to return"),
});

const outputSchema: z.ZodType<GraphToolOutput> = GraphResponseSchema;

export function workspaceGraphTool() {
  return createTool<
    LightfastAnswerRuntimeContext,
    typeof inputSchema,
    typeof outputSchema
  >({
    description:
      "Traverse the relationship graph between events. Use this to answer questions like 'which PR fixed which issue' or 'which deploy included which commits'. Returns connected nodes and their relationships across sources.",
    inputSchema,
    outputSchema,
    execute: async (input, context) => {
      const handler = context.tools?.workspaceGraph?.handler;
      if (!handler) {
        throw new Error(
          "Workspace graph handler not configured in runtime context.",
        );
      }
      return handler(input);
    },
  });
}
