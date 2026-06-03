# Chat UI redesign — ChatGPT-shaped

**Date:** 2026-06-03
**Status:** Approved (design), pending implementation plan
**Area:** `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/_components/workspace-assistant-client.tsx`

## Context

The workspace assistant chat already borrows from ChatGPT (max-w-3xl column, user bubbles, full-width assistant turns, a rounded pill composer). Three structural gaps remain:

1. The empty / new-chat state stacks the greeting and skill cards near the top while the composer is pinned to the bottom. ChatGPT centers the composer with a greeting above it.
2. There is no per-message action affordance (copy, etc.).
3. The composer footer-left is empty but undecided.

This redesign closes those gaps with a deliberately minimal scope.

## Goal

Make the chat read like chatgpt.com without expanding feature surface: center the empty state, add a hover-reveal **copy** action, and keep the composer minimal. No backend, transport, or sidebar changes.

## Decisions

| Area | Choice | Notes |
| --- | --- | --- |
| Empty state | **Centered composer + skill cards** | Greeting → composer → tabs → skill cards, vertically centered |
| Conversation actions | **Hover-reveal, copy only** | Both user and assistant turns; no feedback / regenerate / read-aloud / edit |
| Composer | **Minimal — send only** | Nothing in footer-left; send-button states unchanged |
| Empty-state greeting | Keep **"Ready when you are."** | Existing copy retained |
| Empty-state skills | Keep **Recent / Explore tabs** | Existing discovery behavior, restyled into the centered column |

## Design

### 1. Layout swap in `WorkspaceAssistantClient`

The `<main>` chooses one of two layouts on `hasMessages`. The composer is the same `ChatComposer` element in both; it is placed once per branch.

```
<main className="flex h-full min-h-0 flex-1 flex-col bg-background text-foreground">
  {hasMessages ? (
    <>
      <div className="relative min-h-0 flex-1">
        <Conversation> … messages … </Conversation>
      </div>
      <div className="shrink-0 px-4 pb-5 md:px-8">{composer}</div>
    </>
  ) : (
    <div className="relative min-h-0 flex-1 overflow-y-auto">
      <EmptyChatState composer={composer} … />
    </div>
  )}
</main>
```

- Define `const composer = <ChatComposer … />` once and render it in whichever branch is active.
- The transition from empty → active is a plain conditional swap. No animation in this iteration.

### 2. `EmptyChatState` — centered column

`EmptyChatState` takes a new `composer: React.ReactNode` prop and renders a vertically + horizontally centered column (`max-w-3xl`, `mx-auto`, `justify-center`) in this order:

1. Greeting — **"Ready when you are."** (existing styling).
2. `{composer}`.
3. Recent / Explore `Tabs` (existing).
4. Skill suggestion cards (existing `skills.list` data, existing card markup).

On short viewports the column scrolls (the parent wrapper owns `overflow-y-auto`); on tall viewports it stays centered.

### 3. Conversation — copy action

Add a hover-reveal action row to each turn. Drive visibility with a `group` class on the `Message` wrapper and `opacity-0 group-hover:opacity-100` on the row.

- **Assistant:** row sits under `MessageContent`, left-aligned.
- **User:** row sits under the bubble, right-aligned.
- The only control is **Copy**.

Introduce a small reusable `CopyButton`:

- Props: the text to copy (or a `getText()` returning it).
- Behavior: `navigator.clipboard.writeText(text)`, then show a check icon for ~1.5s before reverting to the copy icon. Manages its own `copied` state + timeout; cleans the timeout on unmount.
- Icon-only, muted, matches the existing icon-button sizing used elsewhere in the file.

Copy text is the concatenation of the message's visible **text** parts (`part.type === "text"`), joined with newlines. Non-text parts (reasoning, tool, source, file) are excluded.

### 4. Composer — unchanged, kept minimal

`ChatComposer` already renders textarea + footer with the submit on the right. For **option A** the footer-left stays empty: keep `PromptInputTools` rendering nothing so `PromptInputFooter`'s `justify-between` continues to push `PromptInputSubmit` to the right. Send-button states (idle/disabled → ready → generating/stop) are already handled by `PromptInputSubmit` + `composerStatus`; no change.

## Component boundaries

- `WorkspaceAssistantClient` — owns the empty/active branch and builds the single `composer` element.
- `EmptyChatState` — pure presentational; receives `composer` and renders the centered column. No knowledge of chat state.
- `CopyButton` — self-contained; given text, owns its copied/timeout state. Reusable for both user and assistant rows.
- `ChatComposer`, `WorkspaceAssistantMessagePart` — unchanged.

## Out of scope

- Sidebar (already reworked).
- `/api/chat` transport, conversation tRPC plumbing, message persistence.
- Reasoning / tool / source / file part rendering.
- Feedback, regenerate, read-aloud, edit, attach, skills-in-composer.
- Empty → active transition animation.

## Testing

- `CopyButton`: clicking copies the provided text (mock `navigator.clipboard.writeText`) and toggles to the check state, then reverts.
- `EmptyChatState`: renders the greeting, the passed-in composer, the Recent/Explore tabs, and skill cards in that order.
- `WorkspaceAssistantClient`: empty state renders the centered composer (no bottom bar); once messages exist, the composer renders in the bottom bar and each turn exposes a copy control on hover (presence in DOM; hover opacity is CSS-only).
- Keep existing tests green; follow the existing vitest + Testing Library patterns in `apps/app/src/__tests__`.

## Open questions

None — both empty-state defaults (greeting copy, keep tabs) were confirmed during design.
