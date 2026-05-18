# Real-email round-trip testing

Companion to `test-mode.md`. Most of this skill assumes `+clerk_test@`
addresses (no real delivery, fixed OTP `424242`). This doc covers the
opposite case: when you need a **real email** to actually arrive in an
inbox you can read, so you can verify the full sign-in/sign-up loop end
to end.

## When to use this

| Goal | Use this | Use `+clerk_test@` |
|---|---|---|
| Test a tRPC procedure with auth | ❌ | use `command/token.sh` |
| Verify Clerk UI fields & error mapping | ❌ | drive `sign-in-playbook.md` |
| **Verify OTP/magic-link email contents** | ✅ | — |
| **Verify the activate URL contract** (`/sign-in?step=activate&token=…`) | ✅ | — |
| **Verify invitation/ticket sign-up** end to end | ✅ | — |
| Smoke-test waitlist gating in production-shaped tenant | ✅ | — |
| Repeated runs in CI / unattended automation | ❌ | use `+clerk_test@` |

Real-email tests are **slow** (Clerk delivery is best-effort within
~seconds, but you must poll) and **stateful** (an inbox accumulates
artifacts). Prefer them for *manual-equivalent verification* of paths
that test mode silently skips: actual SMTP delivery, the URL Clerk
embeds in the email, real OTP generation.

## The plus-addressing trick

Clerk test mode is triggered by `^.+\+clerk_test@.+$`. Any other
plus-addressed email (`user+anything@domain.tld`) is treated as a real,
distinct address by Clerk — but most personal/work mail providers
(Gmail, Fastmail, Apple iCloud, Superhuman-on-anything) route
`user+anything@domain.tld` to the same inbox as `user@domain.tld`.

That gives you **unlimited disposable real addresses that all land in
one mailbox you control** without any test-mode magic:

```
jp+phase4-magic-2026-05-13@jeevanpillay.com      ← real delivery
jp+phase3-otp-2026-05-13@jeevanpillay.com        ← real delivery
jp+clerk_test_anything@jeevanpillay.com          ← Clerk test mode (no delivery)
```

The trailing token after `+` is yours to design — bake the date / phase
/ ticket into it so test artifacts are self-identifying when you poll
the inbox or audit the Clerk users dashboard later.

### Configuring

Override the skill's email derivation per-invocation:

```bash
export LIGHTFAST_CLERK_EMAIL="jp+phase4-$(date +%s)@jeevanpillay.com"
```

This bypasses `derive_test_email` in `lib/common.sh` and feeds the
chosen address into `ensure-user`, the sign-in playbook, etc.

> The skill does **not** validate that the local-part has `+clerk_test`.
> That's intentional — real-email tests need it absent. The skill's
> safety net is the `pk_test_` / `sk_test_` guard, not the email shape.

## Flow 1 — Magic-link activation (sign-in token)

Verifies: `apps/app/src/app/(auth)/_components/session-activator.tsx`
+ `_hooks/use-auth-flow.ts` activate slice.

```bash
EMAIL="jp+magic-$(date +%s)@jeevanpillay.com"

# 1. Provision the user (bypasses waitlist)
USER_ID=$(node .agents/skills/lightfast-clerk/lib/clerk-backend.mjs ensure-user "$EMAIL")

# 2. Mint a sign-in token. No email is sent — Clerk hands you the token directly.
#    The response has { id, token, url, status, ... } — no top-level
#    expires_at. The expiry is encoded inside the JWT (`exp` claim).
TOKEN=$(node .agents/skills/lightfast-clerk/lib/clerk-backend.mjs create-sign-in-token "$USER_ID" 600 | jq -r .token)

# 3. Construct the activate URL (this is the URL Clerk would put in the email)
APP_URL="https://lightfast.localhost"   # or http://localhost:3024
ACTIVATE_URL="$APP_URL/sign-in?step=activate&token=$TOKEN"

# 4. Visit the URL in agent-browser, observe SessionActivator behavior
agent-browser open "$ACTIVATE_URL"
agent-browser snapshot
agent-browser eval "window.Clerk?.user?.id ?? null"
```

The magic-link **email body** isn't tested here — that's a Clerk
template concern, not a Lightfast concern. What this verifies is that
*our* activate URL contract is honored end to end (token → `signIn.ticket()`
→ finalize → redirect).

