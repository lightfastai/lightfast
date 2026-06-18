import { describe, expect, it } from "vitest";

import {
  chatConversationSettingsSchema,
  getDefaultChatSettings,
  getSettingsMetadata,
  isChatSettingsRequestCompatible,
  mapActivityStatusToThinkingStepStatus,
  parseChatSettings,
  resolveChatModelProfile,
} from "../../workspace-assistant/chat-settings";

describe("workspace assistant chat settings", () => {
  it("parses missing metadata as legacy v1 settings", () => {
    expect(parseChatSettings({})).toEqual({
      model: "anthropic/claude-sonnet-4.6",
      version: "1.0.0",
    });
  });

  it("parses persisted v2 settings from conversation metadata", () => {
    expect(
      parseChatSettings({
        chatSettings: {
          capabilityMode: "write",
          modelProfile: "thinking",
          version: "2.0.0",
        },
      })
    ).toEqual({
      capabilityMode: "write",
      modelProfile: "thinking",
      version: "2.0.0",
    });
  });

  it("defaults new v2 chats to read and fast", () => {
    expect(getDefaultChatSettings()).toEqual({
      capabilityMode: "read",
      modelProfile: "fast",
      version: "2.0.0",
    });
  });

  it("rejects incompatible v2 requests once settings are locked", () => {
    const stored = {
      capabilityMode: "read",
      modelProfile: "fast",
      version: "2.0.0",
    } as const;

    expect(isChatSettingsRequestCompatible(stored, stored)).toBe(true);
    expect(
      isChatSettingsRequestCompatible(stored, {
        capabilityMode: "write",
        modelProfile: "fast",
        version: "2.0.0",
      })
    ).toBe(false);
    expect(isChatSettingsRequestCompatible(stored, undefined)).toBe(true);
  });

  it("resolves product model profiles to provider model configuration", () => {
    expect(
      resolveChatModelProfile({
        capabilityMode: "read",
        modelProfile: "fast",
        version: "2.0.0",
      })
    ).toEqual({
      fallbackModels: [],
      model: "openai/gpt-5.4-mini",
      providerOptions: {},
      sendReasoning: false,
    });

    expect(
      resolveChatModelProfile({
        capabilityMode: "write",
        modelProfile: "thinking",
        version: "2.0.0",
      })
    ).toEqual({
      fallbackModels: [],
      model: "openai/gpt-5.5",
      providerOptions: {
        openai: {
          reasoningEffort: "medium",
          reasoningSummary: "auto",
        },
      },
      sendReasoning: true,
    });
  });

  it("keeps legacy model resolution intact", () => {
    expect(
      resolveChatModelProfile({
        model: "anthropic/claude-sonnet-4.6",
        version: "1.0.0",
      })
    ).toEqual({
      fallbackModels: ["openai/gpt-5.4"],
      model: "anthropic/claude-sonnet-4.6",
      providerOptions: {},
      sendReasoning: true,
    });
  });

  it("serializes settings into metadata without dropping existing keys", () => {
    expect(
      getSettingsMetadata(
        { existing: true },
        {
          capabilityMode: "write",
          modelProfile: "thinking",
          version: "2.0.0",
        }
      )
    ).toEqual({
      existing: true,
      chatSettings: {
        capabilityMode: "write",
        modelProfile: "thinking",
        version: "2.0.0",
      },
    });
  });

  it("maps activity states to ThinkingStep statuses", () => {
    expect(mapActivityStatusToThinkingStepStatus("running")).toBe("active");
    expect(mapActivityStatusToThinkingStepStatus("completed")).toBe("complete");
    expect(mapActivityStatusToThinkingStepStatus("failed")).toBe("complete");
  });

  it("exposes a discriminated settings schema", () => {
    expect(
      chatConversationSettingsSchema.parse({
        capabilityMode: "read",
        modelProfile: "fast",
        version: "2.0.0",
      })
    ).toEqual({
      capabilityMode: "read",
      modelProfile: "fast",
      version: "2.0.0",
    });
  });
});
