---
name: lightfast-desktop-signin
description: |
  Sign the Lightfast desktop app in from an agent harness without opening Dia
  or the system default browser. Drives a single agent-browser session over
  a deterministic stdout JSON event grammar. Triggers when the user wants the
  desktop app authed for tRPC/E2E/renderer testing, or asks to "sign the
  desktop app in for me". Dev-only: refuses against pk_live_ Clerk keys or
  non-localhost LIGHTFAST_API_URL.
---

# Lightfast Desktop Sign-In Skill

End-to-end agent runbook for getting the Electron desktop app signed in via
a loopback PKCE flow. Desktop emits a structured stdout URL, the browser
completes Clerk sign-in and org selection, and Clerk redirects back to the
desktop-owned `127.0.0.1` callback server.

## When to use

You need the desktop app to hold a real Clerk OAuth access token and selected
organization — to drive tRPC procedures that require `authedProcedure`, run
E2E flows against signed-in renderer surfaces, or smoke-test the auth mesh
end-to-end. If you only need a token for HTTP calls, use `lightfast-clerk`
instead.

## Preconditions

- Local app dev mesh is running (`pnpm dev` recommended; `pnpm dev:app` is
  enough when the current worktree's app origin resolves).
- Clerk publishable key is `pk_test_*` (refuse `pk_live_*`).
- `LIGHTFAST_API_URL` either unset or pointing at `http://localhost:*` (refuse
  any non-localhost host).
- `agent-browser` installed and reachable on PATH.
- The desktop app must already be running before opening the sign-in URL,
  because it owns the ephemeral loopback callback server.

## Required environment

| Var | Value | Why |
| --- | --- | --- |
| `LIGHTFAST_DESKTOP_AGENT_MODE` | `1` | Skips `shell.openExternal` (Dia never opens) and emits structured stdout JSON instead. Without this, the flow opens the user's default browser and the agent has no way to read the URL. |
| `LIGHTFAST_DESKTOP_AUTH_TIMEOUT_MS` | `30000` (recommended) | Default is 5 minutes for human users; agents want fast CI feedback. |

## Stdout event grammar

Desktop emits one JSON object per line on stdout (only when AGENT_MODE=1):

| Event | When | Payload |
| --- | --- | --- |
| `auth_already_signed_in` | App start, token already persisted | `{}` |
| `auth_signin_url` | App start, token absent — sign-in begun | `{ url: string }` |
| `auth_signed_in` | Exchange succeeded, token persisted | `{}` |
| `auth_signin_failed` | Timeout / exchange 4xx / state mismatch / persist failed | `{ reason: string }` |

Every `auth_signin_url` is followed by exactly one terminal event
(`auth_signed_in` OR `auth_signin_failed`) per in-flight sign-in.

## The flow

```sh
# 1. Start desktop in agent mode. Auto-triggers sign-in on app-ready when
#    no token is persisted; idempotent if already signed in.
LIGHTFAST_DESKTOP_AGENT_MODE=1 \
LIGHTFAST_DESKTOP_AUTH_TIMEOUT_MS=30000 \
  pnpm --filter @lightfast/desktop dev > /tmp/desktop.log 2>&1 &

# 2. Read the first lifecycle event (auth_already_signed_in OR auth_signin_url).
EVENT=$(timeout 30 sh -c "tail -F /tmp/desktop.log | jq -rcM --unbuffered 'select(.event)' | head -1")
case "$(echo "$EVENT" | jq -r .event)" in
  auth_already_signed_in) echo "Already signed in"; exit 0 ;;
  auth_signin_url)        SIGNIN_URL=$(echo "$EVENT" | jq -r .url) ;;
  *) echo "Unexpected event: $EVENT"; exit 1 ;;
esac

# 3. agent-browser navigates to the URL. Clerk completes, then redirects to
#    http://127.0.0.1:<ephemeral>/callback?code=...&state=...
#    The running desktop loopback server captures it, exchanges the code,
#    finalizes org binding, and persists the full native session.
agent-browser open "$SIGNIN_URL"

# 4. Block on completion event.
RESULT=$(timeout 30 sh -c "tail -F /tmp/desktop.log | jq -rcM --unbuffered 'select(.event==\"auth_signed_in\" or .event==\"auth_signin_failed\")' | head -1")
echo "$RESULT" | jq -e '.event=="auth_signed_in"' > /dev/null
```

No CDP attach to the renderer, no log-grep — just JSON parse off stdout. Verify
with `pgrep -l Dia` before/after that no Dia process was spawned.

## Failure modes

| Symptom | Most likely cause |
| --- | --- |
| `auth_signin_failed{reason:"timeout"}` | Browser did not reach the loopback callback before `LIGHTFAST_DESKTOP_AUTH_TIMEOUT_MS`. Check that the Clerk flow completed and the desktop process stayed running. |
| `auth_signin_failed{reason:"exchange_failed"}` | Clerk token exchange failed or returned an unexpected response. The authorization code may have expired. |
| `auth_signin_failed{reason:"persist_failed"}` | Electron `safeStorage` unavailable on this host (rare; usually macOS Keychain access denied). |
| `auth_signin_failed{reason:"loopback_failed"}` | Desktop could not bind an ephemeral `127.0.0.1` callback server. |
| `auth_signin_failed{reason:"oauth_error"}` | Clerk returned an OAuth error to the callback URL. |
| `auth_signin_failed{reason:"state_mismatch"}` | Callback state was missing, invalid, or did not match the in-flight sign-in. |
| `auth_signin_failed{reason:"handler_error"}` | Unexpected callback or finalization error. Check the desktop log; surface to engineering. |
| No event at all within 30s | Desktop did not start in agent mode, or the local app origin is unreachable. Check the bootstrap line in stdout and `node scripts/with-desktop-env.mjs --print`. |

## Hygiene

- `agent-browser close --all` between runs if you need a *fresh* sign-in.
  Otherwise the daemon profile retains Clerk session cookies and the next run
  will short-circuit through Clerk silently — fine if that's what you want.
- Sign-out: dispatch the existing IPC `auth:sign-out` from the renderer, or
  delete `~/Library/Application Support/Lightfast Dev/auth.bin` (macOS).

## Commands

- `command/status.sh` reports whether the dev `auth.bin` exists.
- `command/sign-out.sh` removes the dev `auth.bin` so the next desktop launch
  starts signed out.

There is no sign-in command. Sign-in must run through the loopback OAuth flow
above so the desktop persists a complete org-bound native session.

## Refusal conditions

Refuse to run when:
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` starts with `pk_live_`.
- `LIGHTFAST_API_URL` is set to anything other than a localhost URL.

These are the same guardrails as `lightfast-clerk` — this skill is dev-only.
