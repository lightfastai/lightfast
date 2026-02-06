/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */

import { createTool } from "@lightfastai/ai-sdk/tool";
import type { RuntimeContext } from "@lightfastai/ai-sdk/server/adapters/types";
import { z } from "zod";
import { contentsLogic } from "~/lib/v1";
import type { AnswerRuntimeContext } from "../types";
import { randomUUID } from "node:crypto";

export function workspaceContentsTool() {
  return createTool<RuntimeContext<AnswerRuntimeContext>>({
    description:
      "Fetch full content for specific observations by ID. Use this to get the complete details of a document after finding it via search or related queries.",
    inputSchema: z.object({
      ids: z
        .array(z.string())
        .describe("Array of observation IDs to fetch content for"),
    }),
    execute: async (input, context) => {
      const runtimeContext = context as unknown as RuntimeContext<AnswerRuntimeContext>;
      const { workspaceId, userId } = runtimeContext;

      const result = await contentsLogic(
        {
          workspaceId,
          userId,
          authType: "session",
        },
        {
          ids: input.ids,
          requestId: randomUUID(),
        }
      );

      return result;
    },
  });
}
