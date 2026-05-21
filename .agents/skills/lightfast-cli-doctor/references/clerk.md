# `clerk` — doctor playbook

## What Lightfast uses it for

- The `lightfast-clerk` skill (`.agents/skills/lightfast-clerk/`) shells into `clerk` for app linking and the bundled `clerk skill install` flow.
- `clerk doctor` is the Clerk-team-owned health check for a developer's Clerk app config — distinct from this doctor.
- Human ops (provisioning test users, viewing tenants) use the global install.

## Probe (read-only)

- **Installed (global)**: `command -v clerk` → green when exit 0. **Probe the GLOBAL install**, not the npx-resolved one. See gotcha below.
- **Version**: `clerk --version` → green when ≥ `1.2.0` (verified on the known-good host as of 2026-05-14).
- **Authed**: `clerk whoami` → green when stdout is a single line containing an `@`-prefixed email.

(No mandatory org probe at the doctor layer. `clerk apps list` + `clerk link` are deferred to per-app workspace bootstrap, which is v2.)

## Install (only when "installed" probe fails)

- macOS: `brew install clerk/tap/clerk` (Clerk maintains its own tap).
- Linux: see https://clerk.com/docs/cli — typically a shell-script installer that drops the binary in `~/.local/bin/`.

After install, re-run the *installed* probe.

## Login (only when "authed" probe fails)

```
clerk auth login
```

Opens the browser for sign-in.

**Non-TTY behavior (verified 2026-05-14)**: `clerk auth login --help` at v1.2.0 documents only the browser sign-in flow — no `--token`, `--api-key`, or `--device-code` flag. The flow MAY work under Claude Code's `!` prefix if the CLI device-codes; if it errors `requires an interactive shell` (the pscale pattern), instruct the user to run `clerk auth login` in a separate terminal window.

After login, re-run the *authed* probe.

## Set org / app context

Not in v1 doctor scope. If a user explicitly asks "link the current app to my Clerk app," run `clerk apps list` to show the options, then `clerk link` from the app directory. Otherwise host-level auth is sufficient.

## Upgrade (only when version below recorded minimum, or user requests upgrade)

The Clerk CLI ships its own self-update:

```
clerk update --all --yes
```

`--all` is mandatory if `which -a clerk` shows more than one binary on PATH (common when both fnm-managed and brew-managed installs coexist). `--yes` skips the confirmation prompt.

## Known gotchas

- **`clerk --version` can stall for ~5+ seconds on cold start** while the JS launcher boots the platform-specific binary (`@clerk/cli-darwin-arm64/bin/clerk`). Observed 2026-05-14: an agent harness ran `clerk --version` and the subprocess was still alive 60s later in `ps`. Workaround: wrap with a manual timeout when probing (`(clerk --version & PID=$!; (sleep 8; kill -9 $PID) & wait $PID)`), or accept the cold-start latency. Warm runs return in <1s.
- **The Clerk invocation path in this repo is global.** The `lightfast-clerk`
  skill and human ops use the globally installed `clerk`; the doctor probes
  that install because it is the shared host-level dependency.
- **`clerk update` updates only the first `clerk` on PATH** unless `--all` is passed. If the user has both fnm and brew installs, the one not on PATH first will silently drift.
- **`clerk auth login` opens the browser via the system default browser**, not the Lightfast Dia-aware path. Devs running this doctor inside an `lightfast-desktop-signin` agent flow should not be — that skill has its own Clerk auth model.
