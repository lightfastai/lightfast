# `ngrok` — doctor playbook

The only CLI in the doctor that does **not** use browser OAuth. ngrok auth is a static authtoken pasted from the dashboard, written to `~/Library/Application Support/ngrok/ngrok.yml` (macOS) by `ngrok config add-authtoken`.

## What Lightfast uses it for

- `pnpm dev:ngrok` (port 3024) — see root `package.json` scripts.
- The Test IdP OAuth playbook in `lightfast-clerk` (`references/oauth-playbook.md`) — the emulator-backed Test IdP needs a publicly reachable callback URL.
- `scripts/ngrok:18-25` already encodes the auth-add contract for new devs; this playbook is the doctor-side mirror.

## Probe (read-only)

- **Installed**: `command -v ngrok` → green when exit 0.
- **Version**: `ngrok --version` → green when ≥ `3.39.1` (verified on the known-good host as of 2026-05-14).
- **Authed**: `ngrok config check` → green when exit 0 and stdout reads `Valid configuration file at <path>`.

(No org probe — ngrok free-tier auth is per-account, single-identity.)

## Install (only when "installed" probe fails)

- macOS: `brew install ngrok`
- Linux: `snap install ngrok` or download from https://ngrok.com/download.

After install, re-run the *installed* probe.

## Login (only when "authed" probe fails) — token paste, no browser

This is the one flow that needs a human in the loop with a clipboard.

1. Print to the user, verbatim:
   > Open https://dashboard.ngrok.com/get-started/your-authtoken, copy the token, and paste it here.
2. Wait for the user to paste the token.
3. Run:
   ```
   ngrok config add-authtoken <token>
   ```
4. Re-run the *authed* probe.

Halt rule: if the user has no ngrok account, surface that as a hard halt — the doctor cannot create one. They sign up at https://dashboard.ngrok.com/signup, then resume.

## Set org / project

N/A — single-account model.

## Upgrade (only when version below recorded minimum, or user requests upgrade)

- macOS: `brew upgrade ngrok`
- Linux: `snap refresh ngrok` or re-download.

## Known gotchas

- **Free-tier ngrok URLs rotate on every restart.** That is a *runtime* concern of `pnpm dev:emulate`, not a doctor concern. The doctor must NOT try to "fix" the URL drift here. The `lightfast-clerk` skill's `references/oauth-playbook.md` handles the rotation.
- **`ngrok config check` returns 0 even with an expired or revoked token** — it only validates the file is well-formed, not that the token is live. If `pnpm dev:ngrok` later fails with 401, re-run the token-paste flow.
- **The config file path is macOS-specific** in the probe message. On Linux the path will be `~/.config/ngrok/ngrok.yml`. The doctor does not need to handle this — `ngrok config check`'s output is informational.
