# Automations rework + Lightfast visual-language seed — Design

Date: 2026-06-01
Status: Approved (design); pending implementation plan
Driver: Rework `automations/page.tsx` (list) and `automations/new/page.tsx` (create form) UI; the work expanded into seeding a custom Lightfast visual language.

## Problem & intent

The automations create form and list pages use stock shadcn primitives at default scale.
The user wants (a) a nicer, more deliberate UI, (b) better react-hook-form integration, and
(c) to stop riding stock shadcn and define **Lightfast's own visual language** — Linear-informed,
precise, technical — proven first on automations, then expanded surface by surface.

This is **not** a full `packages/ui` overhaul. We seed the language (tokens + the handful of
primitives automations needs), restyle stock shadcn with those tokens (no bespoke component
logic), and apply it to the automations surfaces.

## Scope decomposition

Two coupled bodies of work, one spec:

1. **Lightfast visual language v1 (seed)** — tokens + restyled primitives. No Storybook
   (decided): iterate via the running app. Restyle stock shadcn primitives; do not build
   bespoke component mechanics.
2. **Automations rework** — schedule-model backend expansion + the three UI surfaces
   (create form, list, detail editors) built on the seed.

Non-goals: overhauling every `packages/ui` component; redesigning other app surfaces;
adding a `description` field to automations; building a custom segmented time picker
(explicitly rejected — use shadcn-default native time input).

## Decisions locked during brainstorming

| Topic | Decision |
|---|---|
| Direction | Linear-informed / precise / technical |
| Storybook | No — iterate in the running app |
| Reach | Seed language + apply to create form, list page, AND detail editors |
| Create-form surface | Keep full-page route (`/[slug]/automations/new`), not a modal |
| Schedule kinds | Expand to `manual / hourly / daily / weekdays / weekly` |
| Weekly config | Single day per week |
| Manual "no next run" | Make `nextRunAt` nullable (clean semantics) |
| Radius | Soft — `--radius` 9px |
| Labels | Monospace, **no caps**, no tracking, no field-index numbers |
| Accent | Neutral; brand orange reserved (not used in interactions yet) |
| Density / type | Smaller — heading 20px, input text 12.5px, mono labels 11px |
| Input height | 30px |
| Resting input | Fill (`surface-1`) + hairline border (`input-line`) |
| Focus ring ("outline") | **Inset hairline** — `box-shadow: inset 0 0 0 1px ring`, bg→`background` |
| Schedule control | **Underline tabs** (not segmented pill) + sub-control panel below |
| Time input | shadcn-default **native styled `type="time"`** — `appearance-none`, hidden webkit indicator, `bg-background`, mono digits. No custom picker. |
| Day-of-week (weekly) | Styled `Select` |
| Form integration | Keep `Form`/`FormField` (react-hook-form); restyle primitives via tokens |

## 1 · Visual language seed

### Tokens (dark theme; values are the agreed mockup values, to be reconciled with `packages/ui/src/globals.css`)

- Surfaces: `background` oklch(0.2178 0 0), `surface-1`/card oklch(0.2435 0 0), `surface-2` oklch(0.27 0 0)
- Foreground oklch(0.8853 0 0), muted-foreground oklch(0.62 0 0)
- Lines: `hairline` oklch(0.305 0 0), `input-line` oklch(0.34 0 0), `border` oklch(0.329 0 0)
- `ring` oklch(0.72 0 0); brand (reserved) oklch(0.5913 0.2286 31.28)
- Radius: `--radius` 9px (soft). Existing scale maps `rounded-md = radius-2`, `rounded-lg = radius`.
- Type: body 13px; heading 20px/600/-0.02em; input text 12.5px; labels mono 11px; counters/status mono 9.5–10px
- Fonts: sans = system UI; mono = ui-monospace stack (labels, counters, time digits, status lines, kicker/meta)

### Primitives to restyle (the seed)

1. **Input** — h-30px, fill+hairline rest, inset-hairline focus, 12.5px text. New token-driven look (likely a Lightfast variant or restyle of the default).
2. **Textarea** — same skin; min-h ~92px; supports an absolutely-positioned mono character counter (`n/max`).
3. **Label** — mono, no caps, 11px, muted-foreground; required marker is a muted mono `*`.
4. **Tabs (underline)** — restyle existing `tabs.tsx` to the underline idiom: row with bottom hairline, active tab gets a 2px foreground underline (`margin-bottom:-1px`), muted→foreground on hover/active. Sub-control panel sits beneath.
5. **Select** — styled `appearance-none` with chevron bg, inset-hairline focus. Used for day-of-week and timezone.
6. **Button** — h-30px; ghost (cancel) + primary (foreground/white) submit. Confirm primary vs secondary for submit during implementation.

Focus ring is uniform across all controls: resting border unchanged, focus = `background` fill + `inset 0 0 0 1px ring` (no halo, no layout shift). This doubles as the `:focus-visible` keyboard outline (inset hairline meets ~3:1 contrast).

