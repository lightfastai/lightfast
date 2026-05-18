# `sentry` — doctor playbook

This is the **v0.32+ Sentry agent CLI**, distinct from the legacy `@sentry/cli` npm package. The legacy CLI gap (`apps/desktop/scripts/upload-sourcemaps.mjs` calling `pnpm exec sentry-cli` against a missing dep) is explicitly out of v1 scope — see SKILL.md *What this skill does NOT do*.

## What Lightfast uses it for

- Issue triage from the terminal (`sentry issue list`, `sentry event view`).
- Source map upload context (`sentry sourcemap upload` — the agent CLI's native path, not the legacy one).
- Org-scoped operations land against the `lightfast` slug.

## Probe (read-only)

- **Installed**: `command -v sentry` → green when exit 0.
- **Version**: `sentry --version` → green when ≥ `0.32.0` (verified on the known-good host as of 2026-05-14).
- **Authed**: `sentry --json whoami` → green when stdout parses as JSON with non-empty `email`. Use `--json` in agent harness — the human-readable output is harder to parse and changes between versions.
- **Org context**: `sentry org list` → green when stdout includes a row with slug `lightfast`. To verify which org is the *default*, `sentry org view` (no slug arg) returns the current default's details.

## Install (only when "installed" probe fails)

- macOS / Linux: per https://docs.sentry.io/product/cli/installation — typically a shell installer that drops the binary in `~/.local/bin/`. The legacy `brew install getsentry/tools/sentry-cli` is the *old* CLI; don't use it.

After install, re-run the *installed* probe.

## Login (only when "authed" probe fails)

```
sentry auth login
```

Device-code OAuth — prints a code + URL, waits for the callback. Because device-code reads stdin only for the timeout-confirmation step, this flow works under Claude Code's `!` shell prefix (output streams in; user opens the printed URL in a separate browser).

**Non-TTY alternatives (verified 2026-05-14)**:

```
sentry auth login --token <api-token>   # skip OAuth entirely; uses a pre-minted token
sentry auth login --json                # JSON output (parseable in agent harness)
sentry auth login --timeout 1800        # override default 900s OAuth timeout
```

For headless automation, set `--token` or the `SENTRY_AUTH_TOKEN` env var. For developer onboarding, the bare `! sentry auth login` works.

After login, re-run the *authed* probe with `--json` for clean parsing.

If the token has expired but the auth flow is otherwise functional:

```
sentry auth refresh
```

## Set org (when org probe shows the wrong default)

The Sentry agent CLI v0.32 uses `sentry org list` to enumerate and `sentry org view <slug>` to focus a single org. There is no `sentry org switch` subcommand at v0.32 — the *default* org is determined by the user's Sentry profile / API token scope, not a local config. If `sentry org view` returns a non-lightfast default, the fix is:

1. In the browser, switch to the `lightfast` org via the Sentry dashboard (top-left org picker).
2. `sentry auth refresh` to pull the updated default.
3. Re-run the org probe.

(If a future CLI version adds `sentry config set-default-org`, update this playbook.)

## Upgrade (only when version below recorded minimum, or user requests upgrade)

```
sentry cli upgrade --check    # report latest vs current, do not install
sentry cli upgrade            # install latest stable
```

Built-in self-update subcommand under the `sentry cli` group. `--check` is non-destructive — useful as an upgrade-available probe before deciding to commit. Verified live 2026-05-14: 0.32.0 → 0.33.0 upgrade preserves auth state (no re-login needed). After upgrade, re-run the *version* probe.

## Known gotchas

- **`sentry login` (without `auth` prefix) errors with "Did you mean: log?"** — easy to misremember. Always use the full path: `sentry auth login`, `sentry auth status`, `sentry auth whoami`.
- **`--json` is critical in an agent harness.** The default `sentry … whoami` output is human-formatted (tables, colors). `--json` returns parseable JSON on stdout; pair it with `jq` in scripts.
- **`sentry cli` group is the self-management group.** Don't confuse `sentry cli upgrade` with a "Sentry CLI command runner" — `sentry cli defaults | feedback | fix | setup | upgrade` are operations on the binary itself.
- **The agent CLI is distinct from legacy `@sentry/cli`.** If someone says "the Sentry CLI" they may mean either. The doctor probes the agent CLI; the legacy one is a separate (out-of-v1-scope) gap tracked in SKILL.md.
- **Sentry org quota state is invisible from this CLI.** If the org is over its free-tier quota (as recorded in [[project_sentry_quota]]), events transport from clients but the issues stream is closed and the dashboard shows zero new issues. The doctor cannot detect this; it's a billing-state concern.
