# Chat Architecture Rework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the v2 workspace chat contract with locked Fast/Thinking model profiles, locked Read/Write capability mode, capability-aware tools, and a Fluid Functionalism-inspired chronological ThinkingSteps rail.

**Architecture:** Keep the existing TanStack Start routes, tRPC conversation router, AI SDK `useChat`/`DefaultChatTransport`, and `streamText` pipeline. Add a shared `@repo/ai/workspace-assistant` settings contract, persist settings in conversation metadata, resolve model/tool behavior on the server, and adapt the existing chat renderer to a chronological rail using a local `ui-v2` ThinkingSteps primitive.

**Tech Stack:** TypeScript, React 19, TanStack Start/Router, tRPC, Drizzle repositories, AI SDK 6 via `@vendor/ai`, Base UI primitives in `@repo/ui-v2`, `motion/react`, Vitest, Testing Library.

---

## Scope Check

This plan intentionally keeps the chat rework in one implementation track because all pieces depend on the same `ChatConversationSettings` contract. It does not create a new agent runtime, route-version `/api/chat`, or introduce DB migrations.

## External References Checked

- AI SDK OpenAI provider docs: `https://ai-sdk.dev/providers/ai-sdk-providers/openai`
- AI SDK provider options docs: `https://ai-sdk.dev/docs/foundations/provider-options`
- Vercel AI Gateway OpenAI reasoning docs: `https://vercel.com/docs/ai-gateway/capabilities/reasoning/openai`
- Fluid Functionalism ThinkingSteps docs: `https://www.fluidfunctionalism.com/docs/thinking-steps`
- Fluid Functionalism registry item: `https://www.fluidfunctionalism.com/r/thinking-steps.json`

## File Structure

- Create `ai/src/workspace-assistant/chat-settings.ts`
  - Owns v1/v2 settings schemas, default v2 settings, metadata parsing, request compatibility, model-profile resolution, localStorage keys, and activity state mapping.
- Modify `ai/src/workspace-assistant/message-schema.ts`
  - Adds typed `data-activity` validation while preserving existing data parts and tools.
- Modify `ai/src/workspace-assistant/index.ts`
  - Re-exports the new settings and activity helpers.
- Add `ai/src/__tests__/workspace-assistant/chat-settings.test.ts`
  - Covers legacy parsing, v2 defaults, lock compatibility, model profile resolution, and activity status mapping.
- Modify `ai/src/__tests__/workspace-assistant/message-schema.test.ts`
  - Covers valid/invalid `data-activity` parts.
- Modify `api/app/src/router/(pending-not-allowed)/workspace-assistant.ts`
  - Accepts optional v2 `chatSettings` on conversation creation and persists it into conversation metadata.
- Modify `api/app/src/__tests__/workspace-assistant-router.test.ts`
  - Covers create metadata persistence and default v2 settings.
- Modify `apps/app/src/server/chat/workspace-assistant-route.ts`
  - Parses locked settings from conversation metadata, rejects mismatches, resolves model profile, toggles `sendReasoning`, applies OpenAI reasoning provider options, and routes tool contexts from capability mode.
- Modify `apps/app/src/__tests__/server-chat-workspace-assistant-route.test.ts`
  - Covers model resolution, reasoning options, settings mismatch, read/write tool contexts, and legacy v1 fallback.
- Modify `apps/app/src/chat/workspace-assistant-client.tsx`
  - Reads/writes localStorage defaults, sends v2 settings for new conversations, derives locked settings from initial conversation metadata, and stops resetting write mode after each turn.
- Modify `apps/app/src/chat/chat-composer.tsx`
  - Replaces the per-turn write toggle with a right-side Fast/Thinking menu and icon-first Read/Write menu, both lockable.
- Modify `apps/app/src/__tests__/chat-workspace-assistant-client.test.tsx`
  - Covers local defaults, first-send payload, locked existing settings, and no per-turn reset.
- Modify `apps/app/src/__tests__/chat-composer.test.tsx`
  - Covers right-side control cluster, accessibility labels, and locked controls.
- Create `packages/ui-v2/src/components/ai-elements/thinking-steps.tsx`
  - Vendors the Fluid component model using this repo's Base UI `Collapsible`, `Badge`, `Shimmer`, and `motion/react` primitives.
- Modify `apps/app/src/chat/message-part.tsx`
  - Renders `reasoning`, `data-activity`, `tool-*`, `source-*`, and fallback activity as ThinkingSteps rows.
- Modify `apps/app/src/chat/chat-message.tsx`
  - Groups adjacent non-text parts into chronological ThinkingSteps activity groups while keeping text interleaved.
- Modify `apps/app/src/__tests__/chat-message.test.tsx`
  - Covers chronological ordering, activity status mapping, tool details, source badges, and legacy fallback.

---

### Task 1: Shared Chat Settings Contract

**Files:**
- Create: `ai/src/workspace-assistant/chat-settings.ts`
- Modify: `ai/src/workspace-assistant/index.ts`
- Test: `ai/src/__tests__/workspace-assistant/chat-settings.test.ts`

- [ ] **Step 1: Write failing tests for settings parsing and model resolution**

Add `ai/src/__tests__/workspace-assistant/chat-settings.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the failing settings tests**

Run:

```bash
pnpm --filter @repo/ai test -- src/__tests__/workspace-assistant/chat-settings.test.ts
```

Expected: FAIL because `chat-settings.ts` does not exist.

- [ ] **Step 3: Implement the shared settings contract**

Create `ai/src/workspace-assistant/chat-settings.ts`:

```ts
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
```

Modify `ai/src/workspace-assistant/index.ts`:

```ts
export {
  CHAT_SETTINGS_STORAGE_KEYS,
  chatCapabilityModeSchema,
  chatConversationSettingsSchema,
  chatConversationSettingsV1Schema,
  chatConversationSettingsV2Schema,
  chatModelProfileSchema,
  getDefaultChatSettings,
  getSettingsMetadata,
  isChatSettingsRequestCompatible,
  mapActivityStatusToThinkingStepStatus,
  parseChatSettings,
  resolveChatModelProfile,
  type ChatActivityStatus,
  type ChatCapabilityMode,
  type ChatConversationSettings,
  type ChatConversationSettingsV2,
  type ChatModelProfile,
  type ResolvedChatModelProfile,
  type ThinkingStepStatus,
} from "./chat-settings";
export {
  type LightfastUIMessage,
  type LightfastWorkspaceAssistantDataParts,
  type LightfastWorkspaceAssistantMessageMetadata,
  type LightfastWorkspaceAssistantMessagePart,
  lightfastWorkspaceAssistantDataPartSchemas,
  lightfastWorkspaceAssistantMessageMetadataSchema,
  lightfastWorkspaceAssistantTools,
  safeValidateLightfastUIMessages,
} from "./message-schema";
```

- [ ] **Step 4: Run the settings tests**

Run:

```bash
pnpm --filter @repo/ai test -- src/__tests__/workspace-assistant/chat-settings.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit shared settings contract**

