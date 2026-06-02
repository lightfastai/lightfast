# Account settings: connector-style General + new "Source Control & Git" route

**Date:** 2026-06-01
**Status:** Approved (brainstorm)
**Scope:** `apps/app` — account-level settings under `(app)/(pending-allowed)/account/settings`

## Problem

The account-level settings (`/account/settings/general`) predate the recent workspace
settings redesign. The General page is a single stacked component using large `text-xl`
headings, full-width inputs, and an inline "GitHub account" block. Meanwhile the workspace
settings (`[slug]/(workspace)/(manage)/settings`) were reworked into a connector-style
system: a left sidebar with discrete routes, compact `SettingsGroup`/`SettingRow`
primitives, and connector cards (e.g. `OrganizationCard` for the GitHub org connection).

Two gaps:

1. The personal GitHub identity lives inline on the General page, instead of in a dedicated
   "Source Control & Git" area like the workspace has.
2. The General page visual language is inconsistent with the workspace settings.

## Goals

- Move the personal GitHub connection out of General into a **new account-level
  `Source Control & Git` route**, mirroring the workspace settings structure exactly.
- Render that connection as a **connector card** matching the workspace `OrganizationCard`.
- **Upgrade the General page** to the workspace `SettingsGroup`/`SettingRow` pattern.
- Keep behavior parity: the only real action today is routing to the GitHub setup task.

## Non-goals

- Wiring an editable display name (no mutation exists today; stays read-only).
- Wiring a real GitHub disconnect flow (the `viewer.githubAccount.disconnect` mutation
  exists but is intentionally left as a disabled menu item to match the workspace card).
- Any change to the GitHub user-account binding services or tRPC routers.

## Decisions (resolved during brainstorm)

| Decision | Choice |
| --- | --- |
| Structure of "Source Control & Git" | **Separate sidebar route** (`account/settings/source-control`), mirroring the workspace layout. |
| GitHub connection visual style | **Connector card** (workspace `OrganizationCard` look): icon tile + `github:{providerUserId}` + "Connected on {date}" + "● Connected ▾" pill. |
| Disconnect action | **Disabled** menu item with workspace-style tooltip. Only "View GitHub setup" is enabled. |
| `SettingsGroup`/`SettingRow` primitives | **Promote to shared** `apps/app/src/components/settings-section.tsx` (beside `settings-sidebar.tsx`); update the workspace import. |

## Architecture

### Existing reference points

- Workspace layout sidebar: `[slug]/(workspace)/(manage)/settings/layout.tsx`
  (`{ name: "Source Control & Git", path: "source-control" }`).
- Workspace source-control page: `.../settings/source-control/page.tsx` prefetches
  `org.settings.sourceControl.*` then renders `SourceControlSettingsClient`.
- Connector card: `.../source-control/_components/organization-card.tsx` (`OrganizationCard`).
- Row primitives: `.../settings/_components/settings-section.tsx` (`SettingsGroup`, `SettingRow`).
- Account GitHub data: `trpc.viewer.githubAccount.status` →
  `{ account: null | { provider: "github", providerUserId, connectedAt, status: "active", accessTokenExpiresAt, refreshTokenExpiresAt } }`.
- Setup task route: `/account/tasks/github`.

### Components & files

**1. Promote shared row primitives**
- New: `apps/app/src/components/settings-section.tsx` — move `SettingsGroup` + `SettingRow`
  verbatim from the workspace `_components/settings-section.tsx`.
- Update `team-general-settings-client.tsx` import to the shared path.
- Delete the workspace `_components/settings-section.tsx`.

**2. Account settings layout** (`account/settings/layout.tsx`)
- Add sidebar item `{ name: "Source Control & Git", path: "source-control" }` after General.
- Add `max-w-4xl` to the main content wrapper to match the workspace content column.
- Leave the `Your Account` header markup (`pt-2 pb-8`, `pl-3`) unchanged — layout tests
  assert on it.

