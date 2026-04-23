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

### 5. Email allowlist (login.sh only)

`login.sh` refuses any email that does not contain `+clerk_test@`. Prevents
accidentally driving sign-in for a real Clerk user.

This guard does **not** apply to `token.sh` if you call it without first running
`login.sh` — `token.sh` will provision whatever email `derive_test_email` returns
or `LIGHTFAST_CLERK_EMAIL` is set to. Set responsibly.

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
| `email '...' is not a Clerk test address` | Custom email lacks `+clerk_test@` | Use the derived format or set `LIGHTFAST_CLERK_EMAIL` to one that includes it |
| `profile name must match [a-zA-Z0-9_-]+` | Spaces, dots, slashes | Use a simple identifier |
