import { createTool } from "@lightfastai/ai-sdk/tool";
import { z } from "zod";
import type {
  ContentsToolInput,
  ContentsToolOutput,
  LightfastAnswerRuntimeContext,
} from "@repo/console-ai-types";
import { V1ContentsResponseSchema } from "@repo/console-types";

const inputSchema: z.ZodType<ContentsToolInput> = z.object({
  ids: z.array(z.string()).describe("Array of observation IDs to fetch content for"),
});

const outputSchema: z.ZodType<ContentsToolOutput> = V1ContentsResponseSchema;

export function workspaceContentsTool() {
  return createTool<
    LightfastAnswerRuntimeContext,
    typeof inputSchema,
    typeof outputSchema
  >({
    description:
      "Fetch full content for specific observations by ID. Use this to get the complete details of a document after finding it via search or related queries.",
    inputSchema,
    outputSchema,
    execute: async (input, context) => {
      const handler = context.tools?.workspaceContents?.handler;
      if (!handler) {
        throw new Error(
          "Workspace contents handler not configured in runtime context.",
        );
      }
      return handler(input);
    },
  });
}
