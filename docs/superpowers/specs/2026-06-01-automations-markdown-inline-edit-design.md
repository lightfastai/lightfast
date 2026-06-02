# Automations: markdown instructions + inline auto-save — design

**Date:** 2026-06-01
**Status:** Approved (design); pending implementation plan
**Area:** `apps/app` — automations workspace routes

## Summary

Upgrade the automation **instructions** to render as markdown, and convert the
automation **name** and **instructions** editors on the detail page from
popover / Edit-button-toggle interactions to **inline click-to-edit** controls
that **auto-save on blur / ⌘↵**.

The `/new` create form keeps its plain textarea and gains a small "Markdown
supported" hint. The schedule editor is unchanged.

## Key insight: no data-layer change

`prompt` is already a plain `string` (max 4000) in
`packages/app-validation/src/schemas/automations.ts`, and the agent runtime
consumes it as raw text. **Markdown is just text.** Therefore:

- No DB / Drizzle schema change.
- No tRPC procedure change (`automations.update` already accepts `prompt`).
- No runtime change — the agent already receives the raw string.
- No markdown-specific validation; existing plain-text prompts render fine
  (as paragraphs) — fully backward-compatible.

This is purely a **render + edit-UX** change in `apps/app`.

## Decisions

| Decision | Choice |
|---|---|
| Edit interaction | **Click-to-edit toggle** — view shows rendered markdown; click flips to a raw-markdown editor; the view *is* the preview |
| Commit trigger | **Blur** or **⌘↵**; **Esc** reverts |
| Markdown renderer | Existing `Markdown` from `@repo/ui/components/markdown` (react-markdown + remark-gfm) |
| `/new` form | Plain textarea + "Markdown supported" hint; **no** preview |
| Schedule editor | **Out of scope** — keeps its popover |

`Markdown` (react-markdown) is chosen over `Response` (Streamdown): the prompt
is static, not streamed.

## Detailed behavior — detail page

Both editors replace their current UI (name = Popover; instructions = Edit
button + textarea). Both are gated on `org:admin` exactly as today; non-admins
see read-only output with no edit affordance.

| | Name | Instructions |
|---|---|---|
| View state | `<h1>` heading (`font-medium font-pp text-2xl`) | `<Markdown>` rendering `automation.prompt` |
| Hover (admin) | subtle `hover:bg-accent/50` + text cursor | same |
| Edit control | `<Input variant="lf">`, autofocused | auto-sizing `<Textarea variant="lf">`, autofocused, `{len}/{MAX}` counter + "Markdown supported" hint |
| Commit keys | **Enter** or **blur** | **⌘↵** or **blur** (plain Enter inserts a newline) |
| Cancel | **Esc** → revert to last saved | **Esc** → revert to last saved |
| `maxLength` | `AUTOMATION_NAME_MAX_LENGTH` | `AUTOMATION_PROMPT_MAX_LENGTH` |

### Commit rules (both fields)

1. Trim the draft.
2. If the trimmed draft is **empty** or **unchanged**, silently revert to the
   view state — no mutation fired.
3. Otherwise: optimistically update the query cache, flip to the view state
   immediately, and run `automations.update` in the background.
4. On error: revert the cache to the snapshot and surface a toast
   (`meta.errorTitle`).

`maxLength` on the input/textarea prevents over-limit entry, so "too long" is
not a runtime commit path.

### Esc / blur ordering

Pressing **Esc** must cancel *without* the trailing `blur` event also
committing. Implementation captures a "cancel intent" ref that the blur handler
checks before committing.

## Shared structure (targeted cleanup)

Today the name, prompt, and schedule editors each re-implement the same
optimistic `onMutate / onError / onSuccess` against `setOne` / `upsertInList`.
Two small extractions keep the new editors focused and DRY:

- **`use-inline-edit.ts`** (new, headless hook) — owns
  `{ editing, draft, setDraft, begin, inputProps }` plus the blur / keyboard /
  Esc commit logic. A `multiline` flag switches the commit key between
  **Enter** (single-line) and **⌘↵** (multiline). Each editor supplies its own
  render (Input vs Textarea + Markdown) and its own mutation callback.
- **`automationUpdateMutationOptions(qc, trpc, id, { errorTitle })`** — a
  factory in `automations-cache.ts` returning the shared optimistic
  `mutationOptions`, reused by name + prompt (and trivially adoptable by the
  schedule editor later, though not required by this change).

## `/new` create form

Keep the react-hook-form `Textarea` and its char counter unchanged. Add a small
muted "Markdown supported" hint under the **Instructions** label. No preview,
no interaction-model change.

## Non-goals

- Converting the schedule editor.
- Any DB / schema / tRPC / runtime change.
- Markdown-specific validation or sanitization beyond what the renderer does.
- A live-preview or split-pane editor on either route.
- Changing the create-form interaction model.

## Testing

Follow the existing vitest + React Testing Library pattern (mocked `useTRPC`,
`useAuth`, and `@tanstack/react-query`, as in `automations-client.test.tsx`).
New tests for both inline editors cover:

- view ↔ edit toggle on click (admin only)
- commit on blur
- commit on ⌘↵ (instructions) / Enter (name)
- Esc reverts without committing
- empty draft → no-op revert
- unchanged draft → no-op revert
- non-admin → read-only (markdown rendered for instructions; no edit affordance)

## Files touched

- `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/automations/[automationId]/_components/automation-name-editor.tsx` — rewrite to inline
- `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/automations/[automationId]/_components/automation-prompt-editor.tsx` — rewrite to inline + `Markdown`
- `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/automations/[automationId]/_components/use-inline-edit.ts` — **new** headless hook
- `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/automations/_components/automations-cache.ts` — add `automationUpdateMutationOptions` factory
- `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/automations/new/_components/automation-create-form.tsx` — add "Markdown supported" hint
- New test files for the two editors under `apps/app/src/__tests__/...`

## Open questions

None outstanding.
