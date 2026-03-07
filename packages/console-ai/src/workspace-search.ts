import { createTool } from "@lightfastai/ai-sdk/tool";
import { z } from "zod";
import type {
  SearchToolInput,
  SearchToolOutput,
  LightfastAnswerRuntimeContext,
} from "@repo/console-ai-types";
import { V1SearchResponseSchema } from "@repo/console-validation";

const inputSchema: z.ZodType<SearchToolInput> = z.object({
  query: z.string().meta({ description: "The search query text" }),
  mode: z
    .enum(["fast", "balanced", "thorough"])
    .default("balanced")
    .meta({ description: "Search quality mode" }),
  limit: z
    .number()
    .int()
    .min(1)
    .max(20)
    .default(10)
    .meta({ description: "Max results" }),
  filters: z
    .object({
      sourceTypes: z
        .array(z.string())
        .optional()
        .meta({ description: "Filter by source: github, linear, vercel, sentry" }),
      observationTypes: z
        .array(z.string())
        .optional()
        .meta({ description: "Filter by type: commit, pull_request, issue, deployment" }),
      actorNames: z
        .array(z.string())
        .optional()
        .meta({ description: "Filter by actor name" }),
    })
    .optional(),
});

const outputSchema = V1SearchResponseSchema as unknown as z.ZodType<SearchToolOutput>;

export function workspaceSearchTool() {
  return createTool<
    LightfastAnswerRuntimeContext,
    typeof inputSchema,
    typeof outputSchema
  >({
    description:
      "Search through workspace decisions and observations across connected tools. Use this to find commits, PRs, issues, deployments, and other development events. Returns ranked results with scores, snippets, source types, and extracted entities.",
    inputSchema,
    outputSchema,
    execute: async (input, context) => {
      const handler = context.tools?.workspaceSearch?.handler;
      if (!handler) {
        throw new Error(
          "Workspace search handler not configured in runtime context.",
        );
      }
      return handler(input);
    },
  });
}
