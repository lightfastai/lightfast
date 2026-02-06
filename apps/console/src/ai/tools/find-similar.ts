/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */

import { createTool } from "@lightfastai/ai-sdk/tool";
import type { RuntimeContext } from "@lightfastai/ai-sdk/server/adapters/types";
import { z } from "zod";
import { findsimilarLogic } from "~/lib/v1";
import type { AnswerRuntimeContext } from "../types";
import { randomUUID } from "node:crypto";

export function workspaceFindSimilarTool() {
  return createTool<RuntimeContext<AnswerRuntimeContext>>({
    description:
      "Find semantically similar content to a given document. Use this to discover related observations, expand search results, or find alternatives to a specific document.",
    inputSchema: z.object({
      id: z.string().describe("The observation ID to find similar items for"),
      limit: z
        .number()
        .int()
        .min(1)
        .max(20)
        .default(5)
        .describe("Max similar items to return"),
      threshold: z
        .number()
        .min(0)
        .max(1)
        .default(0.5)
        .describe("Similarity threshold (0-1)"),
    }),
    execute: async (input, context) => {
      const runtimeContext = context as unknown as RuntimeContext<AnswerRuntimeContext>;
      const { workspaceId, userId } = runtimeContext;

      const result = await findsimilarLogic(
        {
          workspaceId,
          userId,
          authType: "session",
        },
        {
          id: input.id,
          limit: input.limit,
          threshold: input.threshold,
          requestId: randomUUID(),
        }
      );

      return result;
    },
  });
}
