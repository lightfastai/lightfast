import { createTool } from "@lightfastai/ai-sdk/tool";
import type { LightfastAnswerRuntimeContext } from "@repo/app-ai-types";
import { FindSimilarResponseSchema } from "@repo/app-validation";
import { z } from "zod";

const inputSchema = z.object({
  id: z
    .string()
    .optional()
    .meta({ description: "The observation ID to find similar items for" }),
  url: z.string().optional().meta({
    description: "URL to find similar content for (alternative to id)",
  }),
  limit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .default(5)
    .meta({ description: "Max similar items to return" }),
  threshold: z
    .number()
    .min(0)
    .max(1)
    .default(0.5)
    .meta({ description: "Similarity threshold (0-1)" }),
  sameSourceOnly: z
    .boolean()
    .default(false)
    .meta({ description: "Only return results from the same source type" }),
  excludeIds: z
    .array(z.string())
    .optional()
    .meta({ description: "IDs to exclude from results" }),
  filters: z
    .object({
      sourceTypes: z.array(z.string()).optional(),
      observationTypes: z.array(z.string()).optional(),
    })
    .optional()
    .meta({ description: "Optional filters to scope results" }),
});

const outputSchema = FindSimilarResponseSchema;

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