Run:

```bash
git add ai/src/workspace-assistant/chat-settings.ts ai/src/workspace-assistant/index.ts ai/src/__tests__/workspace-assistant/chat-settings.test.ts
git commit -m "feat: add workspace chat settings contract"
```

---

### Task 2: Typed Activity Data Parts

**Files:**
- Modify: `ai/src/workspace-assistant/message-schema.ts`
- Modify: `ai/src/__tests__/workspace-assistant/message-schema.test.ts`

- [ ] **Step 1: Write failing activity schema tests**

Append to `ai/src/__tests__/workspace-assistant/message-schema.test.ts`:

```ts
  it("validates semantic chat activity data parts", async () => {
    const result = await safeValidateLightfastUIMessages({
      messages: [
        {
          id: "msg_activity",
          parts: [
            {
              data: {
                details: ["Matched LF-142", "Skipped archived issues"],
                icon: "search",
                label: "Linear: searched issues",
                provider: "linear",
                sources: [{ label: "LF-142", url: "https://linear.app/LF-142" }],
                status: "completed",
                summary: "Found 4 issues",
              },
              type: "data-activity",
            },
          ],
          role: "assistant",
        },
      ],
    });

    expect(result.success).toBe(true);
  });

  it("rejects invalid semantic chat activity data parts", async () => {
    const result = await safeValidateLightfastUIMessages({
      messages: [
        {
          id: "msg_activity",
          parts: [
            {
              data: {
                label: "",
                status: "done",
              },
              type: "data-activity",
            },
          ],
          role: "assistant",
        },
      ],
    });

    expect(result.success).toBe(false);
  });
```

- [ ] **Step 2: Run the failing activity schema tests**

Run:

```bash
pnpm --filter @repo/ai test -- src/__tests__/workspace-assistant/message-schema.test.ts
```

Expected: FAIL because `data-activity` is not registered.

- [ ] **Step 3: Add the `activity` data part schema**

Modify `ai/src/workspace-assistant/message-schema.ts` near the existing data schemas:

```ts
const chatActivityDataSchema = z
  .object({
    id: z.string().min(1).optional(),
    label: z.string().trim().min(1),
    status: z.enum(["running", "completed", "failed"]).optional(),
    icon: z.string().trim().min(1).optional(),
    provider: z.string().trim().min(1).optional(),
    summary: z.string().trim().min(1).optional(),
    details: z.array(z.string().trim().min(1)).optional(),
    sources: z
      .array(
        z
          .object({
            label: z.string().trim().min(1),
            url: z.string().url().optional(),
          })
          .strict()
      )
      .optional(),
  })
  .strict();
```

Update the data parts interface and schema map:

```ts
export interface LightfastWorkspaceAssistantDataParts {
  activity?: z.infer<typeof chatActivityDataSchema>;
  opportunities?: z.infer<typeof opportunityDataSchema>;
  skills?: z.infer<typeof skillDataSchema>;
}

export const lightfastWorkspaceAssistantDataPartSchemas = {
  activity: chatActivityDataSchema,
  opportunities: opportunityDataSchema,
  skills: skillDataSchema,
} satisfies {
  [K in "activity" | "opportunities" | "skills"]: FlexibleSchema<
    LightfastWorkspaceAssistantDataParts[K]
  >;
};
```

- [ ] **Step 4: Run message schema tests**

Run:

```bash
pnpm --filter @repo/ai test -- src/__tests__/workspace-assistant/message-schema.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit activity schema**

Run:

```bash
git add ai/src/workspace-assistant/message-schema.ts ai/src/__tests__/workspace-assistant/message-schema.test.ts
git commit -m "feat: add workspace chat activity data part"
```

---

### Task 3: Persist v2 Settings When Conversations Are Created

**Files:**
- Modify: `api/app/src/router/(pending-not-allowed)/workspace-assistant.ts`
- Modify: `api/app/src/__tests__/workspace-assistant-router.test.ts`

- [ ] **Step 1: Write failing router tests for settings metadata**

In `api/app/src/__tests__/workspace-assistant-router.test.ts`, extend the create test expectation and add a defaulting test:

```ts
  it("creates a conversation with explicit v2 chat settings metadata", async () => {
    await caller().assistant.createConversation({
      chatSettings: {
        capabilityMode: "write",
        modelProfile: "thinking",
        version: "2.0.0",
      },
      publicId: "conv_client",
      title: "Update the Linear issue",
    });

    expect(createWorkspaceAssistantConversationMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        metadata: {
          chatSettings: {
            capabilityMode: "write",
            modelProfile: "thinking",
            version: "2.0.0",
          },
        },
      })
    );
  });

  it("defaults created conversations to v2 read fast settings", async () => {
    await caller().assistant.createConversation({
      publicId: "conv_client",
      title: "Summarize my active opportunities",
    });

    expect(createWorkspaceAssistantConversationMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        metadata: {
          chatSettings: {
            capabilityMode: "read",
            modelProfile: "fast",
            version: "2.0.0",
          },
        },
      })
    );
  });
```

- [ ] **Step 2: Run the failing router tests**

Run:

```bash
pnpm --filter @api/app test -- src/__tests__/workspace-assistant-router.test.ts
```

Expected: FAIL because `chatSettings` is not accepted or persisted.

- [ ] **Step 3: Persist settings in createConversation**

Modify imports in `api/app/src/router/(pending-not-allowed)/workspace-assistant.ts`:

```ts
import {
  chatConversationSettingsV2Schema,
  getDefaultChatSettings,
  getSettingsMetadata,
  safeValidateLightfastUIMessages,
} from "@repo/ai/workspace-assistant";
```

Modify `createConversationInput`:

```ts
const createConversationInput = z
  .object({
    chatSettings: chatConversationSettingsV2Schema.optional(),
    publicId: z
      .string()
      .trim()
      .min(1)
      .max(80)
      .regex(/^conv_[A-Za-z0-9_-]+$/)
      .optional(),
    title: z.string().trim().min(1).max(160).optional(),
  })
  .strict()
  .optional();
```

Modify the mutation:

```ts
  createConversation: boundOrgProcedure
    .input(createConversationInput)
    .mutation(({ ctx, input }) =>
      createWorkspaceAssistantConversation(ctx.db, {
        clerkOrgId: ctx.auth.identity.orgId,
        createdByUserId: ctx.auth.identity.userId,
        metadata: getSettingsMetadata(
          {},
          input?.chatSettings ?? getDefaultChatSettings()
        ),
        publicId: input?.publicId,
        title: input?.title,
      })
    ),
