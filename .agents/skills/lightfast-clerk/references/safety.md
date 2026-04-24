# Safety guardrails

This skill performs **side-effecting Clerk operations** (creating users, signing
in, deleting users). It is **dev-only**. Multiple guardrails enforce this.

## Layered defenses

### 1. Test-key check (`assert_safe_env` in `lib/common.sh`)

Reads `apps/app/.vercel/.env.development.local`. Aborts if:
- File missing
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` missing
- Key does not start with `pk_test_`

Backend script (`lib/clerk-backend.mjs`) does the same check on `CLERK_SECRET_KEY`
(must start with `sk_test_`).

### 2. URL allowlist

Default `LIGHTFAST_CLERK_URL=http://localhost:3024`. Non-localhost URLs require:
```bash
LIGHTFAST_CLERK_I_KNOW_WHAT_IM_DOING=1
```
This is intentionally awkward to type. There is no production use case for this
skill; the override exists only for branch-preview testing.

### 3. Profile name lock

`assert_profile_name` rejects anything outside `[a-zA-Z0-9_-]+`. Prevents path
traversal (`../`) and accidental shell-expansion attacks.

### 4. Profile path scope

All profiles live under `<repo>/.agent-browser/profiles/`. The path is computed
from the skill's `lib/` location (relative resolution, not configurable). No
script accepts an absolute path argument.

### 5. Token auto-provision guard

`token.sh` auto-provisions a user on cold start (no meta, no profile dir),
using `derive_test_email` or `LIGHTFAST_CLERK_EMAIL`. If the profile dir
exists but meta is missing, `token.sh` refuses — otherwise the derived email
would silently clobber whatever that profile dir belonged to. Fix: either
drive the sign-in playbook and write meta, or `reset.sh` to start clean.

The sign-in playbook expects callers to supply a `+clerk_test@` email. This
isn't enforced by a script anymore; Clerk test mode itself rejects any email
that doesn't match, so real-user sign-in via this flow is impossible.

### 6. .gitignore

`.agent-browser/` is gitignored. Profile dirs contain Clerk session cookies and
should never be committed.

## What's NOT guarded

- The skill cannot detect if a Clerk test instance has been pointed at a
  production database (would be a misconfiguration upstream).
- `delete-user.sh` is irreversible — Clerk does not retain deleted user data.
  No "are you sure?" prompt because the skill is for ephemeral test users.

## Failure modes worth knowing

| Symptom | Likely cause | Fix |
|---|---|---|
| `refusing to run against non-test Clerk key` | Live keys in `.env.development.local` | Restore test keys (`vercel env pull` from dev project) |
| `LIGHTFAST_CLERK_URL=... is not localhost` | Custom URL without override | Set `LIGHTFAST_CLERK_I_KNOW_WHAT_IM_DOING=1` only if you really mean it |
| `profile name must match [a-zA-Z0-9_-]+` | Spaces, dots, slashes | Use a simple identifier |
| `profile '...' has a browser dir but no meta` | Sign-in playbook was started but `meta_write` was skipped (or meta was lost) | Finish sign-in + `meta_write`, or run `reset.sh <profile>` |
| `state: GHOST` from `status.sh` | The `userId` in meta no longer exists in Clerk (deleted out-of-band) | `reset.sh <profile>` then re-provision |
