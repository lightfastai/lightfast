import { createTool } from "@lightfastai/ai-sdk/tool";
import { z } from "zod";
import type {
  GraphToolInput,
  GraphToolOutput,
  LightfastAnswerRuntimeContext,
} from "@repo/console-ai-types";
import { GraphResponseSchema } from "@repo/console-types";

const inputSchema: z.ZodType<GraphToolInput> = z.object({
  id: z.string().meta({ description: "The observation ID to traverse from" }),
  depth: z
    .number()
    .int()
    .min(1)
    .max(3)
    .default(1)
    .meta({ description: "Relationship depth to traverse" }),
  limit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .default(20)
    .meta({ description: "Max relationships to return" }),
});

const outputSchema = GraphResponseSchema as unknown as z.ZodType<GraphToolOutput>;

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
