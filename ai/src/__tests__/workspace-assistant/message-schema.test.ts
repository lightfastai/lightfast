import { describe, expect, it } from "vitest";

import {
  lightfastWorkspaceAssistantDataPartSchemas,
  lightfastWorkspaceAssistantMessageMetadataSchema,
  safeValidateLightfastUIMessages,
} from "../../workspace-assistant/message-schema";

describe("Lightfast workspace assistant message schema", () => {
  it("validates typed message metadata and supported data parts", async () => {
    await expect(
      lightfastWorkspaceAssistantMessageMetadataSchema.parseAsync({
        generationId: "gen_123",
        source: "workspace-assistant",
        streamId: "stream_123",
      })
    ).resolves.toEqual({
      generationId: "gen_123",
      source: "workspace-assistant",
      streamId: "stream_123",
    });

    await expect(
      lightfastWorkspaceAssistantDataPartSchemas.opportunities.parseAsync({
        count: 0,
        status: "retrieved",
      })
    ).resolves.toEqual({
      count: 0,
      status: "retrieved",
    });
  });

  it("rejects unknown metadata fields and unknown data part names", async () => {
    await expect(
      lightfastWorkspaceAssistantMessageMetadataSchema.parseAsync({
        unsafe: true,
      })
    ).rejects.toThrow();

    const result = await safeValidateLightfastUIMessages({
      messages: [
        {
          id: "msg_123",
          parts: [
            {
              data: { anything: true },
              type: "data-unknown",
            },
          ],
          role: "assistant",
        },
      ],
    });

    expect(result.success).toBe(false);
  });

  it("validates persisted provider routine tool parts", async () => {
    const validResult = await safeValidateLightfastUIMessages({
      messages: [
        {
          id: "msg_123",
          parts: [
            {
              input: { includeSchema: true, query: "issue" },
              output: { routines: [] },
              state: "output-available",
              toolCallId: "tool_call_123",
              type: "tool-findProviderRoutines",
            },
          ],
          role: "assistant",
        },
      ],
    });

    expect(validResult.success).toBe(true);

    const invalidResult = await safeValidateLightfastUIMessages({
      messages: [
        {
          id: "msg_123",
          parts: [
            {
              input: { limit: 1000 },
              output: { routines: [] },
              state: "output-available",
              toolCallId: "tool_call_123",
              type: "tool-findProviderRoutines",
            },
          ],
          role: "assistant",
        },
      ],
    });

    expect(invalidResult.success).toBe(false);
  });

  it("validates persisted user connector tool parts", async () => {
    const validResult = await safeValidateLightfastUIMessages({
      messages: [
        {
          id: "msg_123",
          parts: [
            {
              input: {
                input: { query: "SOC2" },
                routineId: "granola__search_notes",
              },
              output: {
                provider: "granola",
                providerToolName: "search_notes",
                result: { content: [{ text: "result", type: "text" }] },
                routineId: "granola__search_notes",
                status: "succeeded",
              },
              state: "output-available",
              toolCallId: "tool_call_123",
              type: "tool-callUserConnectorTool",
            },
          ],
          role: "assistant",
        },
      ],
    });

    expect(validResult.success).toBe(true);
  });

  it("rejects invalid user connector tool inputs", async () => {
    const invalidResult = await safeValidateLightfastUIMessages({
      messages: [
        {
          id: "msg_123",
          parts: [
            {
              input: {
                input: { query: "SOC2" },
                routineId: "linear__search_notes",
              },
              output: {
                provider: "granola",
                providerToolName: "search_notes",
                result: { content: [{ text: "result", type: "text" }] },
                routineId: "granola__search_notes",
                status: "succeeded",
              },
              state: "output-available",
              toolCallId: "tool_call_123",
              type: "tool-callUserConnectorTool",
            },
          ],
          role: "assistant",
        },
      ],
    });

    expect(invalidResult.success).toBe(false);
  });
});