```

- [ ] **Step 4: Run router tests**

Run:

```bash
pnpm --filter @api/app test -- src/__tests__/workspace-assistant-router.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit tRPC persistence**

Run:

```bash
git add 'api/app/src/router/(pending-not-allowed)/workspace-assistant.ts' api/app/src/__tests__/workspace-assistant-router.test.ts
git commit -m "feat: persist workspace chat settings"
```

---

### Task 4: Enforce Settings and Resolve Model Profiles on the Server

**Files:**
- Modify: `apps/app/src/server/chat/workspace-assistant-route.ts`
- Modify: `apps/app/src/__tests__/server-chat-workspace-assistant-route.test.ts`

- [ ] **Step 1: Write failing route tests for fast, thinking, mismatch, and legacy**

In `apps/app/src/__tests__/server-chat-workspace-assistant-route.test.ts`, update the `@repo/ai/workspace-assistant` mock to include the new helpers:

```ts
vi.mock("@repo/ai/workspace-assistant", async () => {
  const actual = await vi.importActual<
    typeof import("@repo/ai/workspace-assistant")
  >("@repo/ai/workspace-assistant");

  return {
    ...actual,
    lightfastWorkspaceAssistantDataPartSchemas: {
      opportunities: { kind: "schema" },
    },
    lightfastWorkspaceAssistantMessageMetadataSchema: {
      kind: "metadata-schema",
    },
    lightfastWorkspaceAssistantTools: {
      callProviderRoutine: { inputSchema: { kind: "call-input" } },
      findProviderRoutines: { inputSchema: { kind: "find-input" } },
    },
  };
});
```

Add tests:

```ts
  it("streams a fast v2 conversation with the fast OpenAI model and no reasoning parts", async () => {
    getWorkspaceAssistantConversationByPublicIdMock.mockResolvedValue(
      makeConversation({
        metadata: {
          chatSettings: {
            capabilityMode: "read",
            modelProfile: "fast",
            version: "2.0.0",
          },
        },
      })
    );

    const response = await handleWorkspaceAssistantChatRequest(
      createJsonRequest({
        chatSettings: {
          capabilityMode: "read",
          modelProfile: "fast",
          version: "2.0.0",
        },
        conversationId: "conv_123",
        messages: [
          {
            id: "client-message-1",
            parts: [{ text: "Summarize", type: "text" }],
            role: "user",
          },
        ],
      })
    );

    expect(response.status).toBe(200);
    expect(gatewayMock).toHaveBeenCalledWith("openai/gpt-5.4-mini");
    expect(streamTextMock).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "gateway:openai/gpt-5.4-mini",
        providerOptions: expect.objectContaining({
          gateway: expect.objectContaining({ models: [] }),
        }),
      })
    );
    expect(toUIMessageStreamResponseMock).toHaveBeenCalledWith(
      expect.objectContaining({ sendReasoning: false })
    );
  });

  it("streams a thinking v2 conversation with medium OpenAI reasoning summaries", async () => {
    getWorkspaceAssistantConversationByPublicIdMock.mockResolvedValue(
      makeConversation({
        metadata: {
          chatSettings: {
            capabilityMode: "write",
            modelProfile: "thinking",
            version: "2.0.0",
          },
        },
      })
    );

    const response = await handleWorkspaceAssistantChatRequest(
      createJsonRequest({
        chatSettings: {
          capabilityMode: "write",
          modelProfile: "thinking",
          version: "2.0.0",
        },
        conversationId: "conv_123",
        messages: [
          {
            id: "client-message-1",
            parts: [{ text: "Think through it", type: "text" }],
            role: "user",
          },
        ],
      })
    );

    expect(response.status).toBe(200);
    expect(gatewayMock).toHaveBeenCalledWith("openai/gpt-5.5");
    expect(streamTextMock).toHaveBeenCalledWith(
      expect.objectContaining({
        providerOptions: expect.objectContaining({
          gateway: expect.objectContaining({ models: [] }),
          openai: {
            reasoningEffort: "medium",
            reasoningSummary: "auto",
          },
        }),
      })
    );
    expect(toUIMessageStreamResponseMock).toHaveBeenCalledWith(
      expect.objectContaining({ sendReasoning: true })
    );
  });

  it("rejects requests that try to change locked v2 settings", async () => {
    getWorkspaceAssistantConversationByPublicIdMock.mockResolvedValue(
      makeConversation({
        metadata: {
          chatSettings: {
            capabilityMode: "read",
            modelProfile: "fast",
            version: "2.0.0",
          },
        },
      })
    );

    const response = await handleWorkspaceAssistantChatRequest(
      createJsonRequest({
        chatSettings: {
          capabilityMode: "write",
          modelProfile: "fast",
          version: "2.0.0",
        },
        conversationId: "conv_123",
        messages: [
          {
            id: "client-message-1",
            parts: [{ text: "Change mode", type: "text" }],
            role: "user",
          },
        ],
      })
    );

    expect(response.status).toBe(409);
    expect(streamTextMock).not.toHaveBeenCalled();
  });
```

- [ ] **Step 2: Run the failing route tests**

Run:

```bash
pnpm --filter @lightfast/app test -- src/__tests__/server-chat-workspace-assistant-route.test.ts
```

Expected: FAIL because the route ignores `chatSettings` and hardcodes the legacy model.

- [ ] **Step 3: Wire settings into the server route**

Modify imports in `apps/app/src/server/chat/workspace-assistant-route.ts`:

```ts
  type ChatConversationSettingsV2,
  chatConversationSettingsV2Schema,
  getDefaultChatSettings,
  getSettingsMetadata,
  isChatSettingsRequestCompatible,
  parseChatSettings,
  resolveChatModelProfile,
```

Update `chatRequestSchema`:

```ts
    chatSettings: chatConversationSettingsV2Schema.optional(),
```

After resolving the conversation, add:

```ts
  const chatSettings = parseChatSettings(conversation.metadata);
  const requestedSettings = parsed.data.chatSettings;
  if (!isChatSettingsRequestCompatible(chatSettings, requestedSettings)) {
    return Response.json(
      { error: "Conversation settings are locked" },
      { status: 409 }
    );
  }
  const resolvedModel = resolveChatModelProfile(chatSettings);
  const capabilityMode =
    chatSettings.version === "2.0.0" ? chatSettings.capabilityMode : "write";
```

When creating a generation and logging metadata, replace `WORKSPACE_ASSISTANT_MODEL` with `resolvedModel.model`.

