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

Clerk auth primitives for local development. Strict scripts for operations
with stable contracts (Clerk Backend API, filesystem). A playbook for the
browser-driven sign-in flow, because Lightfast's auth UI changes and a
hardcoded script would silently rot.

The split:
- **Scripts** talk to Clerk's Backend API and the local filesystem. These are
  stable contracts — a script is the right tool.
- **Playbook** (`references/sign-in-playbook.md`) drives the browser via
  `agent-browser`. The calling agent (Claude, a human, another skill) reads
  the playbook and executes it. Failures become *observations* instead of
  opaque `exit 1` — which is exactly what you want when debugging auth.

## Decision tree

```
What do you need?
├── A JWT to call /api/trpc/...               -> command/token.sh <profile> [template]
├── Curl a tRPC procedure with auth           -> command/curl.sh <profile> <procedure>
├── Inspect a profile's state                 -> command/status.sh <profile> [--json]
├── A live browser session (cookie persisted) -> drive references/sign-in-playbook.md
├── Sign out                                  -> drive the sign-out section of that playbook
├── Wipe local profile state                  -> command/reset.sh <profile>
├── Delete the Clerk user entirely            -> command/delete-user.sh <profile>
├── Test the real-email round-trip            -> drive references/real-email-testing.md
│   (magic-link, OTP, or invitation/ticket — i.e. emails ACTUALLY get sent)
└── Backend Clerk op (token, invite, lookup)  -> node lib/clerk-backend.mjs <subcommand>
```

**Most common workflow** (testing a tRPC procedure):
```bash
.agents/skills/lightfast-clerk/command/curl.sh -t lightfast-desktop claude-default account.get
```
This single call handles user provisioning, token minting, and the curl in one
step. No browser needed — pure Clerk Backend API.

## Commands

| Command | Purpose | Browser? | Side effects |
|---|---|---|---|
| `token.sh <profile> [template]` | Mint a JWT (stdout = JWT) | No | Provisions user on cold start (no dir + no meta); refuses if profile dir exists but meta missing |
| `curl.sh [-t tpl] <profile> <proc> [body]` | Mint + curl convenience | No | Same as `token.sh` |
| `status.sh [--json] <profile>` | Report profile state via Clerk Backend API | No | None |
| `reset.sh <profile>` | Wipe profile dir + meta | No | `rm -rf` profile |
| `delete-user.sh <profile>` | Delete Clerk user + reset | No | Clerk user permanently removed |

## Backend API subcommands

`node lib/clerk-backend.mjs <subcommand> [args]` — thin wrapper around
the [Clerk Backend API](https://clerk.com/docs/reference/backend-api).
All subcommands refuse non-`sk_test_` keys. Exit code `3` = "not found"
so callers can branch without parsing stderr.

| Subcommand | Purpose | Output |
|---|---|---|
| `ensure-user <email>` | Idempotent create. Skips waitlist, sets `legal_accepted_at` | userId on stdout |
| `find-user <email>` | Look up by email | JSON, or exit 3 |
| `get-user <userId>` | Fetch by id | JSON, or exit 3 |
| `delete-user <userId>` | Hard delete | — |
| `delete-user-by-email <email>` | find+delete convenience | deleted userId, or exit 3 |
| `mint-session-token <userId> [template]` | Session JWT (used by `token.sh`) | JWT on stdout |
| `create-sign-in-token <userId> [expires_in_seconds]` | Magic-link token. No email sent | JSON `{ id, token, url, status, ... }` — expiry is in the JWT `exp` claim, not a separate field |
| `create-invitation <email> [redirect_url] [--no-notify]` | Ticket sign-up. Clerk emails the recipient unless `--no-notify` | JSON `{ id, url, expires_at, ... }` |
| `find-invitation <id>` | List-filter across all statuses (the `GET /v1/invitations/<id>` route 404s; default list omits revoked/accepted/expired) | JSON, or exit 3 |
| `revoke-invitation <id>` | Cancel a pending invitation | — |

## References

| File | Purpose |
|---|---|
| `references/sign-in-playbook.md` | Goal-driven recipe for browser sign-in / sign-out via `agent-browser`. Read + execute from your own prompt — do not shell out to a one-shot script. |
| `references/real-email-testing.md` | Real-email round-trip with plus-addressing (magic-link, invitation, OTP sign-up). Inbox polling via Superhuman MCP. Known auth bugs. |
| `references/safety.md` | Layered guardrails |
| `references/test-mode.md` | Clerk test-mode primer (`+clerk_test@`, OTP `424242`) |
| `references/jwt-templates.md` | Template names and claims |

## Mental model

A **profile** = `<repo>/.agent-browser/profiles/<name>/` (Playwright user-data-dir)
+ `<name>.meta.json` sidecar (`email`, `userId`, `signedInAt`).

Profiles are **per-repo, gitignored**, scoped to one Clerk test user each.

### States reported by `status.sh`

| State | Meaning | Next step |
|---|---|---|
| `UNKNOWN` | No meta sidecar | `token.sh` to cold-start, or drive the playbook |
| `GHOST` | Meta has `userId`, but Clerk 404s on it (user deleted out-of-band) | `reset.sh` then re-provision |
| `PROVISIONED` | Valid Clerk user, no browser profile dir (token-only use so far) | Drive the playbook if you need a cookie |
| `SIGNED_IN_LOCAL` | Valid user + profile dir + `signedInAt` written | Proceed; cookies are presumed live |

`status.sh` does **not** verify the browser cookie is still valid. That would
require a browser probe, which is expensive and almost never what the caller
needs. If you must know, drive the playbook and observe what happens.

### Transitions

- `token.sh` on cold start (no dir, no meta) → `UNKNOWN` becomes `PROVISIONED`
- Driving the sign-in playbook + `meta_write` → `PROVISIONED` (or `UNKNOWN`) becomes `SIGNED_IN_LOCAL`
- `reset.sh` → any state becomes `UNKNOWN`
- `delete-user.sh` → any state becomes `UNKNOWN` + Clerk user gone
- Someone deletes the user out-of-band → `SIGNED_IN_LOCAL`/`PROVISIONED` becomes `GHOST` next time you check

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
4. `token.sh` is called on a profile with a browser dir but no meta (would
   silently cross-contaminate profiles via `derive_test_email`)

Backend operations (`clerk-backend.mjs`) refuse non-test secret keys. The
sign-in playbook expects callers to pass a `+clerk_test@`-suffixed email —
that's enforced by Clerk test mode, not by a script.

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

See `references/test-mode.md`.

## See also

- `references/sign-in-playbook.md` — browser sign-in / sign-out waypoints
- `references/real-email-testing.md` — real-delivery flows + plus-addressing + inbox polling
- `references/safety.md` — guardrails in detail
- `references/test-mode.md` — Clerk test-mode primer
- `references/jwt-templates.md` — template names + claims
- `lib/common.sh` — shared bash helpers (sourced by all scripts; bash-only)
- `lib/clerk-backend.mjs` — Backend API wrapper (users, sign-in tokens, invitations, session tokens)
