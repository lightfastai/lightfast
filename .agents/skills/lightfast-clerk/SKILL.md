---
name: lightfast-clerk
description: |
  Provision Clerk test users, sign in via the browser, mint JWTs, and tear
  everything down — for local-dev tRPC / desktop / API testing. Triggers when
  the user wants to call Lightfast tRPC procedures with a real auth token,
  test desktop sign-in flows, or set up / clean up test users in Clerk dev.
  Dev-only: refuses to run against pk_live_ keys or non-localhost URLs.
---

# Lightfast Clerk Skill

End-to-end Clerk auth automation for local development. Provisions test users,
drives sign-in, mints JWTs, and cleans up — all without human interaction.

## Decision tree

```
What do you need?
├── A JWT to call /api/trpc/...               -> command/token.sh <profile> [template]
├── A live browser session (cookie persisted) -> command/login.sh <profile>
├── Inspect a profile's state                 -> command/status.sh <profile>
├── Curl a tRPC procedure with auth           -> command/curl.sh <profile> <procedure>
├── Sign out (server-side, keep profile)      -> command/signout.sh <profile>
├── Wipe local profile state                  -> command/reset.sh <profile>
└── Delete the Clerk user entirely            -> command/delete-user.sh <profile>
```

**Most common workflow** (testing a tRPC procedure):
```bash
.agents/skills/lightfast-clerk/command/curl.sh -t lightfast-desktop claude-default account.get
```
This single call handles user provisioning, token minting, and the curl in one step.

## Commands

| Command | Purpose | Browser? | Side effects |
|---|---|---|---|
| `token.sh <profile> [template]` | Mint a JWT (stdout = JWT) | No | Provisions user if first call |
| `login.sh <profile> [email]` | Browser sign-in for cookie persistence | Yes (headless) | Provisions user, persists Clerk cookie |
| `status.sh <profile>` | Report profile state | Yes (headless) | None |
| `signout.sh <profile>` | Server-side sign out | Yes (headless) | Clerk session invalidated |
| `reset.sh <profile>` | Wipe profile dir + meta | No | `rm -rf` profile |
| `delete-user.sh <profile>` | Delete Clerk user + reset | No | Clerk user permanently removed |
| `curl.sh [-t tpl] <profile> <proc> [body]` | Mint + curl convenience | No | None |

## Mental model

A **profile** = `<repo>/.agent-browser/profiles/<name>/` (Playwright user-data-dir)
+ `<name>.meta.json` sidecar (`email`, `userId`, `signedInAt`).

Profiles are **per-repo, gitignored**, scoped to one Clerk test user each.

State machine:
```
[UNKNOWN]                                              ┌─────────────┐
   │  token.sh ─ provisions user (Backend API)         │ delete-user │
   ▼                                                   │   (Clerk)   │
[PROVISIONED] ──login.sh──> [SIGNED_IN]                │             │
                                │                      └──────┬──────┘
                                │ signout.sh                  ▼
                                ▼                       [UNKNOWN] (no Clerk user, no disk)
                          [SIGNED_OUT] ──login.sh──┐
                                │                  │
                                │ reset.sh         │
                                ▼                  │
                          [UNKNOWN]                │
                                                   │
                          (re-login) ──────────────┘
```

## Key conventions

- **Profile name**: `[a-zA-Z0-9_-]+`. Default profile in examples: `claude-default`.
- **Email**: derived from `git config user.email`. GitHub noreply → just the username.
  Example: `jp@jeevanpillay.com` → `debug-jp-jeevanpillay-com+clerk_test@lightfast.ai`.
  Override with `LIGHTFAST_CLERK_EMAIL=...`.
- **JWT template**: pass `lightfast-desktop` for desktop-shape JWTs (1h expiry,
  `org_id` claim). Omit for the default Clerk session token.
- **Base URL**: `http://localhost:3024` (mesh origin). Override via `LIGHTFAST_CLERK_URL`.
  Non-localhost URLs require `LIGHTFAST_CLERK_I_KNOW_WHAT_IM_DOING=1`.

## Safety guardrails

Every script aborts immediately if any of these fire:
1. Clerk publishable key in `apps/app/.vercel/.env.development.local` is not `pk_test_*`
2. Target URL is not localhost AND override flag is unset
3. Profile name contains characters outside `[a-zA-Z0-9_-]`
4. Email passed to `login.sh` does not contain `+clerk_test@`

Backend operations (`clerk-backend.mjs`) refuse non-test secret keys.

## Prerequisites

1. **Dev server running**: `pnpm dev:app` (or `pnpm dev:desktop-stack` once Phase 6 lands).
   Skill targets `http://localhost:3024` (microfrontends mesh).
2. **`agent-browser` CLI installed**: `which agent-browser` should resolve.
3. **`.vercel/.env.development.local` pulled**: `cd apps/app && vercel env pull`.
4. **JWT template in Clerk dashboard** (only needed if you want template-shaped tokens):
   - Name: `lightfast-desktop`
   - Expiry: 3600s
   - Claims: `{ "org_id": "{{org.id}}" }`

## Background — Clerk test mode

The `pk_test_` / `sk_test_` Clerk keys enable test mode:
- Emails matching `<anything>+clerk_test@<anydomain>` skip real delivery
- OTP code `424242` always verifies in those flows
- Backend-created users skip waitlist gating

This is what makes the skill fully scriptable. See `references/test-mode.md`.

## See also

- `references/safety.md` — guardrails in detail
- `references/test-mode.md` — Clerk test-mode primer
- `references/jwt-templates.md` — template names + claims
- `lib/common.sh` — shared bash helpers (sourced by all commands)
- `lib/clerk-backend.mjs` — Backend API wrapper (ensure-user, delete-user, mint-session-token)
