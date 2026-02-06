/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */

import { createTool } from "@lightfastai/ai-sdk/tool";
import type { RuntimeContext } from "@lightfastai/ai-sdk/server/adapters/types";
import { z } from "zod";
import { relatedLogic } from "~/lib/v1";
import type { AnswerRuntimeContext } from "../types";
import { randomUUID } from "node:crypto";

export function workspaceRelatedTool() {
  return createTool<RuntimeContext<AnswerRuntimeContext>>({
    description:
      "Get directly related events for a specific observation. Use this to find what happened around a particular event or to understand context. Returns related observations grouped by relationship type and source.",
    inputSchema: z.object({
      id: z
        .string()
        .describe("The observation ID to find related events for"),
      limit: z
        .number()
        .int()
        .min(1)
        .max(50)
        .default(20)
        .describe("Max related items to return"),
    }),
    execute: async (input, context) => {
      const runtimeContext = context as unknown as RuntimeContext<AnswerRuntimeContext>;
      const { workspaceId, userId } = runtimeContext;

      const result = await relatedLogic(
        {
          workspaceId,
          userId,
          authType: "session",
        },
        {
          observationId: input.id,
          requestId: randomUUID(),
        }
      );

      return result;
    },
  });
}
