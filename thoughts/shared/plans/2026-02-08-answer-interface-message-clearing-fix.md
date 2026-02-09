# Answer Interface Message Clearing Bug Fix

## Overview

Fix the intermittent bug in `answer-interface.tsx` where messages sometimes don't clear after being sent. Align the clearing pattern with the proven approach used in `apps/chat/src/app/(chat)/_components/chat-interface.tsx`: validate first, send via a boolean-returning helper, and only reset on success.

## Current State Analysis

The `answer-interface.tsx` component has two submit handlers with different async patterns:

1. **handleSubmit** (line 40-61): Uses `await sendMessage()` then calls `formRef.current?.reset()` **after** the await completes. This means the form only clears once the full async operation finishes, which can feel slow and leaves a window where the status may have changed.

2. **handleSuggestionClick** (line 63-79): Uses fire-and-forget `sendMessage().catch()` then calls `formRef.current?.reset()` immediately on the same tick. No validation of success before clearing.

Neither handler validates whether the message was actually queued before clearing, unlike the chat interface which returns a boolean from `handleSendMessage()` and conditionally resets.

### Key Discoveries:
- Chat interface pattern at `chat-interface.tsx:643-869`: `handleSendMessage()` returns `boolean`, checks status/validation, fires message without await, returns `true` on success
- Chat interface pattern at `chat-interface.tsx:876-939`: `handlePromptSubmit()` calls `handleSendMessage()`, only resets form if `success === true`
- Answer interface has no status guards - doesn't check if already `"streaming"` or `"submitted"` before sending
- Both handlers should guard against double-submission and only clear on successful queue

## Desired End State

Both `handleSubmit` and `handleSuggestionClick` in `answer-interface.tsx`:
1. Guard against sending while already streaming/submitted
2. Validate input before sending
3. Fire-and-forget `sendMessage()` (no await, consistent behavior)
4. Only reset the form if the message was successfully queued
5. Follow the same structural pattern as `chat-interface.tsx`

### Verification:
- Submitting a message clears the input reliably
- Submitting while streaming does nothing (no duplicate messages)
- If `sendMessage` throws synchronously, the form retains the message for retry
- Suggestion clicks clear the input after message is queued

## What We're NOT Doing

- Adding attachment support to answer interface
- Adding billing/usage checks
- Adding error toast notifications (console.error is sufficient for now)
- Changing the PromptInput component itself
- Modifying the transport layer or useChat hook

## Implementation Approach

Extract a `handleSendMessage` helper that mirrors the chat pattern: validate, send (fire-and-forget), return boolean. Both `handleSubmit` and `handleSuggestionClick` call this helper and conditionally reset.

## Phase 1: Refactor Message Sending with Conditional Reset

### Overview
Refactor `answer-interface.tsx` to use a boolean-returning `handleSendMessage` helper and conditional form reset, matching the chat interface pattern.

### Changes Required:

#### 1. Add `handleSendMessage` helper and refactor both handlers
**File**: `apps/console/src/components/answer-interface.tsx`
**Changes**:
- Add a `handleSendMessage(text: string): boolean` function that validates input, checks status, and fires sendMessage
- Refactor `handleSubmit` to call `handleSendMessage` and conditionally reset
- Refactor `handleSuggestionClick` to call `handleSendMessage` and conditionally reset

```typescript
// New helper - mirrors chat-interface.tsx:643 pattern
const handleSendMessage = useCallback(
  (text: string): boolean => {
    const trimmedText = text.trim();

    // Guard: empty input, already streaming, or already submitted
    if (
      !trimmedText ||
      status === "streaming" ||
      status === "submitted"
    ) {
      return false;
    }

    const userMessage: UIMessage = {
      role: "user",
      parts: [{ type: "text", text: trimmedText }],
      id: crypto.randomUUID(),
    };

    // Fire-and-forget - matches chat-interface.tsx pattern
    sendMessage(userMessage).catch((error: unknown) => {
      console.error("Failed to send message:", error);
    });

    return true;
  },
  [sendMessage, status],
);

// Refactored handleSubmit
const handleSubmit = useCallback(
  async (promptMessage: PromptInputMessage) => {
    const text = promptMessage.text ?? "";
    const success = handleSendMessage(text);

    if (success && formRef.current) {
      formRef.current.reset();
    }
  },
  [handleSendMessage],
);

// Refactored handleSuggestionClick
const handleSuggestionClick = useCallback(
  (prompt: string) => {
    const success = handleSendMessage(prompt);

    if (success && formRef.current) {
      formRef.current.reset();
    }
  },
  [handleSendMessage],
);
```

### Success Criteria:

#### Automated Verification:
- [x] Type checking passes: `pnpm --filter @lightfast/console typecheck`
- [x] Linting passes: `pnpm --filter @lightfast/console lint`
- [x] Build succeeds: `pnpm --filter @lightfast/console build`

#### Manual Verification:
- [ ] Submit a message via text input - input clears after send
- [ ] Click a suggestion - input clears after send
- [ ] Rapidly submit multiple messages - no duplicate sends, input clears each time
- [ ] Submit while streaming - nothing happens (guard prevents it)
- [ ] Submit empty input - nothing happens (guard prevents it)
- [ ] No regressions in message display or streaming behavior

**Implementation Note**: This is a single-phase change. After automated verification passes, pause for manual confirmation.

## Testing Strategy

### Manual Testing Steps:
1. Navigate to workspace answer page
2. Type a question and press Enter - verify input clears and message appears
3. Click a suggestion prompt - verify input clears and message appears
4. While AI is streaming, try submitting another message - verify it's blocked
5. Submit an empty input (spaces only) - verify nothing happens
6. Type a message, submit, quickly type another - verify both messages send correctly

## Performance Considerations

No performance impact. The change removes one `await` (handleSubmit no longer awaits sendMessage), making form clearing faster and more consistent.

## References

- Research: `thoughts/shared/research/2026-02-08-answer-interface-message-clearing-bug.md`
- Chat interface pattern: `apps/chat/src/app/(chat)/_components/chat-interface.tsx:643-939`
- Answer interface: `apps/console/src/components/answer-interface.tsx:40-79`
- PromptInput reset: `packages/ui/src/components/ai-elements/prompt-input.tsx:539-547`
