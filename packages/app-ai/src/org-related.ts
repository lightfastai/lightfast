import { createTool } from "@lightfastai/ai-sdk/tool";
import type { LightfastAnswerRuntimeContext } from "@repo/app-ai-types";
import { RelatedResponseSchema } from "@repo/app-validation";
import { z } from "zod";

const inputSchema = z.object({
  id: z
    .string()
    .meta({ description: "The observation ID to find related events for" }),
  depth: z.number().int().min(1).max(3).default(1).meta({
    description: "Traversal depth: 1=direct connections, 2=transitive, 3=deep",
  }),
  types: z
    .array(z.string())
    .optional()
    .meta({ description: "Filter by relationship types" }),
});

const outputSchema = RelatedResponseSchema;

export function orgRelatedTool() {
  return createTool<LightfastAnswerRuntimeContext>({
    description:
      "Get related events for a specific observation. Use this to find what happened around a particular event or to understand context. Returns related observations as a graph of nodes and edges.",
    inputSchema: inputSchema as any,
    outputSchema: outputSchema as any,
    execute: async (input, context) => {
      const handler = context.tools?.orgRelated?.handler;
      if (!handler) {
        throw new Error(
          "Org related handler not configured in runtime context."
        );
      }
      return handler(input);
    },
  });
}