In `streamText`, replace hardcoded model and provider options:

```ts
    model: gateway(resolvedModel.model),
    providerOptions: {
      gateway: {
        cacheControl: "max-age=0",
        models: resolvedModel.fallbackModels,
        tags: [
          "feature:workspace-assistant",
          `org:${identity.orgId}`,
          `conversation:${conversation.publicId}`,
          `env:${process.env.VERCEL_ENV ?? "development"}`,
        ],
        user: identity.userId,
      },
      ...resolvedModel.providerOptions,
    },
```

In `toUIMessageStreamResponse`, add:

```ts
    sendReasoning: resolvedModel.sendReasoning,
```

Update `resolveConversation` to accept requested settings for route-created conversations:

```ts
async function resolveConversation(input: {
  chatSettings?: ChatConversationSettingsV2;
  createdByUserId: string;
  orgId: string;
  submittedMessage: LightfastUIMessage;
  conversationId?: string;
}): Promise<WorkspaceAssistantConversation | undefined> {
```

When calling `createWorkspaceAssistantConversation` inside `resolveConversation`, pass:

```ts
        metadata: getSettingsMetadata(
          {},
          input.chatSettings ?? getDefaultChatSettings()
        ),
```

Also pass `chatSettings: parsed.data.chatSettings` into the `resolveConversation` call.

- [ ] **Step 4: Run route tests**

Run:

```bash
pnpm --filter @lightfast/app test -- src/__tests__/server-chat-workspace-assistant-route.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit server model/settings enforcement**

Run:

```bash
git add apps/app/src/server/chat/workspace-assistant-route.ts apps/app/src/__tests__/server-chat-workspace-assistant-route.test.ts
git commit -m "feat: enforce workspace chat settings"
```

---

### Task 5: Capability-Aware Tool Definitions

**Files:**
- Modify: `apps/app/src/server/chat/workspace-assistant-route.ts`
- Modify: `apps/app/src/__tests__/server-chat-workspace-assistant-route.test.ts`

- [ ] **Step 1: Write failing tests for read/write tool context**

Add to `apps/app/src/__tests__/server-chat-workspace-assistant-route.test.ts`:

```ts
  it("passes read capability mode to provider routine discovery", async () => {
    getWorkspaceAssistantConversationByPublicIdMock.mockResolvedValue(
      makeConversation({
        metadata: {
          chatSettings: {
            capabilityMode: "read",
            modelProfile: "fast",
            version: "2.0.0",
          },
        },
      })
    );

    await handleWorkspaceAssistantChatRequest(
      createJsonRequest({
        conversationId: "conv_123",
        messages: [
          {
            id: "client-message-1",
            parts: [{ text: "Find issues", type: "text" }],
            role: "user",
          },
        ],
      })
    );

    const streamOptions = streamTextMock.mock.calls.at(-1)?.[0] as
      | {
          tools?: Record<
            string,
            { execute?: (input: Record<string, unknown>) => Promise<unknown> }
          >;
        }
      | undefined;

    await streamOptions?.tools?.findProviderRoutines?.execute?.({
      query: "linear",
    });

    expect(findProviderRoutinesMock).toHaveBeenCalledWith(
      expect.objectContaining({ writeMode: false }),
      { query: "linear" }
    );
  });
```

- [ ] **Step 2: Run the failing capability test**

Run:

```bash
pnpm --filter @lightfast/app test -- src/__tests__/server-chat-workspace-assistant-route.test.ts
```

Expected: FAIL until server tools use `capabilityMode` instead of `providerRoutineWriteMode`.

- [ ] **Step 3: Replace per-turn write mode with capability mode**

In `apps/app/src/server/chat/workspace-assistant-route.ts`, keep accepting `providerRoutineWriteMode` only for legacy v1 requests. Compute tool write mode from settings:

```ts
  const capabilityMode =
    chatSettings.version === "2.0.0"
      ? chatSettings.capabilityMode
      : providerRoutineWriteMode
        ? "write"
        : "read";
  const providerRoutineWriteMode = capabilityMode === "write";
```

Define capability-aware tool helpers near `createWorkspaceAssistantTools`:

```ts
type ChatToolCapability = "read" | "write";

interface ChatToolDefinition {
  capability: ChatToolCapability;
  create: () => ReturnType<typeof tool>;
  name: string;
}

function includeToolForMode(
  mode: ChatToolCapability,
  definition: ChatToolDefinition
) {
  return mode === "write" || definition.capability === "read";
}
```

Refactor `createWorkspaceAssistantTools` to build definitions and filter them:

```ts
function createWorkspaceAssistantTools(input: {
  conversation: WorkspaceAssistantConversation;
  orgId: string;
  userId: string;
  writeMode: boolean;
}) {
  const definitions: ChatToolDefinition[] = [
    ...createWorkspaceAssistantProviderRoutineToolDefinitions(input),
    ...createWorkspaceAssistantUserConnectorToolDefinitions(input),
  ];

  return Object.fromEntries(
    definitions
      .filter((definition) =>
        includeToolForMode(input.writeMode ? "write" : "read", definition)
      )
      .map((definition) => [definition.name, definition.create()])
  );
}
```

Classify current tools as read because write denial remains enforced by provider routine runtime context:

```ts
function createWorkspaceAssistantProviderRoutineToolDefinitions(input: {
  conversation: WorkspaceAssistantConversation;
  orgId: string;
  userId: string;
  writeMode: boolean;
}): ChatToolDefinition[] {
  return [
    {
      capability: "read",
      name: "callProviderRoutine",
      create: () =>
        tool({
          description:
            "Call one connected provider routine by routineId using this workspace's enabled connector. Write routines require write mode for this conversation.",
          inputSchema: providerRoutineCallInputSchema,
          outputSchema: providerRoutineCallSuccessSchema,
          execute: async (toolInput) => {
            const { callChatProviderRoutine } = await import(
              "@api/app/services/connectors/chat-routines"
            );
            return callChatProviderRoutine(
              providerRoutineContext(input),
              toolInput
            );
          },
        }),
    },
    {
      capability: "read",
      name: "findProviderRoutines",
      create: () =>
        tool({
          description:
            "Find connected provider routines available to this workspace through enabled connectors. Returns write routines only in Write conversations.",
          inputSchema: providerRoutineFindInputSchema,
          outputSchema: providerRoutineFindOutputSchema,
          execute: async (toolInput) => {
            const { findChatProviderRoutines } = await import(
              "@api/app/services/connectors/chat-routines"
            );
            return findChatProviderRoutines(
              providerRoutineContext(input),
              toolInput
            );
          },
        }),
    },
  ];
}
```

Move user connector tools into `createWorkspaceAssistantUserConnectorToolDefinitions` with `capability: "read"` for both current tools.

- [ ] **Step 4: Run route tests**

Run:

```bash
pnpm --filter @lightfast/app test -- src/__tests__/server-chat-workspace-assistant-route.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit capability-aware tool interface**

