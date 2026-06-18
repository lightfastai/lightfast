import { z } from "zod";

export const CHAT_SETTINGS_STORAGE_KEYS = {
  capabilityMode: "lightfast.chat.defaultCapabilityMode",
  modelProfile: "lightfast.chat.defaultModelProfile",
} as const;

export const chatCapabilityModeSchema = z.enum(["read", "write"]);
export const chatModelProfileSchema = z.enum(["fast", "thinking"]);

export type ChatCapabilityMode = z.infer<typeof chatCapabilityModeSchema>;
export type ChatModelProfile = z.infer<typeof chatModelProfileSchema>;

export const chatConversationSettingsV1Schema = z
  .object({
    version: z.literal("1.0.0"),
    model: z.string().min(1),
  })
  .strict();

export const chatConversationSettingsV2Schema = z
  .object({
    version: z.literal("2.0.0"),
    capabilityMode: chatCapabilityModeSchema,
    modelProfile: chatModelProfileSchema,
  })
  .strict();

export const chatConversationSettingsSchema = z.discriminatedUnion("version", [
  chatConversationSettingsV1Schema,
  chatConversationSettingsV2Schema,
]);

export type ChatConversationSettings = z.infer<
  typeof chatConversationSettingsSchema
>;
export type ChatConversationSettingsV2 = z.infer<
  typeof chatConversationSettingsV2Schema
>;

export type ChatActivityStatus = "running" | "completed" | "failed";
export type ThinkingStepStatus = "active" | "complete" | "pending";

const LEGACY_WORKSPACE_ASSISTANT_MODEL = "anthropic/claude-sonnet-4.6";
const LEGACY_FALLBACK_MODELS = ["openai/gpt-5.4"] as const;

export interface ResolvedChatModelProfile {
  model: string;
  fallbackModels: string[];
  providerOptions: Record<string, unknown>;
  sendReasoning: boolean;
}

export function getDefaultChatSettings(): ChatConversationSettingsV2 {
  return {
    capabilityMode: "read",
    modelProfile: "fast",
    version: "2.0.0",
  };
}

export function parseChatSettings(
  metadata: unknown
): ChatConversationSettings {
  if (metadata && typeof metadata === "object" && "chatSettings" in metadata) {
    const parsed = chatConversationSettingsSchema.safeParse(
      (metadata as { chatSettings?: unknown }).chatSettings
    );
    if (parsed.success) {
      return parsed.data;
    }
  }

  return {
    model: LEGACY_WORKSPACE_ASSISTANT_MODEL,
    version: "1.0.0",
  };
}

export function getSettingsMetadata(
  metadata: Record<string, unknown> | null | undefined,
  settings: ChatConversationSettings
): Record<string, unknown> {
  return {
    ...(metadata ?? {}),
    chatSettings: settings,
  };
}

export function isChatSettingsRequestCompatible(
  stored: ChatConversationSettings,
  requested: ChatConversationSettings | undefined
): boolean {
  if (!requested) {
    return true;
  }
  if (stored.version !== requested.version) {
    return false;
  }
  if (stored.version === "1.0.0") {
    return stored.model === requested.model;
  }
  return (
    stored.capabilityMode === requested.capabilityMode &&
    stored.modelProfile === requested.modelProfile
  );
}

export function resolveChatModelProfile(
  settings: ChatConversationSettings
): ResolvedChatModelProfile {
  if (settings.version === "1.0.0") {
    return {
      fallbackModels: [...LEGACY_FALLBACK_MODELS],
      model: settings.model,
      providerOptions: {},
      sendReasoning: true,
    };
  }

  if (settings.modelProfile === "thinking") {
    return {
      fallbackModels: [],
      model: "openai/gpt-5.5",
      providerOptions: {
        openai: {
          reasoningEffort: "medium",
          reasoningSummary: "auto",
        },
      },
      sendReasoning: true,
    };
  }

  return {
    fallbackModels: [],
    model: "openai/gpt-5.4-mini",
    providerOptions: {},
    sendReasoning: false,
  };
}

export function mapActivityStatusToThinkingStepStatus(
  status: ChatActivityStatus | undefined
): ThinkingStepStatus {
  if (status === "running") {
    return "active";
  }
  return "complete";
}
