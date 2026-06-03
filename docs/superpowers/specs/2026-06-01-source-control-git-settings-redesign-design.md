# Source Control & Git settings — UI redesign

**Date:** 2026-06-01
**Surface:** `/[slug]/settings/source-control` (Settings sub-tab)
**Status:** Design approved (mockup + decisions); pending spec review

## Context

The Source Control & Git sub-tab currently renders two stacked blocks from a
single `source-control-connection-section.tsx` (~450 lines):

1. A **"Source control"** `SettingsGroup` — a GitHub-connection row and a
   Lightfast-repository row (`SourceControlSection`).
2. A **"Repositories"** section — a flat `divide-y` list of *every* accessible
   GitHub repo, each tagged imported / not-imported (`SourceControlConnectionSection`).

We are reworking it to the in-app **Connector** card language
(`connectors-client.tsx`) and the account-card pattern from the user's
Connectors / Mail-and-Calendar references: discrete `bg-background` cards,
border-only separation, one box per repository.

## Goals

- Three stacked sections, in order: **Organization → Lightfast repository → Repositories**.
- Card language matches connectors: `bg-background` boxes (no `bg-card`),
  border-only separation, locked Lightfast tokens (`rounded-[8px]`, `h-7`,
  `text-[11px]` mono labels, emerald accents).
- Repositories become **individual cards** (one box each), **imported-only**,
  each expandable to show real per-repo data (**Watched paths**).
- Exactly one small, safe backend change: surface `syncStatus` in the list payload.

## Non-goals

- Editing watched paths — **read-only** this pass.
- Per-repo permissions display — not in the data model; dropped.
- Org disconnect / removal — the binding is a one-time event and immutable;
  surfaced only as a **disabled** control.
- Resolving "Enabled by {name}" — see Open Items.

## Design

### Layout & tokens

- Settings content column. Page header: **"Source Control & Git"**
  (`text-2xl` / 20px, `font-medium`) + subtitle (`text-sm` / 12px,
  `text-muted-foreground`). Sections separated by `space-y-10`.
- Every box: `border border-border bg-background rounded-[8px]`.
- Icon boxes: `border-input bg-background`, rounded; `size-10` for section cards,
  `size-7` for repo rows (matches connectors' `ConnectionStatus` icon).
- Section labels: `font-mono text-[11px] text-muted-foreground`.
- "Connected" / "Verified" accents reuse the existing emerald `StatusBadge` style.

### Bound vs. unbound composition

- **Bound** (active binding): render Organization card + Lightfast repository card
  + Repositories section.
- **Unbound** (no active binding): render the page header + a **single** empty
  state only ("No GitHub organization connected" + "Open setup" →
  `/{slug}/tasks/bind`). The Organization and Lightfast repository cards do **not**
  render — avoids stacking multiple "connect" prompts.

### 1. Organization

- Card: GitHub mark + org login (`binding.accountLogin`) + subtitle, with a
  **"● Connected ⌄"** dropdown trigger (emerald dot) on the right.
- Subtitle: **"Connected on {connectedAt}"** (formatted via existing
  `shortDateFormatter`). See Open Items for "Enabled by {name}".
- Dropdown menu, both items **disabled**: **"Configure in GitHub"** and
  **"Disconnect"**. A **tooltip** on the disabled items reads
  *"Connection is set up once and can't be disconnected."* — no inline hint text.
- Only renders when bound; the unbound case is covered by the Repositories empty state.

### 2. Lightfast repository

- Card: logo mark + `{org}/.lightfast` (mono) + description + status, derived
  from `binding.lightfastRepository`.
- States (always within the bound composition):
  - **Verified** → emerald "Verified" pill + `verifiedAt`.
  - **Unverified** → "Open setup" → `/{slug}/tasks/github/lightfast-repo`.

### 3. Repositories

- Section header: "Repositories" label + **Refresh** (icon button; invalidates
  the `listRepositories` query) + **"+ Add repository"** (opens the existing
  import dialog; disabled for non-admins, on `repositoriesError`, or when unbound).
- List = **imported repos only**: `repositories.filter((r) => r.imported)`
  (`.lightfast` is already excluded by the API). The Add dialog surfaces the
  not-yet-imported repos.
- Repo card header: git-branch icon + `{fullName}` (mono) + **Private/Public**
  badge + **sync-status** indicator (`enabled` / `disabled`) + **"Watched paths"**
  expand toggle + **⋯ menu** → **"Open on GitHub"** (`https://github.com/{fullName}`).
- Expanded body — **"Watched paths"** from `watchedPathGlobs`:
  - `null` → "No watched paths configured".
  - array containing `**` (`SOURCE_CONTROL_ALL_PATHS_GLOB`) → "all paths".
  - otherwise → one mono chip per glob.
- **Error** state (bound but list failed): render `repositoriesError.message`
  (e.g. installation metadata refresh failure / account mismatch) in the existing
  destructive block, in place of the card list.
- **No imported repos** (bound, list OK, nothing imported yet): a quiet inline
  prompt — "No repositories added yet. Use **Add repository** to connect one."

## Backend change (single, approved)

`api/app/src/services/github/source-control/repositories.ts`:

- Add `syncStatus: SourceControlRepositorySyncStatus` to `SourceControlRepositoryRow`.
- In `buildSourceControlRepositoryResponse`, map `watched?.syncStatus ?? "disabled"`.

Not-imported repos have no watched row; the imported-only filter guarantees every
rendered card has a real `syncStatus`. No schema change — the column already exists
on `lightfast_source_control_repositories`.

## Component structure (frontend)

Split the current single file into focused units under
`settings/source-control/_components/`:

- `source-control-settings-client.tsx` — orchestrates the two suspense queries
  (`get`, `listRepositories`) + page header + section layout.
- `organization-card.tsx` — org card, disabled dropdown, tooltip.
- `lightfast-repository-card.tsx` — verified / unverified / unbound states.
- `repository-list.tsx` — section header (Refresh + Add), imported-only map,
  empty + error states.
- `repository-card.tsx` — single repo card, expandable watched paths, sync status,
  ⋯ menu.
- `add-repository-dialog.tsx` — the existing import search/select dialog, extracted
  intact (search, filter, select, `importRepository` mutation, list cache update).

Remove the old `SourceControlSection` + `SourceControlConnectionSection` exports.
Keep the shared `settings-section.tsx` (`SettingsGroup` / `SettingRow`) — still used
by the General settings client.

## Testing

- Component tests per new card:
  - `organization-card` — disabled dropdown items + tooltip present; emerald
    Connected status.
  - `lightfast-repository-card` — verified / unverified / unbound branches.
  - `repository-card` — watched-paths states (null / `**` / specific globs),
    sync-status indicator, Open-on-GitHub href.
  - `add-repository-dialog` — import flow preserved (search, select, mutate,
    cache update, admin gating).
  - `repository-list` — imported-only filtering; empty + error states.
- Client test: renders the three sections; runs both suspense queries.
- API: `repositories` service test asserts `syncStatus` mapping; router test
  covers the imported-only-relevant fields.
- Rework existing `settings-source-control-connection-section.test.tsx` and
  `settings-source-control-client.test.tsx` to the new component structure.

## Open items (decide at review)

- **Org "Enabled by {name}":** the mockup showed "Enabled by Jeevan Pillay". The
  binding exposes `connectedByUserId` (a Clerk user id) and `connectedAt`, but not
  a display name — rendering the name needs a Clerk user lookup (extra backend).
  **Default in this spec:** show **"Connected on {connectedAt}"** using available
  data. Promote to "Enabled by {name}" only if the lookup is worth it.
