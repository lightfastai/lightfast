/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */

import { createTool } from "@lightfastai/ai-sdk/tool";
import type { RuntimeContext } from "@lightfastai/ai-sdk/server/adapters/types";
import { z } from "zod";
import { searchLogic } from "~/lib/v1";
import type { AnswerRuntimeContext } from "../types";
import { randomUUID } from "node:crypto";

export function workspaceSearchTool() {
  return createTool<RuntimeContext<AnswerRuntimeContext>>({
    description:
      "Search through workspace neural memory for relevant documents and observations. Use this to find commits, PRs, issues, deployments, and other development events. Returns ranked results with scores, snippets, source types, and extracted entities.",
    inputSchema: z.object({
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
            .describe(
              "Filter by type: commit, pull_request, issue, deployment",
            ),
          actorNames: z
            .array(z.string())
            .optional()
            .describe("Filter by actor name"),
        })
        .optional(),
    }),
    execute: async (input, context) => {
      const runtimeContext =
        context as unknown as RuntimeContext<AnswerRuntimeContext>;
      const { workspaceId, userId } = runtimeContext;

      const result = await searchLogic(
        {
          workspaceId,
          userId,
          authType: "session",
        },
        {
          query: input.query,
          mode: input.mode,
          limit: input.limit,
          offset: 0,
          filters: input.filters,
          includeContext: true,
          includeHighlights: true,
          requestId: randomUUID(),
        }
      );

      return result;
    },
  });
}
