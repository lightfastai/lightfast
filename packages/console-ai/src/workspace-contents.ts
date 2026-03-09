import { createTool } from "@lightfastai/ai-sdk/tool";
import type { LightfastAnswerRuntimeContext } from "@repo/console-ai-types";
import { V1ContentsResponseSchema } from "@repo/console-validation";
import { z } from "zod";

const inputSchema = z.object({
  ids: z
    .array(z.string())
    .meta({ description: "Array of observation IDs to fetch content for" }),
});

const outputSchema = V1ContentsResponseSchema;

export function workspaceContentsTool() {
  return createTool<LightfastAnswerRuntimeContext>({
    description:
      "Fetch full content for specific observations by ID. Use this to get the complete details of a document after finding it via search or related queries.",
    inputSchema: inputSchema as any,
    outputSchema: outputSchema as any,
    execute: async (input, context) => {
      const handler = context.tools?.workspaceContents?.handler;
      if (!handler) {
        throw new Error(
          "Workspace contents handler not configured in runtime context."
        );
      }
      return handler(input);
    },
  });
}
