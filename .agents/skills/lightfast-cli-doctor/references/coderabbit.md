# `coderabbit` — doctor playbook

## What Lightfast uses it for

- PR review automation, configured via `.coderabbit.yaml` at the repo root.
- Local pre-PR review via `coderabbit review` (CLI-driven, no PR needed).
- Org `lightfastai` (verified live on 2026-05-14 — the host shows the user authed against this org with 2 orgs available).

## Probe (read-only)

- **Installed**: `command -v coderabbit` → green when exit 0.
- **Version**: `coderabbit --version` → green when ≥ `0.4.5` (verified on the known-good host as of 2026-05-14).
- **Authed**: `coderabbit auth status` exits 0 AND the **post-ANSI** output contains `Authentication: Logged in`. See ANSI gotcha below for parsing.
- **Org context**: same `coderabbit auth status` output contains `Name: lightfastai` under the `Organization Information:` block.

## Parsing `coderabbit auth status` (the ANSI gotcha)

The output is full of cursor-control escapes (`\x1b[2K\x1b[1A`, `\x1b[?25h`) that overwrite earlier "spinner" lines. A naive `sed 's/\x1b\[[0-9;]*[a-zA-Z]//g'` strips the escape codes but does NOT replay the cursor moves, so the visible output is missing pre-cursor lines that the user *would* see in a terminal.

The good news: the load-bearing strings (`Authentication: Logged in`, `Name: lightfastai`) live in the byte stream *after* all the cursor moves. They survive a naive strip. Probe pattern:

```
coderabbit auth status 2>&1 | sed 's/\x1b\[[0-9;]*[a-zA-Z]//g' | grep -q "Authentication: Logged in"
coderabbit auth status 2>&1 | sed 's/\x1b\[[0-9;]*[a-zA-Z]//g' | grep -q "Name: lightfastai"
```

If both grep matches succeed, both the authed and org probes are green. Do NOT try to parse the table structure — the cursor controls make line-aligned parsing fragile.

## Install (only when "installed" probe fails)

Per https://docs.coderabbit.ai/cli/installation (Phase 3 task: WebFetch the docs URL to confirm the exact command and update this line). The host shows the binary at `~/.local/bin/coderabbit`, which is consistent with a shell installer.

After install, re-run the *installed* probe.

## Login (only when "authed" probe fails)

```
coderabbit auth login
```

Uses GitHub browser sign-in through coderabbit's own flow — it does NOT depend on `gh` being authed.

**Non-TTY mode (verified 2026-05-14)**: coderabbit ships a first-class agent flag:

```
coderabbit auth login --agent          # JSON output for agent-driven browser sign-in
coderabbit auth login --api-key <key>  # paste a pre-minted API key, no browser
```

In Claude Code's `!` shell, prefer `! coderabbit auth login --agent` so output stays parseable. After login, re-run the *authed* probe.

## Set org (when org probe shows the wrong org)

```
coderabbit auth org
```

Interactive picker. Pick `lightfastai`. Re-run the org probe.

## Upgrade (only when version below recorded minimum, or user requests upgrade)

```
coderabbit update
```

Built-in self-update subcommand at v0.4.5 (verified via `coderabbit --help`). After upgrade, re-run the *version* probe.

## Known gotchas

- **`coderabbit auth status` writes cursor controls into stdout** even with `--no-color` (verified: there is no such flag at v0.4.5). The ANSI strip + grep pattern above is the practical workaround. Do NOT try to set `TERM=dumb` — the CLI emits the codes unconditionally.
- **GitHub browser sign-in is the only auth flow.** The user must have an active GitHub identity *separate from `gh`*; the two CLIs don't share tokens. If the user has no GitHub account, halt — the doctor cannot create one.
- **`gh` ordering is for human cognition, not technical dependency.** The dispatcher runs `coderabbit` after `gh` so the user has already done the "log into GitHub" mental work; coderabbit's flow is then a recognizable repeat.
- **Two orgs available** on this host (`lightfastai`, plus one other). If `coderabbit auth status` doesn't show `Name: lightfastai`, run `coderabbit auth org` and pick `lightfastai`.
- **There is no `coderabbit upgrade` subcommand** — it's `coderabbit update` (consistent with `clerk update`, not with `sentry cli upgrade`).
