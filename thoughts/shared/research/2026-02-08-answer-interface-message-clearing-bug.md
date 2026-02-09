---
date: 2026-02-08 16:25:05 +1100
researcher: jeevanpillay
git_commit: 342b8a5a347beb26a8056e066250898c34bcdc68
branch: main
repository: lightfast
topic: "Bug in answer-interface.tsx where messages sometimes don't clear after being sent"
tags: [research, codebase, answer-interface, prompt-input, message-clearing, race-condition]
status: complete
last_updated: 2026-02-08
last_updated_by: jeevanpillay
---

# Research: Answer Interface Message Clearing Bug

**Date**: 2026-02-08 16:25:05 +1100
**Researcher**: jeevanpillay
**Git Commit**: 342b8a5a347beb26a8056e066250898c34bcdc68
**Branch**: main
**Repository**: lightfast

## Research Question

Investigate weird bug in `apps/console/src/components/answer-interface.tsx` where entering messages sometimes doesn't clear the message after being sent.

## Summary

The message clearing behavior in `answer-interface.tsx` has two different async patterns that may cause inconsistent clearing:

1. **handleSubmit** (lines 40-61): Uses `await sendMessage()` - clears **after** message sends
2. **handleSuggestionClick** (lines 63-79): Uses fire-and-forget `sendMessage().catch()` - clears **immediately**

The bug likely manifests in the `handleSuggestionClick` path where the form is cleared synchronously on the same tick as sendMessage fires, creating a timing window where user interaction could interfere.

## Detailed Findings

### 1. Message Clearing Flow in answer-interface.tsx

Located at: `apps/console/src/components/answer-interface.tsx:40-79`

#### handleSubmit Pattern (Sequential - Lines 40-61)

```typescript
const handleSubmit = useCallback(
  async (promptMessage: PromptInputMessage) => {
    const text = promptMessage.text?.trim();
    if (!text) return;

    const userMessage: UIMessage = {
      role: "user",
      parts: [{ type: "text", text }],
      id: crypto.randomUUID(),
    };

    try {
      await sendMessage(userMessage);  // Line 52: Waits for completion
    } catch (error: unknown) {
      console.error("Failed to send message:", error);
    }

    // Clear the input form
    formRef.current?.reset();  // Line 58: Clears AFTER sendMessage completes
  },
  [sendMessage],
);
```

**Timing**: Form clears **after** async sendMessage completes (success or error). User cannot type during send due to loading state.

#### handleSuggestionClick Pattern (Fire-and-forget - Lines 63-79)

```typescript
const handleSuggestionClick = useCallback(
  (prompt: string) => {
    const userMessage: UIMessage = {
      role: "user",
      parts: [{ type: "text", text: prompt }],
      id: crypto.randomUUID(),
    };

    sendMessage(userMessage).catch((error: unknown) => {  // Line 71: No await
      console.error("Failed to send message:", error);
    });

    // Clear the input form
    formRef.current?.reset();  // Line 76: Clears IMMEDIATELY (same tick)
  },
  [sendMessage],
);
```

**Timing**: Form clears **immediately** on same execution tick. sendMessage runs in background without waiting.

**Potential Issue**: If user starts typing between the immediate clear and the message being queued, that text could remain.

### 2. PromptInput Reset Mechanism

Located at: `packages/ui/src/components/ai-elements/prompt-input.tsx:539-547`

#### Reset Implementation

```typescript
useImperativeHandle(ref, () => ({
  form: formRef.current,
  clear,
  reset: () => {
    formRef.current?.reset();  // Line 544: Native form reset
    clear();                    // Line 545: Clear attachments
  },
}), [clear]);
```

**What reset() does**:
1. Calls native HTML `form.reset()` - resets all inputs to default values
2. Calls `clear()` - removes attachments and revokes object URLs

#### Clear Implementation (Lines 521-537)

```typescript
const clear = useCallback(
  (options?: { revokeObjectURLs?: boolean }) => {
    const shouldRevoke = options?.revokeObjectURLs ?? true;
    setItems((prev) => {
      if (shouldRevoke) {
        for (const file of prev) {
          revokeObjectURL(file.url);  // Cleanup blob URLs
        }
      }
      return [];  // Empty attachments array
    });
    if (inputRef.current) {
      inputRef.current.value = "";  // Clear file input
    }
  },
  [],
);
```

**Execution**:
- `formRef.current?.reset()` - synchronous DOM operation
- `setItems()` - schedules async React state update
- File input cleared synchronously

### 3. Similar Patterns in Codebase

#### Chat Interface Pattern (Conditional Reset)

Located at: `apps/chat/src/app/(chat)/_components/chat-interface.tsx:872-939`

