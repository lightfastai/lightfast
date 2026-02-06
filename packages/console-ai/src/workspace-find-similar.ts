import { createTool } from "@lightfastai/ai-sdk/tool";
import { z } from "zod";
import type {
  FindSimilarToolInput,
  FindSimilarToolOutput,
  LightfastAnswerRuntimeContext,
} from "@repo/console-ai-types";
import { V1FindSimilarResponseSchema } from "@repo/console-types";

const inputSchema: z.ZodType<FindSimilarToolInput> = z.object({
  id: z.string().describe("The observation ID to find similar items for"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(20)
    .default(5)
    .describe("Max similar items to return"),
  threshold: z
    .number()
    .min(0)
    .max(1)
    .default(0.5)
    .describe("Similarity threshold (0-1)"),
});

const outputSchema: z.ZodType<FindSimilarToolOutput> =
  V1FindSimilarResponseSchema;

export function workspaceFindSimilarTool() {
  return createTool<
    LightfastAnswerRuntimeContext,
    typeof inputSchema,
    typeof outputSchema
  >({
    description:
      "Find semantically similar content to a given document. Use this to discover related observations, expand search results, or find alternatives to a specific document.",
    inputSchema,
    outputSchema,
    execute: async (input, context) => {
      const handler = context.tools?.workspaceFindSimilar?.handler;
      if (!handler) {
        throw new Error(
          "Workspace find-similar handler not configured in runtime context.",
        );
      }
      return handler(input);
    },
  });
}