Run:

```bash
git add apps/app/src/server/chat/workspace-assistant-route.ts apps/app/src/__tests__/server-chat-workspace-assistant-route.test.ts
git commit -m "feat: add workspace chat tool capabilities"
```

---

### Task 6: Client Defaults and Locked Composer Settings

**Files:**
- Modify: `apps/app/src/chat/workspace-assistant-client.tsx`
- Modify: `apps/app/src/chat/chat-composer.tsx`
- Modify: `apps/app/src/__tests__/chat-workspace-assistant-client.test.tsx`
- Modify: `apps/app/src/__tests__/chat-composer.test.tsx`

- [ ] **Step 1: Write failing client tests for local defaults and locked payloads**

Update the ChatComposer mock in `apps/app/src/__tests__/chat-workspace-assistant-client.test.tsx` to accept model and capability props:

```tsx
vi.mock("~/chat/chat-composer", () => ({
  ChatComposer: ({
    capabilityMode,
    error,
    modelProfile,
    onCapabilityModeChange,
    onModelProfileChange,
    onSubmit,
    onTextChange,
    settingsLocked,
    status,
    text,
  }: {
    capabilityMode: "read" | "write";
    error?: Error;
    modelProfile: "fast" | "thinking";
    onCapabilityModeChange: (mode: "read" | "write") => void;
    onModelProfileChange: (profile: "fast" | "thinking") => void;
    onSubmit: (message: { files: []; text: string }) => Promise<void>;
    onTextChange: (value: string) => void;
    settingsLocked: boolean;
    status: string;
    text: string;
  }) => (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onTextChange("");
        void onSubmit({ files: [], text });
      }}
    >
      <textarea
        aria-label="Message"
        onChange={(event) => onTextChange(event.currentTarget.value)}
        value={text}
      />
      <button
        aria-label="Capability mode"
        data-locked={String(settingsLocked)}
        onClick={() => onCapabilityModeChange("write")}
        type="button"
      >
        {capabilityMode}
      </button>
      <button
        aria-label="Model profile"
        data-locked={String(settingsLocked)}
        onClick={() => onModelProfileChange("thinking")}
        type="button"
      >
        {modelProfile}
      </button>
      <button aria-label="Send message" data-status={status} type="submit">
        Send
      </button>
      {error ? <p>{error.message}</p> : null}
    </form>
  ),
}));
```

Add tests:

```ts
  it("uses localStorage defaults for a new conversation and sends them on first send", async () => {
    window.localStorage.setItem(
      "lightfast.chat.defaultCapabilityMode",
      "write"
    );
    window.localStorage.setItem(
      "lightfast.chat.defaultModelProfile",
      "thinking"
    );

    render(
      <WorkspaceAssistantClient conversationId="conv_ff83026e-ef0e-40db-ae59-544fbe4df209" />
    );

    expect(screen.getByRole("button", { name: "Capability mode" })).toHaveTextContent(
      "write"
    );
    expect(screen.getByRole("button", { name: "Model profile" })).toHaveTextContent(
      "thinking"
    );

    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "Update the ticket" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));

    await waitFor(() => {
      expect(mutateAsyncMock).toHaveBeenCalledWith({
        chatSettings: {
          capabilityMode: "write",
          modelProfile: "thinking",
          version: "2.0.0",
        },
        publicId: "conv_ff83026e-ef0e-40db-ae59-544fbe4df209",
        title: "Update the ticket",
      });
    });

    await waitFor(() => {
      expect(sendMessageMock).toHaveBeenCalledWith(
        { text: "Update the ticket" },
        {
          body: expect.objectContaining({
            chatSettings: {
              capabilityMode: "write",
              modelProfile: "thinking",
              version: "2.0.0",
            },
          }),
        }
      );
    });
  });

  it("locks controls to persisted settings for an existing conversation", () => {
    render(
      <WorkspaceAssistantClient
        conversationId="conv_existing"
        initialConversation={conversationResult({
          conversation: {
            metadata: {
              chatSettings: {
                capabilityMode: "read",
                modelProfile: "fast",
                version: "2.0.0",
              },
            },
          },
        })}
      />
    );

    expect(screen.getByRole("button", { name: "Capability mode" })).toHaveTextContent(
      "read"
    );
    expect(
      screen.getByRole("button", { name: "Capability mode" }).getAttribute(
        "data-locked"
      )
    ).toBe("true");
    expect(screen.getByRole("button", { name: "Model profile" })).toHaveTextContent(
      "fast"
    );
  });
```

Make `conversationResult` accept a partial conversation override:

```ts
function conversationResult(
  overrides: {
    conversation?: Partial<
      WorkspaceAssistantConversationResult["conversation"]
    >;
    messages?: Array<
      Partial<WorkspaceAssistantConversationResult["messages"][number]>
    >;
  } = {}
): WorkspaceAssistantConversationResult {
```

- [ ] **Step 2: Run failing client tests**

Run:

```bash
pnpm --filter @lightfast/app test -- src/__tests__/chat-workspace-assistant-client.test.tsx
```

Expected: FAIL because client state still uses per-turn `providerRoutineWriteMode`.

- [ ] **Step 3: Implement localStorage settings in the client**

Modify imports in `apps/app/src/chat/workspace-assistant-client.tsx`:

```ts
  CHAT_SETTINGS_STORAGE_KEYS,
  type ChatCapabilityMode,
  type ChatModelProfile,
  getDefaultChatSettings,
  parseChatSettings,
```

Replace `providerRoutineWriteMode` state with:

```ts
  const persistedChatSettings = useMemo(
    () => parseChatSettings(initialConversation?.conversation.metadata ?? {}),
    [initialConversation]
  );
  const settingsLocked =
    conversationCreatedRef.current && persistedChatSettings.version === "2.0.0";
  const [capabilityMode, setCapabilityMode] =
    useState<ChatCapabilityMode>(() => readStoredCapabilityMode());
  const [modelProfile, setModelProfile] = useState<ChatModelProfile>(() =>
    readStoredModelProfile()
  );
```

Add localStorage helpers at the bottom of the file:

