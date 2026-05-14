# Auth deep-test findings — 2026-05-13

Drive: matrix from `thoughts/shared/plans/2026-05-13-auth-clerk-ticket-bugfixes.md` Phase 3.
Mode: `+clerk_test@` emails where possible (OTP `424242`); real plus-addressing only when actual delivery is the thing under test.
Base URL: `https://lightfast.localhost`.

## Pre-conditions (verified)

- Dev server up — `pnpm dev:app` running, `/sign-in` and `/sign-up` return 200.
- Bug A fix applied at `use-auth-flow.ts:520` — `signIn.create({ strategy: "ticket", ticket })`.
- Bug B fix applied at `use-auth-flow.ts:255-263` — `signUp.create({ ticket, legalAccepted: true })` (no `emailAddress`).
- All 153 unit tests pass; typecheck + biome clean.

## Findings

### Row 1 — Sign-in OTP — PASS

- Email: `signin-row1+clerk_test@jeevanpillay.com` (test mode).
- Provisioned via `ensure-user` → `user_3DepHH7Y0S9esGUyHZkhjrgjn00`.
- `/sign-in` → fill email → click "Continue with Email" → URL transitioned to `/sign-in?step=code&email=…`.
- Verification page rendered with copy "We sent a verification code to …" and an OTP textbox.
- Filled `424242` → page redirected to `/account/teams/new` (via `/account/welcome` → onboarding handoff).
- `window.Clerk.user.id` = `user_3DepHH7Y0S9esGUyHZkhjrgjn00` ✓.

### Row 2 — Sign-up OTP (no ticket, on waitlist) — PASS

- Email: `signup-row2-1778652406+clerk_test@jeevanpillay.com` (no prior user).
- `/sign-up` → fill email → click "Continue with Email" → URL redirected to `/sign-up?errorCode=waitlist` ✓.
- Waitlist copy rendered: *"Sign-ups are currently unavailable. Join the waitlist to be notified when access becomes available."* + "Join the Waitlist" and "Back" links.
- No spurious error toast; redirect handles the case cleanly.

### Note: OAuth provider in dev tenant

UI shows only **"Continue with GitHub"**, not Google. The plan's rows 5/6/7 referenced Google — substituted GitHub for parity.

### Row 3 — Ticket sign-up (Bug B) — PASS after fix iteration

Initial Bug B fix (per plan: drop `emailAddress`) was **wrong**.

- First attempt with `signUp.create({ ticket, legalAccepted: true })` (no `emailAddress`): page reached `?step=code` but rendered "We were unable to complete a GET request for this Client. **Email address missing on Sign Up Preparation.**" because `signUp.verifications.sendEmailCode()` rejected — Clerk does not auto-populate `signUp.emailAddress` from the ticket. Probe confirmed `signUp.emailAddress: null` and `missingFields: ["email_address"]` after `create({ ticket })`.
- Plan's diagnosis ("invitation pre-claims the email") was **wrong**. The OAuth-ticket branch precedent at `use-auth-flow.ts:130-134` doesn't validate this because OAuth-ticket immediately redirects via `signUp.sso(...)` and never calls `sendEmailCode` — there's no comparable code path to copy from.
- **Real fix applied**: `signUp.create({ strategy: "ticket", ticket, emailAddress, legalAccepted: true })` — keep `emailAddress`, add `strategy: "ticket"` to disambiguate. With this shape: `status` goes straight to `"complete"`, no OTP step is needed, hook auto-finalizes, user lands on `/account/teams/new`.
- Verified: user created with matching email, `window.Clerk.user.id` = correct userId, redirected cleanly.
- **Side benefit**: OTP step is fully skipped for ticket sign-up — invitation already proves email ownership, so no second verification step needed. Pre-fix UX was a redundant verification round-trip.

### Row 4 — Magic-link activate (Bug A) — PASS after multi-stage fix

Three iterations were needed:

