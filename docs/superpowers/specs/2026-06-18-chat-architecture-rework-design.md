# Chat Architecture Rework Design

Date: 2026-06-18

## Summary

Rework workspace chat around a small versioned conversation interface while keeping the current TanStack Start routes and AI SDK streaming path. The new contract makes model choice, read/write capability, tool exposure, and chronological rendering explicit without splitting the current implementation into many new files.

The approved direction is to keep AI SDK as the durable message and stream protocol, then add Lightfast-specific semantics through versioned settings, capability-aware tools, and optional semantic activity data parts.

## Current Shape

Workspace chat currently uses:

- UI routes under `apps/app/src/routes/_authenticated/$slug/chat/`.
- `WorkspaceAssistantClient` with `useChat` and `DefaultChatTransport`.
- `POST /api/chat` delegated to `apps/app/src/server/chat/workspace-assistant-route.ts`.
- `GET /api/chat/$id/stream` for resumable stream reconnects.
- `@repo/ai/workspace-assistant` for typed `LightfastUIMessage`, tool schemas, data part schemas, and metadata validation.
- Raw AI SDK message parts persisted on workspace assistant messages.

This is a good foundation. The main gaps are that conversation settings are implicit, write mode is per-turn, tools do not share a universal capability interface, and the renderer exposes generic tool cards instead of a semantic chronological turn.

## Goals

- Lock read/write mode per conversation, not per turn.
- Lock model profile per conversation.
- Store user defaults locally for new conversations only.
- Support two product model profiles: `fast` and `thinking`.
- Use current OpenAI GPT models through the existing Gateway path.
- Treat read/write as a universal tool capability system.
- Render assistant turns chronologically from ordered AI SDK parts.
- Add semantic activity rows without replacing AI SDK native parts.
- Version the chat protocol so future UI/message upgrades can coexist with old conversations.
- Keep the first implementation compact and interface-driven.

## Non-Goals

- Do not create a separate agent runtime yet.
- Do not route-version `/api/chat`.
- Do not expose Pro models in the product picker.
- Do not reveal raw private chain-of-thought. Only model-provided reasoning summaries and Lightfast activity summaries should render.
- Do not split the current server path into many modules before the interface proves useful.

## Versioned Chat Contract

`chatSettings.version` is the discriminant for the conversation protocol. The version owns the shape of settings, not just a standalone field beside settings.

```ts
type ChatConversationSettings =
  | {
      version: "1.0.0";
      model: string;
    }
  | {
      version: "2.0.0";
      capabilityMode: "read" | "write";
      modelProfile: "fast" | "thinking";
    };
```

`1.0.0` represents existing conversations: legacy generic parts, the old server-selected model behavior, and no locked conversation-level read/write mode.

`2.0.0` represents the new architecture: locked read/write mode, locked product model profile, capability-filtered tools, optional semantic activity parts, and chronological rendering.

Version-aware helpers should be the only way other code reads this contract:

- `getDefaultChatSettings()`
- `parseChatSettings(conversation)`
- `resolveModel(settings)`
- `resolveTools(settings)`
- `canAppendTurn(settings, request)`
- `toRenderableParts(settings, parts)`

## Persistence

Use the existing conversation `metadata` JSON for first-pass settings storage:

```ts
metadata: {
  chatSettings: ChatConversationSettings
}
```

This avoids a schema migration while the interface is still stabilizing. The existing workspace assistant generation `model` column remains the per-generation audit record for the resolved provider model ID.

Parsing rules:

- If `metadata.chatSettings` parses as a known version, use it.
- If it is missing, treat the conversation as `1.0.0` with the legacy server model that existing conversations were generated with at design time: `anthropic/claude-sonnet-4.6`.
- New conversations are created with `2.0.0`.
- Once the first user message is sent, a `2.0.0` conversation's `capabilityMode` and `modelProfile` cannot change.

## Client Defaults and Locking

The client stores user preferences in `localStorage` for new chats only:

- `lightfast.chat.defaultCapabilityMode`: `read` or `write`
- `lightfast.chat.defaultModelProfile`: `fast` or `thinking`

Before the first send, both controls are editable. On first send, those values are sent with the create/send path and persisted into the conversation's `2.0.0` settings.

After a conversation exists:

- Persisted settings win over local defaults.
- The UI shows mode and model as locked.
- Changing local defaults affects only future new chats.
- The server rejects requests that try to change the conversation's locked mode or model.

## Model Profiles

Expose product labels, not raw provider names.

```ts
type ChatModelProfile = "fast" | "thinking";
```

Approved mapping:

- `fast`: `openai/gpt-5.4-mini`
- `thinking`: `openai/gpt-5.5`

For `thinking`, use OpenAI provider options through AI SDK provider options:

- `reasoningEffort: "medium"`
- reasoning summaries enabled for streaming to the UI

For `fast`, do not request visible reasoning summaries. If the provider still returns reasoning-related metadata, the renderer should remain tolerant.

OpenRouter and AI Gateway catalogs were checked on 2026-06-18. `openai/gpt-5.5` and `openai/gpt-5.4-mini` both support tools and reasoning-related parameters. OpenRouter endpoint throughput fields were null for these models, so throughput should not be hardcoded into the product contract.

## Tool Capability Interface

Keep the first implementation small by defining the underlying interface rather than a large file-level registry.