```ts
function readStoredCapabilityMode(): ChatCapabilityMode {
  if (typeof window === "undefined") {
    return getDefaultChatSettings().capabilityMode;
  }
  const value = window.localStorage.getItem(
    CHAT_SETTINGS_STORAGE_KEYS.capabilityMode
  );
  return value === "write" || value === "read"
    ? value
    : getDefaultChatSettings().capabilityMode;
}

function readStoredModelProfile(): ChatModelProfile {
  if (typeof window === "undefined") {
    return getDefaultChatSettings().modelProfile;
  }
  const value = window.localStorage.getItem(
    CHAT_SETTINGS_STORAGE_KEYS.modelProfile
  );
  return value === "thinking" || value === "fast"
    ? value
    : getDefaultChatSettings().modelProfile;
}

function writeStoredCapabilityMode(mode: ChatCapabilityMode) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(CHAT_SETTINGS_STORAGE_KEYS.capabilityMode, mode);
  }
}

function writeStoredModelProfile(profile: ChatModelProfile) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(CHAT_SETTINGS_STORAGE_KEYS.modelProfile, profile);
  }
}
```

Derive selected settings before submit:

```ts
      const selectedChatSettings =
        persistedChatSettings.version === "2.0.0"
          ? persistedChatSettings
          : {
              capabilityMode,
              modelProfile,
              version: "2.0.0" as const,
            };
```

Pass `chatSettings: selectedChatSettings` into `createConversation.mutateAsync` and `sendMessage` body. Remove `providerRoutineWriteMode` from send body and remove the `setProviderRoutineWriteMode(false)` reset.

When passing props to `ChatComposer`, use:

```tsx
      capabilityMode={
        persistedChatSettings.version === "2.0.0"
          ? persistedChatSettings.capabilityMode
          : capabilityMode
      }
      modelProfile={
        persistedChatSettings.version === "2.0.0"
          ? persistedChatSettings.modelProfile
          : modelProfile
      }
      onCapabilityModeChange={(mode) => {
        if (settingsLocked) {
          return;
        }
        setCapabilityMode(mode);
        writeStoredCapabilityMode(mode);
      }}
      onModelProfileChange={(profile) => {
        if (settingsLocked) {
          return;
        }
        setModelProfile(profile);
        writeStoredModelProfile(profile);
      }}
      settingsLocked={settingsLocked}
```

- [ ] **Step 4: Implement the right-side composer controls**

Modify `apps/app/src/chat/chat-composer.tsx` props:

```ts
  capabilityMode,
  modelProfile,
  onCapabilityModeChange,
  onModelProfileChange,
  settingsLocked,
```

Use `DropdownMenu`, `DropdownMenuContent`, `DropdownMenuItem`, and `DropdownMenuTrigger` from `@repo/ui-v2/components/ui/dropdown-menu`. Use `Button` from `@repo/ui-v2/components/ui/button`. Use lucide `BookOpen`, `ChevronDown`, `Eye`, `Lock`, and `PencilLine`.

Replace the old write toggle with a right-side cluster:

```tsx
const settingsControls = (
  <div className="flex items-center gap-1">
    <ModelProfileMenu
      disabled={isBusy || settingsLocked}
      modelProfile={modelProfile}
      onModelProfileChange={onModelProfileChange}
      settingsLocked={settingsLocked}
    />
    <CapabilityModeMenu
      capabilityMode={capabilityMode}
      disabled={isBusy || settingsLocked}
      onCapabilityModeChange={onCapabilityModeChange}
      settingsLocked={settingsLocked}
    />
  </div>
);
```

Render controls before submit in `PromptInputTools`:

```tsx
<PromptInputTools>
  {settingsControls}
</PromptInputTools>
{submit}
```

The two menu components should have visible labels `Fast`/`Thinking` for the model trigger and icon-only read/write trigger with accessible labels:

```tsx
function modelProfileLabel(profile: ChatModelProfile) {
  return profile === "thinking" ? "Thinking" : "Fast";
}

function capabilityModeLabel(mode: ChatCapabilityMode) {
  return mode === "write" ? "Write mode" : "Read mode";
}
```

- [ ] **Step 5: Update composer tests**

In `apps/app/src/__tests__/chat-composer.test.tsx`, update `baseProps`:

```ts
const baseProps = {
  capabilityMode: "read" as const,
  error: undefined,
  modelProfile: "fast" as const,
  onCapabilityModeChange: vi.fn(),
  onModelProfileChange: vi.fn(),
  onSubmit: vi.fn(),
  onTextChange: vi.fn(),
  settingsLocked: false,
  status: "ready" as const,
  stop: vi.fn(),
  text: "",
};
```

Add assertions to the existing structure test:

```ts
expect(screen.getByRole("button", { name: "Model profile" }).textContent).toContain(
  "Fast"
);
expect(screen.getByRole("button", { name: "Read mode" })).not.toBeNull();
```

Add a locked-state test:

```ts
  it("disables model and mode controls when settings are locked", () => {
    render(<ChatComposer {...baseProps} settingsLocked />);

    expect(screen.getByRole("button", { name: "Model profile" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Read mode" })).toBeDisabled();
  });
```

- [ ] **Step 6: Run client and composer tests**

Run:

