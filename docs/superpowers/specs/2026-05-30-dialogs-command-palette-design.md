# Linear-Style Dialogs + ⌘K Command Palette Design

## Context

The signal create dialog (`apps/app/.../signals/_components/signal-create-dialog.tsx`)
is a functional but plain modal: a bordered header with a "Create Signal"
title, a single full-height `Textarea` for one raw signal, and a footer with a
character counter and a "Create signal" button. It uses the base `Dialog`
primitive directly, has no shared "dialog chrome," and is mounted **inside the
signals page** (`SignalsClient`), so it can only be opened from the signals
surface.

The user wants two upgrades, modeled on Linear:

1. **Rework the create dialog** into a floating, breadcrumb-headed dialog that
   establishes a **standard look and feel for our dialogs** — without adding
   fields the data model doesn't need (a signal is one raw text blob;
   `kind` / `priority` / `disposition` / `people` are derived automatically by
   the classification pipeline after submit, never set by hand).
2. **Introduce a ⌘K command palette**, available **anywhere in an org**, for
   moving through the app faster (navigation + create).

The repo already ships a styled `command.tsx` (cmdk wrapper: `CommandDialog`,
`CommandInput`, `CommandGroup`, `CommandItem`, `CommandShortcut`, …) that is
**not wired up anywhere yet**. There is no command palette and no global
keyboard-shortcut layer today.

