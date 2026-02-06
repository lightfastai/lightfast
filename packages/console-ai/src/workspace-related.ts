import { createTool } from "@lightfastai/ai-sdk/tool";
import { z } from "zod";
import type {
  RelatedToolInput,
  RelatedToolOutput,
  LightfastAnswerRuntimeContext,
} from "@repo/console-ai-types";
import { RelatedResponseSchema } from "@repo/console-types";

const inputSchema: z.ZodType<RelatedToolInput> = z.object({
  id: z.string().describe("The observation ID to find related events for"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .default(20)
    .describe("Max related items to return"),
});

const outputSchema: z.ZodType<RelatedToolOutput> = RelatedResponseSchema;

export function workspaceRelatedTool() {
  return createTool<
    LightfastAnswerRuntimeContext,
    typeof inputSchema,
    typeof outputSchema
  >({
    description:
      "Get directly related events for a specific observation. Use this to find what happened around a particular event or to understand context. Returns related observations grouped by relationship type and source.",
    inputSchema,
    outputSchema,
    execute: async (input, context) => {
      const handler = context.tools?.workspaceRelated?.handler;
      if (!handler) {
        throw new Error(
          "Workspace related handler not configured in runtime context.",
        );
      }
      return handler(input);
    },
  });
}