```bash
pnpm --filter @lightfast/app test -- src/__tests__/chat-workspace-assistant-client.test.tsx src/__tests__/chat-composer.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit client defaults and composer controls**

Run:

```bash
git add apps/app/src/chat/workspace-assistant-client.tsx apps/app/src/chat/chat-composer.tsx apps/app/src/__tests__/chat-workspace-assistant-client.test.tsx apps/app/src/__tests__/chat-composer.test.tsx
git commit -m "feat: add locked chat composer settings"
```

---

### Task 7: ThinkingSteps Primitive and Chronological Renderer

**Files:**
- Create: `packages/ui-v2/src/components/ai-elements/thinking-steps.tsx`
- Modify: `apps/app/src/chat/message-part.tsx`
- Modify: `apps/app/src/chat/chat-message.tsx`
- Modify: `apps/app/src/__tests__/chat-message.test.tsx`

- [ ] **Step 1: Write failing renderer tests**

Update mocks in `apps/app/src/__tests__/chat-message.test.tsx` by replacing the reasoning mock with a ThinkingSteps mock:

```tsx
vi.mock("@repo/ui-v2/components/ai-elements/thinking-steps", () => ({
  ThinkingStep: ({
    children,
    description,
    label,
    status,
  }: {
    children?: ReactNode;
    description?: string;
    label: string;
    status?: string;
  }) => (
    <div data-status={status} data-testid="thinking-step">
      <span>{label}</span>
      {description ? <p>{description}</p> : null}
      {children}
    </div>
  ),
  ThinkingStepDetails: ({
    children,
    details,
    summary,
  }: {
    children?: ReactNode;
    details?: string[];
    summary: string;
  }) => (
    <details data-testid="thinking-step-details">
      <summary>{summary}</summary>
      {details?.map((detail) => (
        <p key={detail}>{detail}</p>
      ))}
      {children}
    </details>
  ),
  ThinkingStepSource: ({ children }: { children?: ReactNode }) => (
    <span data-testid="thinking-step-source">{children}</span>
  ),
  ThinkingStepSources: ({ children }: { children?: ReactNode }) => (
    <div data-testid="thinking-step-sources">{children}</div>
  ),
  ThinkingSteps: ({ children }: { children?: ReactNode }) => (
    <div data-testid="thinking-steps">{children}</div>
  ),
  ThinkingStepsContent: ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  ),
  ThinkingStepsHeader: ({ children }: { children?: ReactNode }) => (
    <button type="button">{children}</button>
  ),
}));
```

Add a chronological ordering test:

```tsx
  it("renders thinking, tools, sources, and text in chronological order", () => {
    render(
      <ChatMessage
        isStreaming={true}
        message={{
          id: "msg_assistant",
          parts: [
            { text: "Checking context", type: "reasoning" },
            {
              data: {
                label: "Linear: searched issues",
                status: "completed",
                summary: "Found 4 issues",
              },
              type: "data-activity",
            },
            { text: "I found four issues.", type: "text" },
            {
              title: "LF-142",
              type: "source-url",
              url: "https://linear.app/LF-142",
            },
            { text: "The main blocker is LF-142.", type: "text" },
          ],
          role: "assistant",
        }}
      />
    );

    const content = screen.getByTestId("message-content").textContent ?? "";
    expect(content.indexOf("Thinking")).toBeLessThan(
      content.indexOf("I found four issues.")
    );
    expect(content.indexOf("Linear: searched issues")).toBeLessThan(
      content.indexOf("I found four issues.")
    );
    expect(content.indexOf("LF-142")).toBeGreaterThan(
      content.indexOf("I found four issues.")
    );
    expect(content.indexOf("LF-142")).toBeLessThan(
      content.indexOf("The main blocker is LF-142.")
    );
  });

  it("maps running and failed activity rows to ThinkingStep states", () => {
    render(
      <ChatMessage
        isStreaming={true}
        message={{
          id: "msg_assistant",
          parts: [
            {
              data: {
                label: "Searching Linear",
                status: "running",
              },
              type: "data-activity",
            },
            {
              data: {
                details: ["Linear returned 403"],
                label: "Updating Linear",
                status: "failed",
                summary: "Write failed",
              },
              type: "data-activity",
            },
          ],
          role: "assistant",
        }}
      />
    );

    const steps = screen.getAllByTestId("thinking-step");
    expect(steps[0]?.getAttribute("data-status")).toBe("active");
    expect(steps[1]?.getAttribute("data-status")).toBe("complete");
    expect(screen.getByText("Linear returned 403")).toBeTruthy();
  });
```

- [ ] **Step 2: Run failing renderer tests**

Run:

```bash
pnpm --filter @lightfast/app test -- src/__tests__/chat-message.test.tsx
```

Expected: FAIL because `thinking-steps` does not exist and renderer still uses `Reasoning`.

- [ ] **Step 3: Implement the local ThinkingSteps primitive**

Create `packages/ui-v2/src/components/ai-elements/thinking-steps.tsx`:

```tsx
"use client";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@repo/ui-v2/components/ui/collapsible";
import { Badge } from "@repo/ui-v2/components/ui/badge";
import { cn } from "@repo/ui-v2/lib/utils";
import { ChevronDownIcon, CircleIcon } from "lucide-react";
import { motion } from "motion/react";
import type { ComponentProps, ReactNode } from "react";
import { forwardRef, memo } from "react";

import { Shimmer } from "./shimmer";

export type ThinkingStepStatus = "complete" | "active" | "pending";

export type ThinkingStepsProps = ComponentProps<typeof Collapsible> & {
  defaultOpen?: boolean;
};

export const ThinkingSteps = memo(
  ({ className, defaultOpen = true, ...props }: ThinkingStepsProps) => (
    <Collapsible
      className={cn("not-prose mb-4 w-full max-w-full", className)}
      defaultOpen={defaultOpen}
      {...props}
    />
  )
);

export const ThinkingStepsHeader = memo(
  ({ className, children = "Thinking", ...props }: ComponentProps<
    typeof CollapsibleTrigger
  >) => (
    <CollapsibleTrigger
      className={cn(
        "flex w-fit items-center gap-1.5 text-muted-foreground text-sm transition-colors hover:text-foreground",
        className
      )}
      {...props}
    >
      <span>{children}</span>
      <ChevronDownIcon className="size-3.5 transition-transform group-data-[state=open]:rotate-180" />
    </CollapsibleTrigger>
  )
);

export const ThinkingStepsContent = memo(
  ({ className, ...props }: ComponentProps<typeof CollapsibleContent>) => (
    <CollapsibleContent
      className={cn(
        "mt-2 flex flex-col outline-none data-[state=closed]:animate-out data-[state=open]:animate-in",
        className
      )}
      {...props}
    />
  )
);

export interface ThinkingStepProps extends ComponentProps<"div"> {
  label: string;
  description?: string;
  status?: ThinkingStepStatus;
  isLast?: boolean;
  icon?: ReactNode;
}

export const ThinkingStep = memo(
  ({
    className,
    description,
    icon,
    isLast = false,
    label,
    status = "complete",
    children,
    ...props
  }: ThinkingStepProps) => {
    if (status === "pending") {
      return null;
    }

    return (
      <motion.div
        animate={{ height: "auto", opacity: 1 }}
        className={cn("relative overflow-hidden", className)}
        initial={{ height: 0, opacity: 0 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
        {...props}
      >
        <div className="flex gap-2.5 px-1 py-1.5">
          <div className="flex w-[14px] shrink-0 flex-col items-center">
            <div className="grid size-3.5 place-items-center text-muted-foreground">
              {icon ?? <CircleIcon className="size-3" />}
            </div>
            {!isLast ? <div className="mt-1 w-px flex-1 bg-border/60" /> : null}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] leading-tight text-foreground">
              {status === "active" ? (
                <Shimmer as="span" duration={1}>
                  {`${label}...`}
                </Shimmer>
              ) : (
                label
              )}
            </div>
            {description ? (
              <div className="mt-1 text-[13px] leading-snug text-muted-foreground">
                {description}
              </div>
            ) : null}
            {children}
          </div>
        </div>
      </motion.div>
    );
  }
);

export interface ThinkingStepDetailsProps extends ComponentProps<"div"> {
  summary: string;
  details?: string[];
}

export function ThinkingStepDetails({
  className,
  details,
  summary,
  children,
  ...props
}: ThinkingStepDetailsProps) {
  return (
    <div className={cn("mt-1 text-muted-foreground text-xs", className)} {...props}>
      <div>{summary}</div>
      {details?.map((detail) => (
        <div key={detail}>{detail}</div>
      ))}
      {children}
    </div>
  );
}

export const ThinkingStepSources = forwardRef<
  HTMLDivElement,
  ComponentProps<"div">
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("mt-1 flex flex-wrap gap-1.5", className)} {...props} />
));

