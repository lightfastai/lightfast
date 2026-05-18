# `gh` — doctor playbook

## What Lightfast uses it for

- PR review, issue triage, release ops (`gh release create` in the desktop release pipeline).
- `gh auth status` token is what makes `git push` over HTTPS work without password prompts (via `gh` as a credential helper, when configured).
- Indirect dependency for human-cognitive ordering: `coderabbit` uses its own GitHub OAuth, but devs associate "the GitHub login" with `gh`.

## Probe (read-only)

- **Installed**: `command -v gh` → green when exit 0.
- **Version**: `gh --version` → green when ≥ `2.81.0` (verified on the known-good host as of 2026-05-14).
- **Authed**: `gh auth status` → green when stdout contains `Logged in to github.com` AND `Active account: true`.
- **Scopes**: `gh auth status` lists the active token's scopes. **Required**: `admin:org`, `gist`, `repo`, `workflow`. If any are missing, treat as a fix.
- **No org switch needed** — `gh` operates on a single GitHub identity. Multiple identities use `--user`, not `auth switch`.

## Install (only when "installed" probe fails)

- macOS: `brew install gh`
- Linux: `sudo apt install gh` (Debian/Ubuntu via the official keyring — see https://cli.github.com/manual/installation), or `sudo dnf install gh` (Fedora).

After install, re-run the *installed* probe.

## Login (only when "authed" probe fails)

```
gh auth login -h github.com -p https -w
```

`-p https` keeps git operations on HTTPS; `-w` forces the web-based browser flow (instead of paste-a-token). The CLI opens the browser; complete the device-code prompt there. Works under Claude Code's `!` shell prefix — gh prints the device code to stdout before blocking on the browser callback.

**Non-TTY alternatives (verified 2026-05-14)**:

```
echo "$GH_PAT" | gh auth login -h github.com -p https --with-token   # pipe a pre-minted PAT
GH_TOKEN=<pat> gh <subcommand>                                       # env var; skips auth login entirely
```

For headless automation, `GH_TOKEN` is the best path. For developer onboarding, the bare `! gh auth login -h github.com -p https -w` is fine.

After login, re-run the *authed* probe.

## Add missing scopes (when scopes probe fails but auth is otherwise green)

```
gh auth refresh -h github.com -s admin:org,gist,repo,workflow
```

Re-run the scopes probe.

## Upgrade (only when version below recorded minimum, or user requests upgrade)

- macOS: `brew upgrade gh`
- Linux: package manager equivalent (`apt`, `dnf`).

Verified live 2026-05-14: 2.81.0 → 2.92.0 upgrade via `brew upgrade gh` preserves auth + scopes (keyring-stored token survives the binary swap).

## Known gotchas

- **`gh auth status` exits 0 even with stale tokens** in some edge cases. The "Active account: true" line is the load-bearing signal, not the exit code.
- **`gh auth login` choice screen is interactive.** The `-h github.com -p https -w` flags skip every prompt; without them the agent has to drive a TUI.
- **Token scopes shown in `gh auth status` are the *granted* scopes**, not what `gh` could request. If you see `'admin:org', 'gist', 'repo', 'workflow'` you're good — order doesn't matter.
- **`gh` may be on PATH twice** (Homebrew + fnm-managed). `which -a gh` to confirm; `brew upgrade gh` only touches the Homebrew install.