```ts
type ChatCapabilityMode = "read" | "write";

type ChatToolDefinition = {
  name: string;
  capability: ChatCapabilityMode;
  tool: unknown;
  activity?: {
    label: string;
    provider?: string;
    summarizeInput?: (input: unknown) => string;
    summarizeOutput?: (output: unknown) => string;
  };
};
```

The concrete implementation should use AI SDK tool types instead of `unknown`. The interface above captures the required shape.

Rules:

- Read conversations expose only read tools.
- Write conversations expose read and write tools.
- Unknown or unclassified tools default to write until classified.
- Tool filtering is both UX and model guidance.
- Server-side execution checks remain the safety boundary.
- Forged requests or stale tool calls cannot execute write-capable tools in read conversations.

Existing provider routine classification can be reused:

- `read` maps to read capability.
- `write` maps to write capability.
- `unknown_write_default` maps to write capability.

User connectors and future internal Lightfast tools should use the same capability model.

## AI SDK Practices

The design intentionally follows the current AI SDK 6 patterns already used in the repo:

- Keep `useChat` and `DefaultChatTransport`.
- Keep `streamText`.
- Keep `convertToModelMessages`.
- Keep `safeValidateUIMessages`.
- Keep typed UI message metadata and data part schemas in `@repo/ai/workspace-assistant`.
- Keep native AI SDK ordered parts as the durable message shape.
- Use native typed tool parts such as `tool-findProviderRoutines` where possible.
- Add semantic Lightfast `data-*` parts only when native parts are not expressive enough.
- Use `sendReasoning: true` only for the thinking profile response path.
- Use provider-specific options under `providerOptions.openai`.

## Semantic Activity Parts

Add a typed data part to `@repo/ai/workspace-assistant`:

```ts
type ChatActivityData = {
  id?: string;
  label: string;
  status?: "running" | "completed" | "failed";
  icon?: string;
  provider?: string;
  summary?: string;
  details?: string[];
  sources?: Array<{
    label: string;
    url?: string;
  }>;
};
```

The exact schema can be smaller at implementation time, but it must support:

- A stable label.
- Running/completed/failed state.
- Optional provider/source badges.
- Optional detail rows for inspectable tool inputs or outputs.

These parts are not a replacement for native tool parts. They are semantic rows for chronological display when a raw tool name would be too noisy.

## Chronological Renderer

Assistant messages render their parts in order. The UI should not force all thinking before all tools before all text.

Rendering rules:

- `reasoning` renders as a compact Thinking row.
- `data-activity` renders as a semantic activity row.
- `tool-*` renders as an activity/tool row using tool metadata when available.
- `text` renders as answer content exactly where it appears.
- `source-*` renders as supporting source rows or badges.
- Unknown parts render through a quiet fallback.

Streaming behavior:

- Active reasoning and tool rows stay open while streaming.
- Completed activity rows collapse to a compact row by default.
- Tool output details remain inspectable.
- Rich standalone output appears inline when useful: search result summaries, created or updated entity confirmations, write failures, reconnect warnings, or other user-relevant artifacts.

This adapts the useful parts of Fluid Functionalism's ThinkingSteps pattern: compact accordion rows, active and complete states, source badges, nested detail accordions, and optional media. It should not become a pre-answer thinking-only block.

## Request Flow

For a new `2.0.0` conversation:

1. Client reads local defaults.
2. User may change mode/model before first send.
3. Client sends the first message with requested settings.
4. Server creates or resolves the conversation.
5. Server persists `chatSettings`.
6. Server validates UI messages with the version-aware schema.
7. Server resolves model and tools from settings.
8. Server streams with AI SDK.
9. Server persists the final assistant message parts and generation metadata.

For an existing conversation:

1. Server parses stored settings.
2. Server rejects any requested mode/model that differs from locked settings.
3. Server resolves model and tools from stored settings.
4. Server appends the turn using the existing streaming and persistence path.

## Error Handling

- Invalid chat settings: return 400 for malformed new-conversation settings; treat malformed persisted settings as a server error and log with conversation ID.
- Settings mismatch on existing conversation: return 409.
- Write tool attempted in read mode: deny execution and return a stable tool error that can render as a failed activity row.
- Unsupported model profile: return 400 for new conversations; log and fail safely for persisted invalid settings.
- Reasoning not returned by model: render no reasoning row; do not fail the turn.
- Unknown message part: render fallback text and keep the conversation loadable.

## Testing

Focused tests should cover:

- Parsing missing metadata as `1.0.0`.
- Creating `2.0.0` settings from local-default request payload.
- Rejecting mode/model changes after a conversation is locked.
- Resolving `fast` to `openai/gpt-5.4-mini`.
- Resolving `thinking` to `openai/gpt-5.5` with OpenAI reasoning options.
- Filtering read conversations to read tools only.
- Including read and write tools in write conversations.
- Treating unknown tool capability as write.
- Denying write execution in read mode.
- Validating `data-activity` parts in `safeValidateUIMessages`.
- Rendering chronological sequences containing `reasoning`, `data-activity`, `tool-*`, `source-*`, and `text`.
- Loading legacy `1.0.0` persisted messages with existing generic tool rendering.

## Implementation Boundary

This spec is intentionally interface-first. The first implementation should add the smallest number of files needed to keep code readable. It is acceptable to keep most orchestration in the current server chat module while extracting small helpers only when they clarify the versioned contract.

Future versions can introduce a fuller agent runtime or more explicit event stream, but `2.0.0` should prove the product behavior first.