export function ThinkingStepSource({
  className,
  ...props
}: ComponentProps<typeof Badge>) {
  return <Badge className={cn("rounded-full", className)} variant="secondary" {...props} />;
}

export interface ThinkingStepImageProps extends ComponentProps<"img"> {
  caption?: string;
}

export function ThinkingStepImage({ caption, className, ...props }: ThinkingStepImageProps) {
  return (
    <figure className="mt-2">
      <img className={cn("max-w-[200px] rounded-md object-cover", className)} {...props} />
      {caption ? <figcaption className="mt-1 text-muted-foreground text-xs">{caption}</figcaption> : null}
    </figure>
  );
}

ThinkingSteps.displayName = "ThinkingSteps";
ThinkingStepsHeader.displayName = "ThinkingStepsHeader";
ThinkingStepsContent.displayName = "ThinkingStepsContent";
ThinkingStep.displayName = "ThinkingStep";
ThinkingStepSources.displayName = "ThinkingStepSources";
```

- [ ] **Step 4: Render chronological activity groups**

Modify `apps/app/src/chat/chat-message.tsx` to group adjacent non-text parts:

```tsx
function renderMessageParts({
  isStreaming,
  message,
}: {
  isStreaming: boolean;
  message: UIMessage;
}) {
  const rendered: React.ReactNode[] = [];
  let activityParts: UIMessage["parts"] = [];

  const flushActivity = () => {
    if (activityParts.length === 0) {
      return;
    }
    rendered.push(
      <WorkspaceAssistantActivityGroup
        isStreaming={isStreaming}
        key={`${message.id}-activity-${rendered.length}`}
        parts={activityParts}
      />
    );
    activityParts = [];
  };

  message.parts.forEach((part, index) => {
    if (part.type === "text") {
      flushActivity();
      rendered.push(
        <WorkspaceAssistantMessagePart
          isStreaming={isStreaming}
          key={`${message.id}-${index}`}
          part={part}
        />
      );
      return;
    }
    activityParts.push(part);
  });
  flushActivity();
  return rendered;
}
```

Replace the direct `message.parts.map` call with:

```tsx
{renderMessageParts({ isStreaming, message })}
```

Modify `apps/app/src/chat/message-part.tsx` to export `WorkspaceAssistantActivityGroup` and render rows using the new primitive. Keep the existing generic `Tool` rendering as the details/fallback for tool parts:

```tsx
export function WorkspaceAssistantActivityGroup({
  isStreaming,
  parts,
}: {
  isStreaming: boolean;
  parts: UIMessage["parts"];
}) {
  return (
    <ThinkingSteps defaultOpen={isStreaming}>
      <ThinkingStepsHeader>Thinking</ThinkingStepsHeader>
      <ThinkingStepsContent>
        {parts.map((part, index) => (
          <WorkspaceAssistantActivityPart
            isLast={index === parts.length - 1}
            isStreaming={isStreaming}
            key={`${part.type}-${index}`}
            part={part}
          />
        ))}
      </ThinkingStepsContent>
    </ThinkingSteps>
  );
}
```

Handle `reasoning`, `data-activity`, `tool-*`, `source-url`, and `source-document` inside `WorkspaceAssistantActivityPart`. Use `mapActivityStatusToThinkingStepStatus` for `data-activity`.

- [ ] **Step 5: Run renderer tests**

Run:

```bash
pnpm --filter @lightfast/app test -- src/__tests__/chat-message.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Typecheck ui-v2 and app**

Run:

```bash
pnpm --filter @repo/ui-v2 typecheck
pnpm --filter @lightfast/app typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit chronological renderer**

Run:

```bash
git add packages/ui-v2/src/components/ai-elements/thinking-steps.tsx apps/app/src/chat/message-part.tsx apps/app/src/chat/chat-message.tsx apps/app/src/__tests__/chat-message.test.tsx
git commit -m "feat: render chat activity chronologically"
```

---

### Task 8: Final Verification

**Files:**
- Verify only; no planned edits.

- [ ] **Step 1: Run focused package tests**

Run:

```bash
pnpm --filter @repo/ai test -- src/__tests__/workspace-assistant/chat-settings.test.ts src/__tests__/workspace-assistant/message-schema.test.ts
pnpm --filter @api/app test -- src/__tests__/workspace-assistant-router.test.ts
pnpm --filter @lightfast/app test -- src/__tests__/server-chat-workspace-assistant-route.test.ts src/__tests__/chat-workspace-assistant-client.test.tsx src/__tests__/chat-composer.test.tsx src/__tests__/chat-message.test.tsx
```

Expected: PASS.

- [ ] **Step 2: Run typechecks**

Run:

```bash
pnpm --filter @repo/ai typecheck
pnpm --filter @api/app typecheck
pnpm --filter @repo/ui-v2 typecheck
pnpm --filter @lightfast/app typecheck
```

Expected: PASS.

- [ ] **Step 3: Run app in browser and smoke test**

Run:

```bash
pnpm dev --ui=stream --log-order=stream --log-prefix=task --no-color
```

Open `https://lightfast.localhost` or the current Portless URL. Smoke test:

- New chat shows `Fast` and Read icon on the right by default.
- Selecting `Thinking` and Write before first send persists both controls visually.
- First send creates a conversation and locks both controls.
- A thinking conversation streams reasoning summaries when the provider returns them.
- A fast conversation does not render reasoning summaries unless persisted legacy parts already contain them.
- Activity/tool rows appear in chronological order with answer text interleaved.

---

## Self-Review

- Spec coverage: versioned settings, metadata persistence, local defaults, locked composer controls, Fast/Thinking model mapping, OpenAI reasoning summaries, read/write capability mode, semantic activity data, real ThinkingSteps component model, chronological rendering, legacy fallback, and focused tests are all covered by tasks above.
- Placeholder scan: no `TBD`, `TODO`, or deferred implementation steps remain.
- Type consistency: shared names are `ChatConversationSettings`, `ChatConversationSettingsV2`, `ChatCapabilityMode`, `ChatModelProfile`, `chatSettings`, `capabilityMode`, `modelProfile`, `data-activity`, and `ThinkingStep` throughout the plan.