```typescript
const handlePromptSubmit = async (
  message: PromptInputMessage,
  event: FormEvent<HTMLFormElement>,
): Promise<void> => {
  event.preventDefault();

  // Validation for pending uploads
  if (hasAttachments && message.attachments) {
    const unresolved = findUnresolvedAttachment(message.attachments);
    if (unresolved) {
      toast.error("Upload in progress");
      return; // Exit early - form stays intact
    }
  }

  // Send message - returns true if validation passed
  const success = handleSendMessage(message);

  // Clear form only if message was successfully queued
  if (success && formRef.current) {
    formRef.current.reset();
  }
};
```

**Key difference**: Conditional reset based on validation success. Form stays populated on failure for retry.

### 4. useChat Hook Integration

Located at: `core/ai-sdk/src/core/v2/react/use-chat.ts`

The `useChat` hook from `@ai-sdk/react@2.0.15` provides:
- `sendMessage: (message?: CreateUIMessage, options?: ChatRequestOptions) => Promise<void>`
- Returns Promise that resolves when message sent to transport
- Updates `messages` and `status` state asynchronously as response streams

#### Transport Configuration

Located at: `apps/console/src/ai/hooks/use-answer-transport.ts:13-30`

```typescript
return new DefaultChatTransport({
  api: `/v1/answer/answer-v1/${sessionId}`,
  headers: {
    "Content-Type": "application/json",
    "X-Workspace-ID": workspaceId,
  },
  prepareSendMessagesRequest: ({ body, headers, messages, api }) => ({
    api,
    headers,
    body: {
      messages: messages.length > 0 ? [messages[messages.length - 1]] : [],
      ...body,
    },
  }),
});
```

**Optimization**: Only sends last message, not full history.

## Code References

- `apps/console/src/components/answer-interface.tsx:40-61` - handleSubmit with await
- `apps/console/src/components/answer-interface.tsx:63-79` - handleSuggestionClick fire-and-forget
- `packages/ui/src/components/ai-elements/prompt-input.tsx:543-546` - reset() implementation
- `packages/ui/src/components/ai-elements/prompt-input.tsx:521-537` - clear() implementation
- `apps/console/src/ai/hooks/use-answer-transport.ts:14-29` - transport configuration
- `apps/chat/src/app/(chat)/_components/chat-interface.tsx:872-939` - chat interface conditional reset pattern

## Architecture Documentation

### Current Implementation

**Uncontrolled Form Pattern**:
- Textarea has no `value` prop, only `name="message"` (`prompt-input.tsx:759`)
- Form submit reads value directly from DOM: `event.currentTarget.message.value`
- Reset clears DOM state via native `form.reset()`
- No React state synchronization for input value

**Imperative Handle Pattern**:
- Parent (answer-interface) holds ref to PromptInput
- Ref exposes: `form`, `clear`, `reset`
- Parent controls when clearing happens
- Child (PromptInput) doesn't auto-clear on submit

**Two Async Patterns**:
1. **Sequential** (handleSubmit): await → clear after completion → consistent behavior
2. **Fire-and-forget** (handleSuggestionClick): immediate clear → potential race condition

### State Flow

#### handleSubmit Flow (Sequential):
1. User submits form
2. `await sendMessage(userMessage)` at line 52
3. sendMessage triggers HTTP POST to `/v1/answer/answer-v1/${sessionId}`
4. Promise resolves/rejects
5. `formRef.current?.reset()` at line 58
6. Form clears, attachments cleared

#### handleSuggestionClick Flow (Concurrent):
1. User clicks suggestion
2. `sendMessage(userMessage).catch(...)` at line 71 (no await)
3. `formRef.current?.reset()` at line 76 (same tick)
4. Form clears immediately
5. sendMessage continues in background

**Potential Race Condition**:
- If user interaction occurs between immediate clear (line 76) and message queue
- User could type new text while previous message still sending
- New text would remain in input after clear completes

## Related Research

- Similar pattern analysis in chat interface: conditional reset based on validation
- PromptInput component design: imperative handle for parent control
- useChat hook integration: async state management

## Open Questions

1. **Reproducibility**: Under what specific conditions does the bug manifest?
   - High network latency scenarios?
   - Rapid user interactions?
   - Specific browser/device combinations?

2. **User Impact**: How frequently does this occur in production?
   - Are there metrics/logs showing failed clears?
   - User reports or support tickets?

3. **Intended Behavior**: Should suggestion clicks wait for send completion before clearing?
   - Current design: instant feedback (clear immediately)
   - Alternative: wait for send (consistent with handleSubmit)

4. **State Consistency**: Are there other async operations that could interfere?
   - Attachment uploads?
   - Session initialization?
   - Transport reconnection?