✅ **Resolved 2026-05-13**: this flow works in HEAD via the legacy
`clerk.client.signIn.create({strategy:"ticket", ticket})` workaround at
`use-auth-flow.ts:553-572`. The Future API `signIn.ticket()` no-op
remains an upstream clerk-js issue worth a Clerk support ticket, but
the app routes around it.

## Flow 2 — Invitation (ticket sign-up)

Verifies: `/sign-up?step=code&ticket=…` path + `useAuthFlow` sign-up
ticket branch.

```bash
EMAIL="jp+invite-$(date +%s)@jeevanpillay.com"
APP_URL="https://lightfast.localhost"

# 1. Send the invitation. Clerk emails the recipient (notify=true is default).
INVITATION=$(node .agents/skills/lightfast-clerk/lib/clerk-backend.mjs \
  create-invitation "$EMAIL" "$APP_URL/sign-up")
INVITATION_ID=$(echo "$INVITATION" | jq -r .id)
echo "invitation id: $INVITATION_ID"
echo "url Clerk will email: $(echo "$INVITATION" | jq -r .url)"

# 2. Poll the inbox for the email (see "Inbox polling" below).
#    Extract the ticket from the URL Clerk delivered. The URL shape is
#    e.g. <app>/sign-up?__clerk_ticket=<jwt>&__clerk_status=sign_up
#    or, in Lightfast's URL contract: <app>/sign-up?step=code&ticket=<jwt>

# 3. Visit the URL; OTPIsland should render in ticket mode.
#    The user completes OTP (real code arrives in inbox).

# 4. Cleanup
node .agents/skills/lightfast-clerk/lib/clerk-backend.mjs revoke-invitation "$INVITATION_ID"
node .agents/skills/lightfast-clerk/lib/clerk-backend.mjs delete-user-by-email "$EMAIL"
```

✅ **Resolved 2026-05-13**: `signUp.create({strategy:"ticket", ticket, emailAddress, legalAccepted})`
returns `status:"complete"` immediately (no OTP needed). The earlier
`form_identifier_exists` symptom came from a code state without
`strategy:"ticket"` and is no longer reachable.

> **Constraint: don't combine `ensure-user` + `create-invitation` on the
> same email.** Clerk rejects invitations for any email that already has
> a user account (`422: That email address is taken`). The two flows
> are mutually exclusive:
>
> - Flow 1 (magic-link / activate) is for **existing** users → use `ensure-user` first
> - Flow 2 (invitation / ticket sign-up) is for **prospective** users → no `ensure-user`
>
> Verified live: `ensure-user "$E"; create-invitation "$E"` returns 422.

### Looking up an invitation later

Clerk does **not** expose `GET /v1/invitations/<id>` — that endpoint
404s. Use the list filter:

```bash
node .agents/skills/lightfast-clerk/lib/clerk-backend.mjs find-invitation "$INVITATION_ID"
```

The wrapper handles two Clerk quirks internally:

- `GET /v1/invitations` default list only returns `status=pending`. The
  wrapper queries all four statuses (`pending|accepted|revoked|expired`)
  so post-revoke verification (`find-invitation` to confirm status flipped)
  actually returns the row instead of a misleading `exit 3`.
- The query string matches across email/id/etc., so the wrapper filters
  the result list for exact-id.

### Testing the wrapper without spamming the inbox

`create-invitation` defaults to `notify=true` (Clerk delivers the email).
Pass `--no-notify` when you only want the invitation row + URL for
programmatic testing — e.g. you're testing the wrapper itself, or you
want to extract the magic-link URL without filling a real inbox:

```bash
INVITATION=$(node .agents/skills/lightfast-clerk/lib/clerk-backend.mjs \
  create-invitation "$EMAIL" "$APP_URL/sign-up" --no-notify)
# $INVITATION still has the .url field, but no email is sent.
```

Use this for *wrapper-shape* tests. For *real-delivery* tests (the whole
point of this doc), keep the default.

## Flow 3 — OTP sign-up (no ticket, real form submission)

Verifies: `apps/app/src/app/(auth)/sign-up/page.tsx` → `OTPIsland` →
`useAuthFlow` sign-up code-verify branch with **real** OTP delivery.

This flow does NOT use `ensure-user` — that bypasses waitlist gating
and is the wrong thing to test. Instead, drive the actual UI:

