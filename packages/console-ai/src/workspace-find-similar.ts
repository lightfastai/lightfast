import { createTool } from "@lightfastai/ai-sdk/tool";
import type { LightfastAnswerRuntimeContext } from "@repo/console-ai-types";
import { V1FindSimilarResponseSchema } from "@repo/console-validation";
import { z } from "zod";

const inputSchema = z.object({
  id: z
    .string()
    .meta({ description: "The observation ID to find similar items for" }),
  limit: z
    .number()
    .int()
    .min(1)
    .max(20)
    .default(5)
    .meta({ description: "Max similar items to return" }),
  threshold: z
    .number()
    .min(0)
    .max(1)
    .default(0.5)
    .meta({ description: "Similarity threshold (0-1)" }),
});

const outputSchema = V1FindSimilarResponseSchema;

export function workspaceFindSimilarTool() {
  return createTool<LightfastAnswerRuntimeContext>({
    description:
      "Find semantically similar content to a given document. Use this to discover related observations, expand search results, or find alternatives to a specific document.",
    inputSchema: inputSchema as any,
    outputSchema: outputSchema as any,
    execute: async (input, context) => {
      const handler = context.tools?.workspaceFindSimilar?.handler;
      if (!handler) {
        throw new Error(
          "Workspace find-similar handler not configured in runtime context."
        );
      }
      return handler(input);
    },
  });
}
