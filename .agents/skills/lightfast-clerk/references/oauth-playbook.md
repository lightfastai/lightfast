# OAuth playbook — Test IdP custom provider (emulator-backed)

Goal-driven recipe for driving the OAuth slice of the auth flow against the
**Test IdP** custom provider in the Clerk dev tenant. Backed by `emulate@0.5.0`
(Google OAuth shape) exposed via ngrok. **Use this for rows 5–7 of the OAuth
deep-test matrix; not for real-GitHub regression** (click "Continue with
GitHub" manually for that — both buttons render in dev).

Companion to `sign-in-playbook.md`. The OAuth round-trip is structurally one
redirect + callback, so the waypoint list is much shorter — the heavy
diagnostics live in the sister playbook and the parent skill.

## Preconditions

1. **`pnpm dev:emulate` running.** Prints the Clerk-dashboard discovery URL on
   startup. If `connections_oauth_custom.test_idp.discovery_url` doesn't
   already match, paste the printed URL into Clerk (or pipe the `clerk config
   patch` command from the script's banner). Refusing this step = silent 404s
   inside Clerk's token exchange.
2. **`pnpm dev:app` running.** Sign-in/sign-up render *both* OAuth buttons when
   `NEXT_PUBLIC_VERCEL_ENV === "development"`. Without dev env, the Test IdP
   button does not render and the playbook has nothing to click.
3. **Clerk safety gates.** Same as `sign-in-playbook.md` — `pk_test_*` only,
   localhost-targeted; `clerk-backend.mjs` refuses otherwise.

## Invariants

- Final URL on success: `/account/welcome` → onboarding handoff → `/account/teams/new`.
- `window.Clerk.user.externalAccounts[0].provider === "custom_test_idp"`.
- `verification.status === "verified"` on the external account.
- The strategy literal `oauth_custom_test_idp` is duplicated in
  `apps/app/src/app/(auth)/sign-in/page.tsx`, `sign-up/page.tsx`, and
  `sign-up/accept-invitation/page.tsx`. If you changed the Clerk slug,
  update all three.

If any of those breaks, the SDK / tenant / hook is wrong — not the playbook.

## ngrok interstitial (once per profile)

The first cross-domain navigation in a fresh agent-browser profile lands on
ngrok's free-tier "You are about to visit..." page. Click "Visit Site" once;
ngrok writes a 24h cookie scoped to the profile and subsequent navigations
skip it. **Do not** try to set the `ngrok-skip-browser-warning` header
globally via `agent-browser set headers` — it trips Clerk JS CDN preflight
and breaks the whole flow.

## Row 5 — Sign-in via OAuth (existing user)

```bash
# 1. Ensure the user exists in Clerk + the emulator seed.
node .agents/skills/lightfast-clerk/lib/clerk-backend.mjs ensure-user testuser@example.com
# (`scripts/dev-emulate.seed.yaml` is gitignored and preserved across runs.
# Add extra emails under `google.users:` and bounce the emulator —
# `pnpm dev:emulate` only rewrites the redirect_uri, never your user list.)

# 2. Open the sign-in page in a fresh profile.
agent-browser --profile .agent-browser/profiles/oauth-row5 \
              --session oauth-row5 \
              open https://app.lightfast.localhost/sign-in

# 3. Click "Continue with Test IdP" → ngrok interstitial (first time) →
#    emulator consent → click the seeded email button.
agent-browser ... snapshot
agent-browser ... click '@<ref-of-Continue-with-Test-IdP>'
# (one-shot click "Visit Site" if interstitial appears, then click the
# email row on the emulator consent page)

# 4. Wait for redirect chain to settle.
for _ in $(seq 1 30); do
  url=$(agent-browser ... get url)
  [[ "$url" == *"/account"* ]] && break
  sleep 1
done
```

**Pass:** URL ends on `/account/welcome` or `/account/teams/new`;
`window.Clerk.user.externalAccounts[0].provider === "custom_test_idp"` and
`verification.status === "verified"`.

## Row 6 — Sign-up via OAuth, no ticket

**Expected outcome under the current tenant config: rejected at the waitlist
gate.** This row exercises the rejection path, not a successful sign-up.

Procedure identical to row 5 but in a fresh profile bound to an email NOT in
Clerk and NOT on the waitlist. **One difference from row 5: the bare
`/sign-up` page now gates the OAuth buttons behind a Terms-of-Service
checkbox. Click the first OAuth button and you get an inline validation
message — no network call fires.** Check the checkbox (`@<ref-of-checkbox>`)
*before* clicking "Continue with Test IdP". Result: OAuth round-trip
completes from the IdP side, app catches `sign_up_restricted_waitlist`,
redirects to `/sign-up?errorCode=waitlist`. Verify the redirect happened and
the ErrorBanner copy mentions the waitlist.

If the tenant ever ships waitlist-off as the default, this row's expected
result changes — `/sso-callback` would dead-end (see the side-finding
in `thoughts/shared/research/2026-05-13-oauth-deep-test-findings.md`).

## Row 7 — Sign-up via OAuth + invitation ticket

The load-bearing row. Exercises the Bug D workaround at
`apps/app/src/app/(auth)/sign-up/accept-invitation/page.tsx:170-246`
(`handleOAuth`: `signUp.create({ticket, legalAccepted:true})` then
`clerk.client.signUp.authenticateWithRedirect({…, continueSignUp:true})`,
not `signUp.sso()` — the Future API is still broken on clerk-js@6.10.1, see
the comment block at lines 205-212 of that page for the precise failure
shape).

**Route note:** tickets are handled at `/sign-up/accept-invitation`, not
`/sign-up`. The bare sign-up page does *not* read `__clerk_ticket` — if you
land there with a ticket attached, the page renders the normal sign-up form
(Terms checkbox + email field) and OAuth falls through to the Row 6
waitlist path on submit. The accept-invitation route auto-accepts the
Terms (`legalAccepted: true` is hard-coded into both `signUp.create` and
`authenticateWithRedirect`) — no checkbox to click.

```bash
# 1. Mint a fresh invitation. Email MUST also exist in the emulator seed.
INVITATION=$(node .agents/skills/lightfast-clerk/lib/clerk-backend.mjs \
  create-invitation testuser@example.com \
  "https://app.lightfast.localhost/sign-up" --no-notify)
TICKET=$(echo "$INVITATION" | jq -r '.url' | sed 's/.*__clerk_ticket=//')

# 2. Open the accept-invitation page with the ticket attached.
agent-browser --profile .agent-browser/profiles/oauth-row7 \
              --session oauth-row7 \
              open "https://app.lightfast.localhost/sign-up/accept-invitation?__clerk_ticket=$TICKET"

# 3. Click "Continue with Test IdP". Click "Visit Site" on the ngrok
#    interstitial (first time), then the email button on the consent page.
#    No Terms checkbox on this route — handleOAuth passes legalAccepted:true.
agent-browser ... snapshot
agent-browser ... click '@<ref-of-Continue-with-Test-IdP>'

# 4. Wait for the SSO callback reconciliation to run.
for _ in $(seq 1 30); do
  url=$(agent-browser ... get url)
  [[ "$url" == *"/account"* ]] && break
  sleep 1
done
```

**Pass:** URL lands on `/account/welcome` (or onboarding handoff); invitation
shows `status: "accepted"` in Clerk; `window.Clerk.user.legalAcceptedAt` is
populated.

**Pre-flight check the workaround is exercised, not bypassed:** after step 3,
before the redirect completes, observe the network log. You should see
`POST /v1/client/sign_ups` (signUp.create) then `POST /v1/client/sign_ups/{id}`
(authenticateWithRedirect → SignUp.update → PATCH to the *resource* URL). If
you see `POST /v1/client/sign_ups?_method=PATCH` 405 instead, `handleOAuth`
has regressed back to `signUp.sso()` — file as a re-occurrence of Bug D.

## Failure modes — OAuth-specific only

| Symptom | Likely cause |
|---|---|
| Click does nothing; button stays in disabled state | Bug D regression — `handleOAuth` is calling `signUp.sso()` again. Check `sign-up/accept-invitation/page.tsx:170-246`. |
| Ticket-bearing URL lands on `/sign-up?errorCode=waitlist` | URL hit bare `/sign-up` instead of `/sign-up/accept-invitation`. The bare page ignores `__clerk_ticket` and falls through to the Row 6 path. Re-open the same ticket at `/sign-up/accept-invitation?__clerk_ticket=…` — invitation stays `pending` until consumed. |
| OAuth button on `/sign-up` is a no-op with inline "Terms of Service" message | Working as intended — bare `/sign-up` gates OAuth on the Terms checkbox. This is *not* a Bug D regression. Check the checkbox first. |
| Browser redirects to ngrok 404 | `dev:emulate` not running, or its tunnel URL rotated and Clerk's discovery_url is stale. Restart and re-patch. |
| Emulator returns `redirect_uri_mismatch` | Seed file's `redirect_uris` doesn't match Clerk's frontend API `/v1/oauth_callback`. Regenerate via `dev:emulate` (it derives from `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`). |
| Clerk dashboard "Diagnostics" shows discovery 404 | ngrok URL rotated since the last patch. `pnpm dev:emulate` prints the new URL — copy or pipe. |
| OAuth completes but `externalAccount.provider !== "custom_test_idp"` | Clerk slug drift. The strategy literal in the page must equal `oauth_custom_<clerk-slug>`. |

Generic auth failure modes (Clerk JS not loading, profile dir cross-contamination, tenant-config issues) live in `sign-in-playbook.md` — don't duplicate diagnostics here.