Time input: native `<input type="time">` with `appearance-none`, `bg-background`, `::-webkit-calendar-picker-indicator{display:none}`, mono digits, inset-hairline focus. (The general date case keeps the shadcn `Popover + Calendar` recipe — already vendored via `Calendar`/react-day-picker — but automations needs only time-of-day, so no calendar here.)

## 2 · Schedule-model backend expansion

Today (in `packages/app-validation/src/schemas/automations.ts`, `db/app/src/schema/tables/automations.ts`,
`db/app/src/utils/automations.ts`): a discriminated union of `hourly | daily`, `nextRunAt` is `NOT NULL`,
and `calculateNextRunAt` handles those two kinds. Scheduler (`automation-scheduler.ts`) claims rows via
`status='active' AND nextRunAt <= now` (`claimDueAutomationRuns`); `runNow` fires a manual run independent
of schedule.

### Target model

`scheduleKind` → config (Zod discriminated union, mirrored in DB `$type`s):

| Kind | Config | Runs | nextRunAt |
|---|---|---|---|
| `manual` | `{}` | only via Run now | `null` |
| `hourly` | `{ intervalHours: 1–24 }` | every N hours | as today |
| `daily` | `{ time: "HH:mm" }` | daily at time | as today |
| `weekdays` | `{ time: "HH:mm" }` | Mon–Fri at time | next weekday occurrence |
| `weekly` | `{ dayOfWeek: 0–6, time: "HH:mm" }` | once a week | next that-weekday occurrence |

### Changes required

- **Validation** (`app-validation`): add `manual`, `weekdays`, `weekly` branches; extend
  `formatAutomationSchedule` ("Manual" / "Weekdays at …" / "Weekly on Monday at …"); export day-of-week helper.
- **DB types** (`schema/tables/automations.ts`): widen `AutomationScheduleKind` and `AutomationScheduleConfig`;
  make `nextRunAt` **nullable** (`datetime(...).` drop `.notNull()`). Generated migration only (`pnpm db:generate`);
  follow `db/CLAUDE.md` staging→main deploy pipeline. Indexes on `nextRunAt` remain valid with NULLs.
- **next-run calc** (`utils/automations.ts`): `calculateNextRunAt` returns `Date | null`; `null` for `manual`;
  add `weekdays` (next daily time landing Mon–Fri) and `weekly` (next `dayOfWeek` at time) branches, reusing the
  existing tz-aware `zonedTimeToUtc` helpers. `createAutomation`/`updateAutomation` accept null `nextRunAt`.
- **Scheduler**: `claimDueAutomationRuns`'s `lte(nextRunAt, now)` already excludes NULL — manual never auto-claims.
  Verify no other path assumes non-null `nextRunAt`. `runNow` unaffected.
- **Tests**: extend `automations.test.ts` (validation), `db` automations tests (next-run for each kind + null),
  router tests. Keep TDD per repo norms.

## 3 · UI surfaces (built on the seed)

### Create form — `automations/new/_components/automation-create-form.tsx`
Full-page route. Back link (mono) → list. Heading + lede. Fields via `Form`/`FormField`:
**Name** (input, required), **Instructions** (textarea + mono counter, required), **Schedule**
(underline tabs over the 5 kinds; sub-control panel: manual note / hourly number / daily time /
weekdays time + "Mon–Fri" pill / weekly day-Select + time), **Timezone** (Select; shown only for
time-based kinds). Footer: mono status line + Cancel (ghost) + Create (primary, disabled until valid).
Submit builds the `schedule` discriminated union and calls the existing
`org.workspace.automations.create` mutation; cache upsert unchanged.

### List page — `automations/_components/automations-client.tsx`
Same language: header + "New automation" action, Current/Paused sections, rows showing name +
`formatAutomationSchedule(...)`. Restyle to mono section labels, hairline dividers, inset-ring-consistent
hover. Empty state restyled.

### Detail editors — `[automationId]/_components/*`
Unify name editor, prompt editor, and schedule editor to the same primitives and the underline-tab
schedule control (the schedule editor currently uses a `ToggleGroup` in a `Popover` with only hourly/daily;
it must support all 5 kinds + the new sub-controls + timezone). Right-rail `RailSection` labels already use
uppercase tracked mono — reconcile toward the new mono-no-caps label style for consistency.

## Risks / open items

- **Migration sensitivity**: `nextRunAt` nullability rides the staging→main PlanetScale deploy pipeline
  (`db/CLAUDE.md`); memory notes `db:push` is broken on worktree branches — apply generated migrations per runbook.
- **Token reconciliation**: mockup oklch values are close to `globals.css` but must be reconciled rather than
  duplicated; radius bump (4px→9px) is app-wide via `--radius` and should be sanity-checked against other surfaces,
  or scoped if it regresses them. Resolve during planning.
- **Submit button** primary vs secondary — confirm against list "New automation" button.
- **Native `type="time"`** rendering still varies slightly by OS even when styled; accepted (shadcn-default, user-locked).

## Reference
Interactive mockups (companion, gitignored): `.superpowers/brainstorm/20440-1780281095/content/`
(`05`-smaller-tabgroup, `06`-outline-datetime, `07`-focus-ring, `08`-final-form).