```bash
EMAIL="jp+otp-signup-$(date +%s)@jeevanpillay.com"

# 1. Open sign-up
agent-browser open https://lightfast.localhost/sign-up

# 2. Snapshot + fill email + submit (see sign-in-playbook.md, waypoint 2)
agent-browser snapshot
agent-browser fill "@<email-ref>" "$EMAIL"
agent-browser click "@<continue-ref>"

# 3. Poll inbox for real OTP (see below)
OTP=$(get_otp_from_inbox "$EMAIL")    # 6-digit code in the email body

# 4. Fill code, observe redirect
agent-browser snapshot
agent-browser fill "@<otp-ref>" "$OTP"
```

⚠️ **Constraint as of 2026-05-13**: the Lightfast dev Clerk tenant has
**waitlist mode** enabled. Sign-up via the form will hit
`sign_up_restricted_waitlist`. The
[allowlist API](https://clerk.com/docs/reference/backend-api/tag/Allow-list-Block-list)
returns 200 but **does not override waitlist mode**. To exercise the
post-waitlist sign-up path you must either:
- Approve the email from the waitlist in the Clerk dashboard, or
- Temporarily switch the tenant out of waitlist mode (heavy hammer), or
- Use Flow 2 (invitation) — invited users skip waitlist.

The refactor's waitlist-block branch is verified to render correctly
when this constraint fires.

## Inbox polling

The Lightfast dev environment uses Superhuman as the user's primary
mail client; an agent running with Superhuman MCP tools can poll the
inbox directly. The high-leverage tools:

| Tool | When to use |
|---|---|
| `query_email_and_calendar` | Free-text search across the inbox. Best for: "find the email Clerk just sent to `jp+phase4-…@…`". Returns thread summaries with snippets. |
| `list_threads` | Recent threads in a label (e.g., `INBOX`). Useful when you don't know the exact subject yet. |
| `get_thread` | Full thread body once you have a thread id. Returns rendered text including the magic-link URL. |
| `get_message` | One specific message in a thread. Pull the raw HTML/text for URL extraction. |

### Recipe — pull a magic link

```
1. query_email_and_calendar query="to:jp+invite-1715... clerk.dev" limit=5
2. get_thread thread_id=<id from step 1>
3. Regex the body for the activation URL pattern.
```

### Tips

- Clerk emails arrive from `noreply@<your-clerk-frontend-host>` or
  similar. The exact sender depends on dashboard config — search by
  recipient or subject, not sender.
- Plus-addressing makes the recipient field self-identifying. Encode
  the test purpose into the local-part token (`+phase4-magic-…`) so
  search queries are precise even when the inbox is busy.
- Clerk delivery is usually <10s in dev. Poll on a 2-3s cadence, give
  up after ~60s and surface as a test failure.
- The inbox accumulates real artifacts. Trash threads aggressively
  after each test (or filter by label), otherwise the next test's
  query will pick up stale matches.

## Cleanup checklist

After **every** real-email test session, run these (idempotent):

```bash
# 1. Delete the test Clerk user (if it survives the flow)
node .agents/skills/lightfast-clerk/lib/clerk-backend.mjs delete-user-by-email "$EMAIL" || true

# 2. Revoke any pending invitations for the email
#    (find_invitation can take an id, but if you've lost it just leave them —
#    invitations expire and don't pollute future tests because each uses a
#    fresh +<token> alias.)

# 3. Trash the inbox thread(s) via the mail client / MCP tool

# 4. Wipe any agent-browser profile used to drive the UI
.agents/skills/lightfast-clerk/command/reset.sh <profile>
```

The Clerk user dashboard accumulates `jp+…@jeevanpillay.com` users
during a series of failed runs. They're harmless but noisy — periodic
sweep: list users matching `jp+%@jeevanpillay.com` and delete in bulk
via the dashboard.

## Safety notes specific to this flow

- **Real email = real PII**. The plus-addressed inbox is the developer's
  personal/work mail. Don't pipe Clerk responses verbatim into shared
  channels, gists, or logs that leave the laptop.
- The skill's `pk_test_` / `sk_test_` guard still applies. You **cannot**
  use this against a `pk_live_` tenant — and even with overrides, you
  shouldn't, because real users are in the same database.
- Set short token expirations when minting sign-in tokens
  (`create-sign-in-token <userId> 600` for 10min). If a token leaks
  via shell history or terminal scrollback, the blast radius is one
  sign-in for the test user — but shorter is still better.

## See also

- `test-mode.md` — the `+clerk_test@` shortcut for when you don't need real delivery
- `sign-in-playbook.md` — agent-browser waypoints, equally applicable here
- `safety.md` — the underlying guardrails (still in force)