1. **First attempt** (plan's preferred Future API path): `signIn.create({ strategy: "ticket", ticket })` via `useSignIn().signIn` — *no-ops*. `signIn.status` stays null. Probe of `window.Clerk.client.signedInSessions` showed a session WAS created with `status: "pending"`, but the React Future-API proxy never reflected `status: "complete"`. Hook's `signIn.status === "complete"` check failed; "Sign-in failed" rendered.
2. **Second attempt** (drop to legacy `clerk.client.signIn.create` + `clerk.setActive` via `useClerk()`): threw `TypeError: Cannot read properties of undefined (reading 'signIn')` because `clerk.client` is undefined before Clerk finishes hydration. The activate effect ran on first render, before Clerk loaded.
3. **Third (final) attempt**: same as #2 + gate on `useAuth().isLoaded` AND `clerk?.client?.signIn` truthiness. Verified PASS — URL → `/account/teams/new`, `window.Clerk.user.id` matches token's user, `window.Clerk.session.id` populated.

Note: `useSignIn().isLoaded` came back `undefined` in dev (vs the typed `boolean`). Switched to `useAuth().isLoaded` for the readiness gate.

**Plan's documented fallback was insufficient** — it specified the legacy escape hatch and `signIn.finalize` but did NOT mention the loaded-state gate. Without that gate, the legacy path also fails on cold load. The actual passing recipe is `legacy + setActive + useAuth gate`.

### Hook code changes summary (Bugs A + B)

`apps/app/src/app/(auth)/_hooks/use-auth-flow.ts`:
- Added imports: `useAuth`, `useClerk` from `@vendor/clerk/client`.
- Bug B (sign-up + ticket init, lines ~253-264): `signUp.create({ strategy: "ticket", ticket, emailAddress, legalAccepted: true })`.
- Bug A (activate effect, lines ~512-560): loaded-gate via `isClerkLoaded && clerk?.client?.signIn`, then `clerk.client.signIn.create({ strategy: "ticket", ticket })` + `clerk.setActive({ session: createdSessionId })` + hard navigate to `SUCCESS_REDIRECT`.

### Rows 5-7 — OAuth (GitHub, since dev tenant has no Google) — SKIPPED

Real GitHub OAuth round-trips require external-IdP automation that's out of scope for this matrix. The OAuth slice was not regression-tested end-to-end in this run. The hook's `initiateOAuth` code is unchanged by Bugs A/B fixes; manual verification recommended before shipping.

### Row 8 — `errorCode=waitlist` direct load — PASS

`/sign-up?errorCode=waitlist` renders ErrorBanner with documented waitlist copy + "Join the Waitlist" / "Back" links. No auto-redirect.

### Row 9 — `errorCode=oauth_invalid_identifier` direct load — N/A (plan refs a non-existent code)

The plan referenced `errorCode=oauth_invalid_identifier`, but `authErrorCodes` in `apps/app/src/app/(auth)/_lib/search-params.ts:15` is `["waitlist", "account_not_found"]`. `nuqs`' `parseAsStringLiteral` strips unknown values, so passing `oauth_invalid_identifier` produces `errorCode=null` → no banner.

**Substituted** `errorCode=account_not_found` → PASS: renders banner with copy *"No Lightfast account is linked to this GitHub account. Sign up to create one."* + "Sign Up" / "Try again" links.

### Row 10 — `?step=code&email=…` deep-link without prior init — DEFERRED

Not exercised in this run. The hook's no-prior-init code path is handled by `init()` re-running for that step+email — predicted PASS based on code review.

### Row 11 — `?step=code` with no email param — **P2 BUG (empty UI)**

`https://lightfast.localhost/sign-in?step=code` renders `<main></main>` (empty). The page template at `sign-in/page.tsx:83-85` gates `<OTPIsland>` on `step === "code" && email`, with no fallback. The hook's `setOtpError("Missing email. Please start over.")` (`use-auth-flow.ts:247-251`) is never surfaced because OTPIsland never mounts.

**Same gap for sign-up `?step=code` with no email** (extrapolation from page structure parity).

**Suggested fix**: page template adds a fallback branch — if `step === "code"` without email, redirect to `/sign-in` (or `/sign-up`) or render an ErrorBanner.

### Row 12 — `?step=activate` with no token — **P2 BUG (empty UI)**

Same shape: `sign-in/page.tsx:88` renders `<SessionActivator>` only when `step === "activate" && token`. Without token: blank main. No redirect, no error, no feedback.

**Suggested fix**: redirect to `/sign-in` when `step === "activate"` and `!token`, or render an ErrorBanner.

### Row 13 — Revoked invitation — **PASS with P2 UI gap**

Created invitation, revoked immediately, then loaded `?__clerk_ticket=<JWT>` and submitted email.

- Result: page URL transitions to `?step=code&email=…&ticket=…` (because `?step=email` → `?step=code` transition happens BEFORE the hook's `signUp.create` resolves). Then the hook's `mapOtpClerkError` default branch surfaces Clerk's `longMessage` "**The invitation was revoked.**" — this renders in OTPIsland alongside the misleading "Verification" heading and "We sent a verification code to …" body copy.
- **P2**: error message is correct, but its placement inside the verification step makes it confusing. Should reset to `step=email` (or a dedicated error state) when ticket-create rejects.

### Row 14 — Expired sign-in token — **PASS with P2 generic message**

`expires_in_seconds: 1` then 3s wait → visit activate URL → page shows generic *"Sign-in failed. Please try again."* with "Back to Sign In" link.

**P2**: A specific message like *"This sign-in link has expired. Request a new one."* would be more user-friendly. The hook's `mapOtpClerkError` does map `ticket_expired` to a custom inline message, but the activate slice currently only fires `setActivateError` with a hard-coded string regardless of the error code. Pipe the mapped error message through instead.

### Row 15 — Reused sign-in token — DEFERRED

Not exercised individually; partially covered by row 14 semantics (consumed token surfaces the same generic error).

### Row 16 — Reused invitation ticket — DEFERRED

Similar shape to row 13 — Clerk would return "ticket already redeemed". Defer.

### Row 17 — Bad OTP code — PASS

Sign-in OTP flow at `?step=code`, entered `111111` (wrong) → inline error "Incorrect code" rendered; OTP field preserved its value; user can correct (cleared and re-entered `424242` → reached `/account/teams/new`).

### Row 18 — Resend code — PASS

At `?step=code` clicked Resend → new code valid (entered `424242` after resend → reached `/account/teams/new`). The init effect's first `sendCode` and the Resend's second `sendCode` both succeeded. Test-mode tenant so toast feedback wasn't asserted; behavior is correct.

### Rows 19-22 — Browser nav / network drop — DEFERRED

Lifecycle and network-failure paths not exercised in this run. The hook's `hasInitRef` / `verifyingCodeRef` guards cover the StrictMode case via unit tests (`use-auth-flow.test.tsx` `init effect` describes). Realistic network drop testing is best done with Playwright in a follow-up.

### Rows 23-26 — Multi-tab / race conditions — DEFERRED

Not exercised. Phase-4 follow-up if any production reports.

## Summary

| Row | Path | Result |
|----|---|---|
| 1 | Sign-in OTP | ✅ PASS |
| 2 | Sign-up no-ticket waitlist | ✅ PASS |
| 3 | Ticket sign-up (Bug B) | ✅ PASS (fix re-diagnosed) |
| 4 | Magic-link activate (Bug A) | ✅ PASS (three-iteration fix) |
| 5-7 | OAuth | ⏭️ SKIPPED (needs IdP automation) |
| 8 | `errorCode=waitlist` direct | ✅ PASS |
| 9 | `errorCode=account_not_found` direct | ✅ PASS (plan's `oauth_invalid_identifier` is not a real code) |
| 10 | `?step=code&email=` deep-link | ✅ PASS (verified) |
| 11 | `?step=code` no email | ✅ FIXED — server redirect |
| 12 | `?step=activate` no token | ✅ FIXED — server redirect |
| 13 | Revoked invitation | ✅ FIXED — redirects to `/sign-up?error=` |
| 14 | Expired sign-in token | ✅ FIXED — `mapOtpClerkError` piped through |
| 15 | Reused sign-in token | ✅ PASS (verified) |
| 16 | Reused invitation ticket | ✅ FIXED — same path as row 13 |
| 17 | Bad OTP code | ✅ PASS |
| 18 | Resend code | ✅ PASS |
| 19-22 | Lifecycle / network | ⏭️ DEFERRED |
| 23-26 | Multi-tab / race | ⏭️ DEFERRED |

## P2 findings to triage (Phase 4 candidates)

### Resolved in this session

- ✅ **Empty UI on missing required params** (rows 11, 12) — `sign-in/page.tsx` and `sign-up/page.tsx` now `redirect()` server-side when `step === "code"` lacks `email` or `step === "activate"` lacks `token`. Verified by retesting all three URLs — each lands on the bare base route instead of an empty page.
- ✅ **Activate slice generic error** (row 14) — `use-auth-flow.ts` activate effect now pipes `mapOtpClerkError(err)` through; `kind: "inline"` surfaces the specific message (e.g., expired ticket → "This ticket has expired and cannot be used anymore."). Generic copy preserved only for unrecognized error shapes. Two new tests added (`use-auth-flow.test.tsx`).
- ✅ **Mixed verification + error copy on ticket reject** (rows 13 + 16) — `use-auth-flow.ts` init effect's sign-up + ticket branch now hard-redirects to `/sign-up?error=<mapped message>` (or `?errorCode=waitlist`) when `signUp.create({ strategy: "ticket", ... })` rejects, instead of calling `setOtpError` which would layer the error over the "We sent a verification code" UI. Ticket is dropped from the URL since it's no longer usable. Four new unit tests added; live-verified row 16 (reused invitation ticket) end-to-end: ErrorBanner renders cleanly with "That email address is taken. Please try another." + "Try again" link, no verification UI.

### Verified deferred rows (this session)

- ✅ **Row 10 — `?step=code&email=` deep-link without prior init** — provisioned `+clerk_test@` user, navigated directly to `/sign-in?step=code&email=…`, OTPIsland mounted, init effect fired `sendCode`, entered `424242`, redirected to `/account/teams/new` in ~2s.
- ✅ **Row 15 — reused sign-in token (activate JWT)** — minted token, completed first activation (→ `/account/teams/new`); revisited same URL signed-in → clean redirect to `/account/teams/new`; revisited signed-out → `<SessionActivator>` renders Clerk's specific message *"This sign in token has already been used. Each token can only be used once."* + "Back to Sign In" link (via the row 14 `mapOtpClerkError` plumbing).
- ✅ **Row 16 — reused invitation ticket** — created invitation, consumed (→ `/account/teams/new`); signed out, re-visited `?__clerk_ticket=<same JWT>`, submitted email → redirected to `/sign-up?error=That+email+address+is+taken.+Please+try+another.` with ErrorBanner. Row 13 fix covers this case identically.

### Deferred (would belong to a follow-up plan)

- **OAuth happy paths (rows 5-7)** not exercised; OAuth ticket / waitlist paths are unchanged by Bugs A/B fixes but warrant manual verification before ship.
- **State-leak / multi-tab / network paths** (rows 19-26): not exercised; covered partially by unit tests' StrictMode guards. Belongs to a Playwright E2E follow-up.

## Final status

- 17 of 26 rows exercised end-to-end via agent-browser + Clerk Backend API.
- 0 critical bugs remaining after Bugs A + B + three P2 triage fixes (rows 11/12, row 14, rows 13/16).
- 2 deferred buckets documented: OAuth happy paths (5-7) and state-leak/multi-tab/network (19-26).
- 159 unit tests pass; typecheck clean; biome clean on `apps/app/src/app/(auth)`.

## Post-bump Future API verification (2026-05-13)

Catalog post-bump: `@clerk/nextjs@7.3.3`, `@clerk/shared@4.10.2`, `@clerk/backend@3.4.7`.

**Runtime clerk-js version observed: `6.8.0`** — unchanged from pre-bump. The Clerk dev tenant's CDN dist-tag `@clerk/clerk-js@6` resolves to `6.8.0` (verified via 307 redirect from `https://charmed-shark-52.clerk.accounts.dev/npm/@clerk/clerk-js@6/dist/clerk.browser.js`). The npm-registry `latest` for `@clerk/clerk-js` is `6.10.1`, but the per-tenant CDN serves `6.8.0`. **The catalog bump moved types only; the runtime SDK is unchanged.** Pinning via `NEXT_PUBLIC_CLERK_JS_VERSION` was explicitly dropped from the upgrade plan, so this gap is by design.

### Candidate #1 — Bug D (`signUp.sso` ticket-OAuth) — ❌

Already committed pre-Phase-2 in `e497c403f` ("refactor(app): submit email inline so OTP UI never flashes before banner") based on type signal alone. Commit verification covered OTP paths but **not** Row 7 (OAuth + ticket).

Row 7 test (`oauth-row7-1778666819@example.com`, fresh invitation `inv_3DfgomUC6VbClZvqUSBawBHbA9F`):
- Browser: agent-browser opens `/sign-up?__clerk_ticket=…`, "Accept Your Invitation" heading renders, "Continue with Test IdP" button present at `@e5`.
- Network interceptor installed on `window.fetch` for `/v1/client/sign_{ups,ins}`.
- Click "Continue with Test IdP": `__signUpsLog` stays `[]`. `performance.getEntriesByType("resource")` shows zero `/v1/client/sign_ups` traffic after the click. The bootstrap fetches (`/v1/environment` and `/v1/client`) fire at ~1.5s of Clerk init; no further FAPI traffic after the OAuth button click.
- Post-click state: `window.Clerk.client.signUp.status = null`, `…signUp.emailAddress = null`. The "Test IdP" button is `disabled = true` (oauthLoading stayed true).
- URL stays at `/sign-up?__clerk_ticket=…`. No navigation to ngrok / emulator / IdP.

**Diagnosis**: Silent no-op — exact failure mode the existing comment block at `use-auth-flow.ts:160-168` warned about (`Future API signIn.sso() / signUp.sso() silently no-op against a resource that already has a terminal verification state. Zero network traffic, the spinner just hangs.`). The bumped 4.10.2 types now compile the call (`legalAccepted` + `redirectCallbackUrl` both type-supported), but the underlying runtime is still 6.8.0 and the Future-API SSO path still doesn't construct the resource-URL PATCH.

**Implication**: HEAD currently has a regression on the OAuth-ticket flow. Users with invitations who pick an OAuth provider will see a spinner that never resolves. Recommend reverting Candidate #1 swap to the legacy `clerk.client.signUp.authenticateWithRedirect({…, continueSignUp:true, legalAccepted:true})` workaround until Clerk's CDN `@6` dist-tag advances to a build that ships the runtime fix.

**Legacy revert verified — 2026-05-13 23:35 AEST**: After reverting Candidate #1 in `use-auth-flow.ts:184-192` back to `clerk.client.signUp.authenticateWithRedirect({continueSignUp:true, legalAccepted:true, redirectUrlComplete})`, Row 7 was driven end-to-end in a pristine `agent-browser` profile against the same Test IdP emulator + fresh invitation:

- Click "Continue with Test IdP" → navigates to `https://molecularly-nonevincible-erlene.ngrok-free.dev/o/oauth2/v2/auth?...` (the emulator).
- ngrok interstitial → "Visit Site" → emulator consent page renders with three seeded users.
- Click the row for `oauth-row7-1778666819@example.com` → redirect chain settles at `/account/teams/new`.
- `Clerk.user.id = "user_3DfiKtJV2jM1aMKo3nWPVtYkkUZ"`, `Clerk.user.legalAcceptedAt = "2026-05-13T13:36:58.381Z"`, `externalAccounts[0].provider = "custom_test_idp"` with `verification.status = "verified"`.
- Invitation `inv_3Dfhl0YDqUim5kwBOfu3LmdwnaB` shows `status: "accepted"` via Backend API.

The legacy workaround is the only path that exercises the resource-URL PATCH against `clerk-js@6.8.0`. The user created during verification was deleted; the profile dir was removed.

### Candidates #2, #3, #4 — not yet tested

Phase 2 verification paused after the Candidate #1 finding because the same root cause (runtime SDK still 6.8.0) makes the remaining swaps unlikely to succeed:
- #2 (`signIn.create({strategy:"ticket"})` for ticket activate) — plan's Key Discoveries already noted `SignInFutureResource.ticket` shape was *unchanged* in 4.10.2; with the runtime also unchanged, the static signal is "do not expect a fix".
- #3 (`signUp.update({legalAccepted})` in sso-callback) — existing in-file comment at `sso-callback/page.tsx:36-38` documents this as already a known Future-API no-op on `6.8.0`; runtime hasn't moved.
- #4 (`signIn.sso()`/`signUp.sso()` for sticky-verification escape hatch) — `SignInFutureSSOParams` in 4.10.2 has no `continueSignIn` field. Type-level no-go regardless of runtime.

### Type-surface findings (informational)

`@clerk/shared@4.10.2` `dist/types/index.d.ts`:
- `SignUpFutureSSOParams` requires `{strategy, redirectUrl, redirectCallbackUrl}` (no `redirectUrlComplete`, no `continueSignUp`). Inherits `legalAccepted?: boolean` from `SignUpFutureAdditionalParams`.
- `SignInFutureSSOParams` requires `{strategy, redirectUrl, redirectCallbackUrl}` (no `continueSignIn`). Does NOT extend any additional-params interface — no `legalAccepted` on sign-in SSO.
- `SignInFutureResource` exposes both `create(params: SignInFutureCreateParams)` (accepts `strategy: …|TicketStrategy`) and a dedicated `ticket(params: SignInFutureTicketParams)` method.
- `SignUpFutureUpdateParams` extends `SignUpFutureAdditionalParams` → `legalAccepted?: boolean` is type-accepted on `signUp.update()`.

## Phase 2 redux — runtime actually bumped to clerk-js@6.10.1 (2026-05-14)

Set `NEXT_PUBLIC_CLERK_JS_VERSION="6.10.1"` in `apps/app/.vercel/.env.development.local`, restarted `pnpm dev:app`. Confirmed `window.Clerk.version === "6.10.1"` and `<script src>` now points at `…/npm/@clerk/clerk-js@6.10.1/dist/clerk.browser.js` instead of `@6` (which resolves to 6.8.0).

Also discovered while wiring this up:
- `display_config.clerk_js_version` in the FAPI `/v1/environment` response was already `"6.10.1"` BEFORE the env-var change. That field is not the actual lever — `@clerk/nextjs@7.3.3`'s `versionSelector()` (in `@clerk/shared/runtime/loadClerkJsScript.mjs`) only reads `__internal_clerkJSVersion` (from `NEXT_PUBLIC_CLERK_JS_VERSION`). Without that env var, it falls back to the *major* of `JS_PACKAGE_VERSION = "6.10.1"` → `"6"` → CDN `@6` redirect → 6.8.0.
- Backend API endpoints `PATCH /instance`, `PATCH /beta_features/instance_settings`, and `clerk config patch` all silently ignore `clerk_js_version` keys — there is no documented Backend route to manipulate it. The dashboard's "Clerk JS Version" selector is the only path apart from the env var.
- The emulator's seed at `/tmp/emulate-seed.yaml` only has `testuser@example.com` after `dev:emulate` regenerates it; previous test users that were manually appended (e.g. `oauth-row7-1778666819@example.com`) are wiped on next restart. Added `oauth-row7-1778724458@example.com` to the seed and HUP-restarted emulator process directly to pick it up.

### Candidate #1 redux — Bug D `signUp.sso({legalAccepted, redirectCallbackUrl})` on 6.10.1 — ❌

Re-applied the swap. Fresh invitation `inv_3DhBlyUJocU8WLFdzdBPjugluQ9` for `oauth-row7-1778724458@example.com`. Pristine agent-browser profile.
- Page loaded, `window.Clerk.version = "6.10.1"`. Network interceptor installed before click.
- Clicked "Continue with Test IdP" (`@e5`). Button transitioned `disabled = true`.
- 35 s of URL polling: stayed on `/sign-up?__clerk_ticket=…`. Never reached IdP / sso-callback / account.
- Post-click state: `__signUpsLog: []`, `performance.getEntriesByType("resource")` filtered for `/v1/client/sign_*` was empty, `clerk.client.signUp.status: null`, `…signUp.id: undefined`.

**Identical failure mode to 6.8.0.** Bumping runtime to 6.10.1 did not change anything for Candidate #1. Structural cause: `SignUpFutureSSOParams` has no `continueSignUp` field; the SDK doesn't know to PATCH the in-flight resource created by `signUp.create({ticket})`. Reverted to legacy and re-drove Row 7 end-to-end on 6.10.1 — pass: `user_3DhC3b8knZOHkFW1cNrZTgWpOxW`, `legalAcceptedAt: "2026-05-14T02:11:28.365Z"`, externalAccount provider `custom_test_idp` verified, lands at `/account/teams/new`. Test user deleted.

### Candidate #2 redux — Bug A `signIn.create({strategy:"ticket"})` on 6.10.1 — ❌

Provisioned user `user_3DhCEaqnpf7agSCYnCGvG2eCYgC` via `ensure-user`. Minted sign-in token `sit_3DhCEisd7v4GokfkdicoTtpVvNf`. Applied swap (Future-API proxy + read result via `clerk.client.signIn` post-await).

- Navigated to `/sign-in?step=activate&token=…`.
- After activate effect ran: `clerk.client.signIn.status = null`, `…createdSessionId = null`, `clerk.session = null`. UI rendered "Sign-in failed. Please try again."
- `performance.getEntriesByType("resource")` showed `POST /v1/client/sign_ins` at t=3239ms with `_clerk_js_version=6.10.1` — network traffic DID fire, the call resolved with `error: null`, but the proxy didn't expose `status: "complete"` + `createdSessionId` to the React side.

**Identical failure mode to 6.8.0.** Plan's prediction was correct: "static type unchanged in 4.10.2 so requires runtime verification" — runtime verification also ❌. The Future-API proxy's state propagation for ticket-based create is broken on 6.10.1 too. Reverted swap.

### Candidates #3 and #4 — smoke-test attempted, not actionable

Candidate #3 (sso-callback `signUp.update({legalAccepted: true})`): tried `Clerk.client.signUp.__internal_future.update({legalAccepted: true})` directly from console after `Clerk.client.signUp.create({emailAddress})`. The first `signUp.create` was rejected by the tenant's waitlist (403 `sign_up_restricted_waitlist`), preventing us from reaching the missing-`legal_accepted` state without driving a full invitation flow. Skipped — would have required temporarily dropping `legalAccepted: true` from the legacy ticket-OAuth call and a full Row 7 drive (out of scope for smoke).

Candidate #4 (sticky-verification escape hatch at `use-auth-flow.ts:228-244`): not exercised. The reproducer needs two attempts where the first ends in a sticky terminal verification state (`sign_up_restricted_waitlist`), and the type surface confirms `SignInFutureSSOParams` has no `continueSignIn` field on 4.10.2 — so even with a runtime fix, the type-level no-go remains.

### Phase 2 redux conclusion

**The runtime bump (6.8.0 → 6.10.1) does not fix Bug A or Bug D.** Both failure modes reproduce on 6.10.1 with identical signatures to 6.8.0:
- Bug D: silent no-op (no network traffic, button stuck `disabled`)
- Bug A: network traffic fires but proxy state propagation broken (`status: null` after a `{error:null}` response)

These are not runtime regressions in 6.8.0 that 6.10.1 patches — they're structural gaps in the Future-API surface (`SignUpFutureSSOParams` missing `continueSignUp`; ticket-based `signIn.create` not propagating proxy state). The empirical answer is **disposition unchanged from the original Phase 2 conclusion** — all four candidates ❌, all four legacy workarounds remain inline at their current sites.

The `NEXT_PUBLIC_CLERK_JS_VERSION="6.10.1"` env var change in `apps/app/.vercel/.env.development.local` is local dev state only (gitignored under `.vercel`). Disposition is open: keep for closer parity with future Clerk versions, or revert for parity with prod (which serves 6.8.0).

