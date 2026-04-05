import { createTool } from "@lightfastai/ai-sdk/tool";
import type { LightfastAnswerRuntimeContext } from "@repo/app-ai-types";
import {
  SearchRequestSchema,
  SearchResponseSchema,
} from "@repo/app-validation";

const inputSchema = SearchRequestSchema;
const outputSchema = SearchResponseSchema;

export function orgSearchTool() {
  return createTool<LightfastAnswerRuntimeContext>({
    description:
      "Search through organization decisions and observations across connected tools. Use this to find commits, PRs, issues, deployments, and other development events. Returns ranked results with scores, snippets, source types, and metadata.",
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
