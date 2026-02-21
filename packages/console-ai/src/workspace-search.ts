import { createTool } from "@lightfastai/ai-sdk/tool";
import { z } from "zod";
import type {
  SearchToolInput,
  SearchToolOutput,
  LightfastAnswerRuntimeContext,
} from "@repo/console-ai-types";
import { V1SearchResponseSchema } from "@repo/console-types";

const inputSchema: z.ZodType<SearchToolInput> = z.object({
  query: z.string().describe("The search query text"),
  mode: z
    .enum(["fast", "balanced", "thorough"])
    .default("balanced")
    .describe("Search quality mode"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(20)
    .default(10)
    .describe("Max results"),
  filters: z
    .object({
      sourceTypes: z
        .array(z.string())
        .optional()
        .describe("Filter by source: github, linear, vercel, sentry"),
      observationTypes: z
        .array(z.string())
        .optional()
        .describe("Filter by type: commit, pull_request, issue, deployment"),
      actorNames: z
        .array(z.string())
        .optional()
        .describe("Filter by actor name"),
    })
    .optional(),
});

const outputSchema: z.ZodType<SearchToolOutput> = V1SearchResponseSchema;

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