**3. General page upgrade**
- `general/_components/profile-data-display.tsx`:
  - Header: `<h2 className="font-medium font-pp text-foreground text-xl">General</h2>` +
    muted description.
  - `SettingsGroup title="Profile"` with `SettingRow`s:
    - **Avatar** → `Avatar size-7` with initials fallback.
    - **Display Name** → `Input size="lf" variant="lf"` width-capped, `disabled` (read-only).
    - **Email** → `Input` `disabled` (read-only).
  - Remove the `<GithubAccountConnectionSection />` render and import.
- `general/page.tsx`: drop the `trpc.viewer.githubAccount.status` prefetch; keep
  `trpc.viewer.account.get`.
- Delete `general/_components/github-account-connection-section.tsx` (moved/replaced).

**4. New Source Control & Git route**
- `account/settings/source-control/page.tsx`: `prefetch(trpc.viewer.githubAccount.status...)`
  inside `HydrateClient`, render `<AccountSourceControlClient />`.
- `account/settings/source-control/_components/account-source-control-client.tsx`:
  - `useSuspenseQuery(trpc.viewer.githubAccount.status...)`.
  - Header `"Source Control & Git"` + description (personal GitHub identity copy).
  - Connected → `<GithubAccountCard account={account} />`.
  - Not connected → empty-state card mirroring the workspace empty state, with a
    "Connect GitHub account" button → `/account/tasks/github`.
- `account/settings/source-control/_components/github-account-card.tsx` (`GithubAccountCard`):
  - Mirrors `OrganizationCard`: icon tile (`Icons.github`), title `github:{providerUserId}`,
    subtitle `Connected on {connectedAt}`, and a `DropdownMenu` trigger
    `"● Connected ▾"`.
  - Dropdown: enabled **"View GitHub setup"** (`Link` → `/account/tasks/github`), disabled
    **"Disconnect"** with tooltip `"Connection is managed from the GitHub setup task."`
  - Local short-date helper (`Intl.DateTimeFormat`) — the workspace `source-control-format.ts`
    is route-local and not imported across the route tree.

### Data flow

```
account/settings/source-control/page.tsx
  prefetch viewer.githubAccount.status  ── HydrateClient ──▶ AccountSourceControlClient
                                                              useSuspenseQuery(status)
                                              account ? GithubAccountCard : EmptyState
```

No new server code. `page.tsx` for General drops one prefetch; the source-control page adds
the same prefetch. The `viewer.githubAccount.status` query options key is unchanged
(`[["viewer","githubAccount","status"]]`).

### Error / empty handling

- Not connected (`account === null`): empty-state card + "Connect GitHub account" CTA.
- Connected: connector card. The disabled "Disconnect" item carries an explanatory tooltip.
- Loading: page uses the existing prefetch + `HydrateClient` pattern; no spinner needed
  (the workspace source-control page has no extra Suspense boundary either).

## Testing

- **`__tests__/.../account/settings-layout.test.tsx`** — update the
  "setup-only pass" expectation: assert the sidebar now shows "Source Control & Git"
  alongside "General". Keep the existing header (`pl-3`, `pt-2 pb-8`) assertions.
- **`__tests__/.../account/settings-general-github-section.test.tsx`** — split:
  - General: `profile-data-display` renders Avatar/Display Name/Email and **no** GitHub
    section; `general/page.tsx` prefetches only `viewer.account.get`.
  - New `account/settings-source-control.test.tsx`: the source-control page prefetches
    `viewer.githubAccount.status`; `GithubAccountCard` shows `github:{id}` + "Connected"
    when connected and an enabled "View GitHub setup" link; empty state shows
    "Connect GitHub account" when `account === null`.
- Run `pnpm --filter @lightfast/app test` (or the app's test command) plus `pnpm typecheck`.

## Risks / notes

- Promoting `settings-section.tsx` touches one workspace import. Low risk; verified the only
  importer is `team-general-settings-client.tsx`.
- Layout test asserts absence of literal text "GitHub"; the new sidebar label is
  "Source Control & Git" (no standalone "GitHub" text node), so the assertion needs updating
  to reflect intent but won't false-fail.
