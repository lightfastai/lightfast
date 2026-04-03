import { createTool } from "@lightfastai/ai-sdk/tool";
import type { LightfastAnswerRuntimeContext } from "@repo/app-ai-types";
import { SearchResponseSchema } from "@repo/app-validation";
import { z } from "zod";

const inputSchema = z.object({
  query: z.string().meta({ description: "The search query text" }),
  mode: z
    .enum(["fast", "balanced", "thorough"])
    .default("balanced")
    .meta({ description: "Search quality mode" }),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(10)
    .meta({ description: "Max results (1-100)" }),
  offset: z
    .number()
    .int()
    .min(0)
    .default(0)
    .meta({ description: "Result offset for pagination" }),
  filters: z
    .object({
      sourceTypes: z.array(z.string()).optional().meta({
        description: "Filter by source: github, linear, vercel, sentry",
      }),
      observationTypes: z.array(z.string()).optional().meta({
        description: "Filter by type: commit, pull_request, issue, deployment",
      }),
      dateRange: z
        .object({
          start: z.string().optional(),
          end: z.string().optional(),
        })
        .optional()
        .meta({ description: "Filter by date range" }),
    })
    .optional(),
});

const outputSchema = SearchResponseSchema;

export function orgSearchTool() {
  return createTool<LightfastAnswerRuntimeContext>({
    description:
      "Search through organization decisions and observations across connected tools. Use this to find commits, PRs, issues, deployments, and other development events. Returns ranked results with scores, snippets, source types, and extracted entities.",
    inputSchema: inputSchema as any,
    outputSchema: outputSchema as any,
    execute: async (input, context) => {
      const handler = context.tools?.orgSearch?.handler;
      if (!handler) {
        throw new Error(
          "Org search handler not configured in runtime context."
        );
      }
      return handler(input);
    },
  });
}
