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
});
