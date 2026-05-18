# `emulate` — doctor playbook

Third-party CLI from https://emulate.dev — local drop-in replacement services
for CI and no-network sandboxes. Maintained by Vercel. Supports Vercel REST
API, GitHub REST API, Google OAuth/OIDC + Gmail/Calendar/Drive, and Slack API
emulators in one binary.

## What Lightfast uses it for

- `pnpm dev:emulate` (`scripts/dev-emulate.mjs`) boots `emulate start --service google` on a local port plus an ngrok tunnel, then mints a Clerk Test IdP issuer URL pointing at the tunnel. Used for Clerk e2e auth flows without hitting real Google OAuth.
- Future: GitHub / Slack / Vercel API emulators are not wired up yet but live in the same binary.

## Probe (read-only)

- **Installed (global)**: `npm ls -g emulate` exits 0 AND prints a line like `emulate@<ver>` → green. **Do NOT use `command -v emulate`** — `emulate` is a zsh built-in that shadows the npm binary; bare `command -v` always returns the built-in path.
- **Version**: `command emulate --version` → green when ≥ `0.5.0` (verified on the known-good host as of 2026-05-14). The `command` builtin bypasses zsh's `emulate` builtin and invokes the npm-installed binary.
- **Service list (informational)**: `command emulate list-services` enumerates the bundled services. Expected to include `google` (the one `scripts/dev-emulate.mjs` uses).

(No authed / org / identity dimensions — emulate has no remote state.)

## Install (only when "installed" probe fails)

```
npm i -g emulate@latest
```

After install, re-run the *installed* probe via `npm ls -g emulate`.

## Login (n/a)

Emulate has no auth. The Clerk-side credentials needed by `dev:emulate` (seed
users, mock OAuth client ID/secret) live in `scripts/dev-emulate.seed.yaml`
and are emitted on first run.

## Set org / project

N/A — no remote state.

## Upgrade (only when version below recorded minimum, or user requests upgrade)

```
npm i -g emulate@latest
```

Same command upgrades in place. After upgrade, re-run the *version* probe.

If the workspace script `scripts/dev-emulate.mjs:236` pins a specific version
(currently `emulate@0.5.0` via `npx --yes`), bumping the global install does
NOT change what the script runs — that's a separate bump in the script file.

## Known gotchas

- **`emulate` is a zsh built-in** (`emulate -L sh` etc., used for shell-mode
  compatibility). It shadows the npm-installed binary in zsh. `which emulate`
  returns `"emulate: shell built-in command"`, and `emulate --version` errors
  with `"bad option: -v"`. Workarounds:
  - `command emulate <args>` — invokes the external binary, bypasses the builtin.
  - `npm ls -g emulate` — confirms global install without invoking the binary.
  - bash subshell: `bash -c 'emulate --version'` — bash has no such builtin.
  - Absolute path: `$(npm root -g)/../bin/emulate <args>` — works in any shell.
- **`scripts/dev-emulate.mjs` uses `npx --yes emulate@0.5.0`**, not the global
  install. The global install is for the doctor's verification path and for
  ad-hoc human use (e.g. `command emulate start --service github`). The script
  intentionally pins a version via npx; the doctor's "installed globally" probe
  is independent of what the script runs.
- **No persistent state.** Every `emulate start` boots fresh; there is no
  config to seed or credential to refresh. If the doctor's probes are green
  but `pnpm dev:emulate` fails, the cause is upstream (ngrok tunnel, Clerk
  publishable key, seed YAML), not the `emulate` binary.
- **Port binding.** `emulate start` uses port 4000 by default in
  `scripts/dev-emulate.mjs` (search for `EMULATOR_PORT`); collisions surface
  as runtime errors from the script, not as doctor-detectable state.

## References

- Upstream: https://emulate.dev
- npm: https://www.npmjs.com/package/emulate
- Lightfast usage: `scripts/dev-emulate.mjs`, `scripts/dev-emulate.seed.yaml`
- Related skill: `lightfast-clerk` (its `references/oauth-playbook.md` documents the dev-emulate runtime contract).
