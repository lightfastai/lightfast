/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */

import { createTool } from "@lightfastai/ai-sdk/tool";
import type { RuntimeContext } from "@lightfastai/ai-sdk/server/adapters/types";
import { z } from "zod";
import { graphLogic } from "~/lib/v1";
import type { AnswerRuntimeContext } from "../types";
import { randomUUID } from "node:crypto";

export function workspaceGraphTool() {
  return createTool<RuntimeContext<AnswerRuntimeContext>>({
    description:
      "Traverse the relationship graph between events. Use this to answer questions like 'which PR fixed which issue' or 'which deploy included which commits'. Returns connected nodes and their relationships across sources.",
    inputSchema: z.object({
      id: z.string().describe("The observation ID to traverse from"),
      depth: z
        .number()
        .int()
        .min(1)
        .max(3)
        .default(1)
        .describe("Relationship depth to traverse"),
      limit: z
        .number()
        .int()
        .min(1)
        .max(50)
        .default(20)
        .describe("Max relationships to return"),
    }),
    execute: async (input, context) => {
      const runtimeContext = context as unknown as RuntimeContext<AnswerRuntimeContext>;
      const { workspaceId } = runtimeContext;

      const result = await graphLogic(
        {
          workspaceId,
          userId: runtimeContext.userId,
          authType: "session",
        },
        {
          observationId: input.id,
          depth: input.depth,
          requestId: randomUUID(),
        }
      );

      return result;
    },
  });
}