Approved high-fidelity mockups (built with the app's real dark-theme tokens)
live at:
- `.superpowers/brainstorm/28614-1780138798/content/dialog-hero-v2.html`
- `.superpowers/brainstorm/28614-1780138798/content/palette-v2.html`

## Goals

- Rework `SignalCreateDialog` into a **floating Linear-style dialog**: org
  **breadcrumb header** (`avatar + org name › New signal`), a borderless
  single-paste body, and a **footer toolbar** with a **Create more** toggle and
  a white **Create signal** button showing a **⌘↵** hint.
- Extract the dialog chrome into a reusable **app-local `CreateDialogShell`**
  so future dialogs (people, automations) share one canonical look. Built
  app-local now, structured so it can later move to `@repo/ui` unchanged.
- Add a **⌘K command palette** mounted once at the workspace layout so it works
  on **every org page** (signals, people, automations, settings).
  - **Create** group: Create signal.
  - **Go to** group: Signals, People, Automations, Settings.
  - Typing **filters** the command list (cmdk's built-in filter).
- Add a thin **global keyboard layer**: **⌘K** toggles the palette, **C** opens
  the create dialog directly — both ignored while the user is typing in an
  input / textarea / contenteditable.
- Make the signal create dialog **org-wide**: mount it once (not per page) so
  ⌘K / `C` can open it from anywhere, and invalidate the signals list by
  **partial key** after creation.

## Non-Goals

- **No new signal fields / chips.** No status / priority / assignee / label row
  like Linear. Classification stays automatic; the body remains a single raw
  text area.
- **No search backend.** The palette only filters its own static command list;
  it does not query signals/people.
- **No quick-create from typed text** (no "Create signal: ‹text›" action).
- **No `G`-then-`X` navigation chords.** Only ⌘K and `C` are wired in v1; nav
  rows are arrows + enter. (Per-row chord hints are intentionally omitted.)
- **No fullscreen / expand** affordance, **no attachments**, no file/context
  picker.
- **No palette on `/tasks/bind`** (the OAuth binding flow lives outside
  `(workspace)`).
- **No refactor of `team-switcher.tsx`.** `useActiveOrg()` is a new, additive
  hook; the team switcher keeps its current inline logic.
- No backend / API-contract / schema changes. This is UI + client wiring only.

## Visual Reference (approved)

**Create dialog** — floating card, 12px radius (softer than the app's default
4px), elevated shadow:
- **Header**: `[avatar] Lightfast › New signal` on the left, hover-only close
  `✕` on the right. The avatar uses the existing standard — `Avatar` `size-5`,
  `rounded-full`, `bg-foreground` fill with `text-background` initials (same as
  `team-switcher` / `signals-creator-avatar`). **No chip/border** around the
  breadcrumb.
- **Body**: one borderless `Textarea` with the existing placeholder. No
  title/description split.
- **Footer**: left = `0 / 10,000` counter only (no attach icon); right =
  **Create more** toggle + white **Create signal** button with a `⌘↵` hint.

**Command palette** — matches `command.tsx` styling (rounded-2xl shell, ~60px
search row with search icon, rounded-xl items, muted group headings):
- Input placeholder "Type a command or search…".
- **Create** group → `Create signal` (shows `C` shortcut chip).
- **Go to** group → `Signals`, `People`, `Automations`, `Settings`
  (icons: `Signal`, `UsersRound`, `CalendarClock`, `Settings`).
- Footer hint bar: `↑↓ navigate · ↵ select · esc close`.

## Architecture

Two coordinated surfaces, both owned by a single provider mounted in
`apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/layout.tsx`:

```
(workspace)/layout.tsx
  └─ <WorkspaceCommandMenu>            // client provider, mounted once
       ├─ context: { openPalette, openCreateSignal }
       ├─ global keydown: ⌘K → palette, C → create dialog
       ├─ <CommandPalette/>           // ⌘K surface (cmdk)
       └─ <SignalCreateDialog/>       // global create dialog
            └─ <CreateDialogShell/>   // reusable Linear chrome
```

`(workspace)/layout.tsx` wraps signals, people, automations, **and** settings
(all under the `(workspace)` route group), so a single mount = org-wide.

## Components

### A. `useActiveOrg()` — `apps/app/src/hooks/use-active-org.ts` (new)

Returns `{ name: string; initials: string; slug: string } | null` for the
current org. Derived exactly like `team-switcher.tsx`: read the cached
`trpc.viewer.organization.listUserOrganizations` query and match the first path
segment (`usePathname`) against `org.slug`. Returns `null` for account/reserved
routes. Consumed by the dialog breadcrumb. Additive — does not modify the team
switcher.

### B. `CreateDialogShell` — `apps/app/src/components/create-dialog-shell.tsx` (new)

Presentational chrome only (no business logic). The "standard dialog look."

Props:
- `open: boolean`, `onOpenChange: (open: boolean) => void`
- `org: { name: string; initials: string }`
- `title: string` (e.g. `"New signal"`)
- `busy?: boolean` (disables the close button while a mutation runs)
- `footerLeft?: ReactNode`, `footerRight?: ReactNode`
- `description: string` (sr-only `DialogDescription` for a11y)
- `children: ReactNode` (the body)

Renders:
- `DialogContent` with `showCloseButton={false}`, `p-0`, ~12px radius, elevated
  shadow, `sm:max-w-2xl` (~680px), border `border-border`.
- **Header**: `Avatar` (size-5, white fill + initials) + org name + `›` +
  `title`; right-aligned ghost close button (hover-reveal), disabled when
  `busy`. No bottom border.
- **Body**: borderless padded region rendering `children`.
- **Footer**: flex row, `footerLeft` start / `footerRight` end. No top border
  (Linear-style); spacing-only separation.

### C. `SignalCreateDialog` — rewritten to consume `CreateDialogShell`

Keeps all existing behavior except where noted:
- **Preserved**: sessionStorage draft persistence (`readSignalDraft` /
  `writeSignalDraft` / `removeSignalDraft`), `normalizeSignalInput`, the
  `SIGNAL_INPUT_MAX_LENGTH` limit + counter, the `signals.create` mutation with
  `errorTitle` meta and success toast, `autoFocus`.
- **Body**: the existing `Textarea` (borderless, transparent), placeholder
  unchanged.
- **`footerLeft`**: the character counter (`{n} / {limit}` + at/over-limit and
  empty-trim hints), logic unchanged.
- **`footerRight`**: a **Create more** `Switch` + the white **Create signal**
  `Button` with a `⌘↵` keyboard hint. Button disabled when pending / empty /
  over limit.
- **Org**: breadcrumb fed by `useActiveOrg()`; while it resolves, render initials
  placeholder gracefully (no layout shift).

Behavior changes:
- **Submit key**: **⌘/Ctrl + Enter submits**; plain **Enter inserts a newline**
  (better for multiline paste, matches the `⌘↵` hint). Replaces today's
  "Enter submits / Shift+Enter newline."
- **Create more**: local boolean (default off), **persisted in `localStorage`**.
  On success: invalidate, toast, then — if on → clear input + draft, keep open,
  refocus the textarea; if off → close (existing behavior).
- **Global invalidation**: drop the `listQueryKeys` prop. On success, invalidate
  `trpc.org.workspace.signals.list` by **partial key** (no `exact`), covering
  every filtered/infinite list variant from any page.
- **Mounted globally** by the provider, not by `SignalsClient`.

Open state is owned by `WorkspaceCommandMenu` and passed as `open` /
`onOpenChange` (the component stays controlled, as it is today).

### D. `CommandPalette` — `apps/app/src/components/command-palette.tsx` (new)

Uses the existing `CommandDialog` / `CommandInput` / `CommandList` /
`CommandGroup` / `CommandItem` / `CommandShortcut` primitives.

- Props: `open`, `onOpenChange`, `onCreateSignal: () => void`.
- Reads `slug` via `useActiveOrg()` (or `useParams`) and `useRouter` for nav.
- **Create** group → `Create signal` (`CommandShortcut` `C`); selecting it calls
  `onOpenChange(false)` then `onCreateSignal()`.
- **Go to** group → Signals / People / Automations / Settings; selecting routes
  `router.push('/${slug}/<section>')` and closes. Icons:
  `Signal`, `UsersRound`, `CalendarClock`, `Settings`.
- A footer hint bar (`↑↓ navigate · ↵ select · esc close`) rendered under
  `CommandList`.
- Filtering: rely on cmdk's built-in `shouldFilter`.

### E. `WorkspaceCommandMenu` — `apps/app/src/components/workspace-command-menu.tsx` (new)

Client provider mounted once in `(workspace)/layout.tsx`.

- Owns `paletteOpen` and `createSignalOpen` state.
- Renders `<CommandPalette/>` and the global `<SignalCreateDialog/>`.
- Registers a single `window` `keydown` listener:
  - **⌘K / Ctrl+K** → toggle palette (`preventDefault`).
  - **C** (no modifiers) → open create dialog — **ignored** when
    `event.target` is an `input` / `textarea` / `[contenteditable]`, when a
    modifier is held, or when the palette/dialog is already open.
- Exposes `useWorkspaceCommands()` → `{ openPalette, openCreateSignal }` via
  React context.

### Refactors to existing code (focused)

- **`SignalsClient`**: remove local `isCreateDialogOpen` state and the local
  `<SignalCreateDialog>` mount; the toolbar **Add** button and both
  empty-state actions call `useWorkspaceCommands().openCreateSignal()`. Remove
  the `refreshListQueryKeys` plumbing tied to the dialog. Everything else
  (filters, views, detail sheet) is untouched.
- **`(workspace)/layout.tsx`**: wrap `children` with `<WorkspaceCommandMenu>`.

## Data Flow

- **⌘K** (any org page) → provider opens palette → user picks **Go to People**
  → `router.push` + palette closes; **or** picks **Create signal** → palette
  closes → create dialog opens.
- **C** (any org page, not typing) → create dialog opens directly.
- **Create dialog submit (⌘↵)** → `signals.create` mutation → onSuccess:
  toast + invalidate `signals.list` (partial) → if *Create more* off, close;
  if on, clear + stay + refocus.

## Error Handling

- Mutation errors keep the existing path: `meta.errorTitle` +
  toast (handled centrally), dialog stays open, input retained.
- Close button + Esc are disabled / no-op while the mutation is pending
  (existing `busy` guard, now driven through the shell's `busy` prop).
- `useActiveOrg()` returning `null` (slow query / edge route) renders a neutral
  initials placeholder; the dialog never blocks on it.

## Testing

- **Update `signals-client.test.tsx`**: the create dialog is no longer rendered
  by `SignalsClient`. Tests that open it via the Add button now assert the
  click calls the command context (wrap the unit under a test
  `WorkspaceCommandMenu` / mock provider), or move dialog-content assertions to
  a dedicated `SignalCreateDialog` test.
- **New `signal-create-dialog` tests**: ⌘↵ submits and Enter inserts a newline;
  **Create more** on → dialog stays open + input cleared + still mounted;
  Create more off → closes; counter + over-limit states; draft persistence
  round-trip.
- **New `command-palette` tests**: groups render; typing filters; selecting
  "Create signal" closes palette + invokes `onCreateSignal`; selecting a nav
  item routes to the right path.
- **New `workspace-command-menu` tests**: ⌘K toggles palette; `C` opens the
  create dialog; `C` is ignored while focus is in a textarea/input.
- `useActiveOrg` initials/slug resolution is covered indirectly via the dialog
  breadcrumb tests.

## Open Questions

None blocking. Future (explicitly deferred): palette search backend,
quick-create from typed text, `G`-then-`X` chords, fullscreen dialog,
attachments, extracting `CreateDialogShell` to `@repo/ui` once a second dialog
adopts it.
