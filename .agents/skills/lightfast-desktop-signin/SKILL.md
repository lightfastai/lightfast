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
a custom URL scheme + PKCE flow. Replaces the older "log-grep loopback URL,
attach CDP to renderer" choreography with a single line of stdout JSON in,
single agent-browser session, structured completion event out.

## When to use

You need the desktop app to hold a real Clerk JWT — to drive tRPC procedures
that require `authedProcedure`, run E2E flows against signed-in renderer
surfaces, or smoke-test the auth mesh end-to-end. If you only need a JWT for
HTTP calls (not the desktop), use `lightfast-clerk` instead — it's faster.

## Preconditions

- Local dev mesh up on `:3024` (`pnpm dev:full` or `pnpm dev:app`).
- Clerk publishable key is `pk_test_*` (refuse `pk_live_*`).
- `LIGHTFAST_API_URL` either unset or pointing at `http://localhost:*` (refuse
  any non-localhost host).
- `agent-browser` installed and reachable on PATH.
- The desktop app must already be running before you trigger the redirect.
  Cold-launching via OS dispatch is unreliable in dev (unpackaged Electron
  registers `lightfast-dev://` against `com.github.electron`, not Lightfast's
  bundle id, so LaunchServices relaunches bare Electron without our entrypoint).
  Packaged builds are fine; agents run unpackaged dev builds.

## Required environment

| Var | Value | Why |
| --- | --- | --- |
| `LIGHTFAST_DESKTOP_AGENT_MODE` | `1` | Skips `shell.openExternal` (Dia never opens) and emits structured stdout JSON instead. Without this, the flow opens the user's default browser and the agent has no way to read the URL. |
| `AGENT_BROWSER_HEADED` | `true` | **Mandatory.** Headless Chrome for Testing silently drops `lightfast-dev://` navigations — no prompt, no error, no fallback browser hand-off. The desktop's `app.on('open-url')` never fires and the agent times out with no diagnostic signal. Validated 2026-04-25 spike. |
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

# 3. Headed agent-browser navigates to the URL. Clerk completes, browser
#    dispatches lightfast-dev://auth/callback?code=…&state=…, OS routes to
#    the running desktop, exchange runs, token persists.
AGENT_BROWSER_HEADED=true agent-browser open "$SIGNIN_URL"

# 4. Block on completion event.
RESULT=$(timeout 30 sh -c "tail -F /tmp/desktop.log | jq -rcM --unbuffered 'select(.event==\"auth_signed_in\" or .event==\"auth_signin_failed\")' | head -1")
echo "$RESULT" | jq -e '.event=="auth_signed_in"' > /dev/null
```

No CDP attach to the renderer, no log-grep — just JSON parse off stdout. Verify
with `pgrep -l Dia` before/after that no Dia process was spawned.

## Failure modes

| Symptom | Most likely cause |
| --- | --- |
| `auth_signin_failed{reason:"timeout"}` | **Forgot `AGENT_BROWSER_HEADED=true`.** Headless Chromium dropped the `lightfast-dev://` navigation silently. This is the #1 cause. |
| `auth_signin_failed{reason:"exchange_failed"}` | API unreachable, or the code expired (30s TTL). Check `pnpm dev:full` is running and Upstash Redis env is configured. |
| `auth_signin_failed{reason:"persist_failed"}` | Electron `safeStorage` unavailable on this host (rare; usually macOS Keychain access denied). |
| `auth_signin_failed{reason:"handler_error"}` | Custom-scheme URL parsing or unexpected callback shape. Check the desktop log; surface to engineering. |
| No event at all within 30s | Desktop didn't start in agent mode, or `pnpm dev:full` mesh is down on `:3024`. Check the bootstrap line in stdout. |

## Hygiene

- `agent-browser close --all` between runs if you need a *fresh* sign-in.
  Otherwise the daemon profile retains Clerk session cookies and the next run
  will short-circuit through Clerk silently — fine if that's what you want.
- Sign-out: dispatch the existing IPC `auth:sign-out` from the renderer, or
  delete `~/Library/Application Support/Lightfast Dev/auth.bin` (macOS).

## Refusal conditions

Refuse to run when:
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` starts with `pk_live_`.
- `LIGHTFAST_API_URL` is set to anything other than a localhost URL.

These are the same guardrails as `lightfast-clerk` — this skill is dev-only.
